import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

export function createRunId(): string {
  return randomUUID();
}

export function structuredLog(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error") {
    console.error(record);
  } else if (level === "warn") {
    console.warn(record);
  } else {
    console.log(record);
  }
}

export function safeError(error: unknown): {
  name: string;
  message: string;
} {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError", message: "Unknown failure" };
}
