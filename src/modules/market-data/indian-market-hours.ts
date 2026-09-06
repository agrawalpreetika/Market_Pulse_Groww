export type IndianMarketState =
  | "OPEN"
  | "BEFORE_OPEN"
  | "AFTER_CLOSE"
  | "WEEKEND";

export type IndianMarketHoursResult = {
  state: IndianMarketState;
  shouldRefresh: boolean;
};

const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

function getIndianDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    },
  );

  const parts = formatter.formatToParts(now);

  const values = new Map(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return {
    weekday: values.get("weekday") ?? "",
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
  };
}

export function getIndianMarketState(
  now: Date = new Date(),
): IndianMarketHoursResult {
  const { weekday, hour, minute } =
    getIndianDateParts(now);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return {
      state: "AFTER_CLOSE",
      shouldRefresh: false,
    };
  }

  if (
    weekday === "Sat" ||
    weekday === "Sun"
  ) {
    return {
      state: "WEEKEND",
      shouldRefresh: false,
    };
  }

  const currentMinutes =
    hour * 60 + minute;

  if (
    currentMinutes < MARKET_OPEN_MINUTES
  ) {
    return {
      state: "BEFORE_OPEN",
      shouldRefresh: false,
    };
  }

  if (
    currentMinutes >= MARKET_CLOSE_MINUTES
  ) {
    return {
      state: "AFTER_CLOSE",
      shouldRefresh: false,
    };
  }

  return {
    state: "OPEN",
    shouldRefresh: true,
  };
}