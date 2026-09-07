const EXCHANGE_TIME_ZONE = "Asia/Kolkata";
const HISTORY_READY_MINUTES = 16 * 60;

function getExchangeDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: EXCHANGE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const values = new Map(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    weekday: values.get("weekday") ?? "",
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
  };
}

function previousWeekday(date: Date): Date {
  const result = new Date(date);

  do {
    result.setUTCDate(result.getUTCDate() - 1);
  } while (result.getUTCDay() === 0 || result.getUTCDay() === 6);

  return result;
}

export function getLatestCompletedTradingDate(now = new Date()): Date {
  const parts = getExchangeDateParts(now);
  const exchangeDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const isWeekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  const isReadyToday =
    !isWeekend && parts.hour * 60 + parts.minute >= HISTORY_READY_MINUTES;

  return isReadyToday ? exchangeDate : previousWeekday(exchangeDate);
}
