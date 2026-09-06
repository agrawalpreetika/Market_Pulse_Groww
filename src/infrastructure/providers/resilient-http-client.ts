const DEFAULT_RETRYABLE_STATUSES = new Set([
  408,
  425,
  429,
  500,
  502,
  503,
  504,
]);

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

type ResilientHttpClientOptions = {
  name: string;
  maximumAttempts?: number;
  requestTimeoutMs?: number;
  baseDelayMs?: number;
  maximumDelayMs?: number;
  failureThreshold?: number;
  openDurationMs?: number;
  retryableStatuses?: ReadonlySet<number>;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class ProviderCircuitOpenError extends Error {
  constructor(providerName: string) {
    super(`${providerName} circuit is temporarily open`);
    this.name = "ProviderCircuitOpenError";
  }
}

export class ProviderRequestError extends Error {
  constructor(
    providerName: string,
    public readonly cause: unknown,
  ) {
    super(`${providerName} request failed after retry budget was exhausted`);
    this.name = "ProviderRequestError";
  }
}

export function createResilientHttpClient(
  options: ResilientHttpClientOptions,
) {
  const maximumAttempts = options.maximumAttempts ?? 3;
  const requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const maximumDelayMs = options.maximumDelayMs ?? 2_000;
  const failureThreshold = options.failureThreshold ?? 5;
  const openDurationMs = options.openDurationMs ?? 30_000;
  const retryableStatuses =
    options.retryableStatuses ?? DEFAULT_RETRYABLE_STATUSES;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));

  let state: CircuitState = "CLOSED";
  let consecutiveFailures = 0;
  let openedAt: number | null = null;
  let halfOpenRequestInFlight = false;

  function allowRequest() {
    if (state !== "OPEN") {
      if (state === "HALF_OPEN" && halfOpenRequestInFlight) {
        throw new ProviderCircuitOpenError(options.name);
      }

      if (state === "HALF_OPEN") {
        halfOpenRequestInFlight = true;
      }

      return;
    }

    if (
      openedAt !== null &&
      now() - openedAt >= openDurationMs
    ) {
      state = "HALF_OPEN";
      halfOpenRequestInFlight = true;
      return;
    }

    throw new ProviderCircuitOpenError(options.name);
  }

  function recordSuccess() {
    state = "CLOSED";
    consecutiveFailures = 0;
    openedAt = null;
    halfOpenRequestInFlight = false;
  }

  function recordFailure() {
    halfOpenRequestInFlight = false;
    consecutiveFailures += 1;

    if (
      state === "HALF_OPEN" ||
      consecutiveFailures >= failureThreshold
    ) {
      state = "OPEN";
      openedAt = now();
    }
  }

  function retryDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      maximumDelayMs,
      baseDelayMs * 2 ** (attempt - 1),
    );

    // Full jitter prevents synchronized workers from retrying together.
    return Math.floor(random() * exponentialDelay);
  }

  return {
    async fetch(
      input: URL | RequestInfo,
      init: RequestInit = {},
      fetchImplementation: typeof fetch = globalThis.fetch,
    ): Promise<Response> {
      allowRequest();

      let lastResponse: Response | null = null;
      let lastError: unknown = null;

      for (
        let attempt = 1;
        attempt <= maximumAttempts;
        attempt += 1
      ) {
        try {
          const response = await fetchImplementation(input, {
            ...init,
            signal:
              init.signal ??
              AbortSignal.timeout(requestTimeoutMs),
          });

          lastResponse = response;

          if (!retryableStatuses.has(response.status)) {
            // A permanent 4xx is a valid provider response, not an outage.
            recordSuccess();
            return response;
          }
        } catch (error: unknown) {
          lastError = error;
        }

        if (attempt < maximumAttempts) {
          await sleep(retryDelay(attempt));
        }
      }

      recordFailure();

      if (lastResponse) {
        return lastResponse;
      }

      throw new ProviderRequestError(options.name, lastError);
    },

    getState(): CircuitState {
      return state;
    },

    reset() {
      state = "CLOSED";
      consecutiveFailures = 0;
      openedAt = null;
      halfOpenRequestInFlight = false;
    },
  };
}

export const yahooHttpClient = createResilientHttpClient({
  name: "Yahoo",
});
