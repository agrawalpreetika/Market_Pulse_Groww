export type PriceChange = {
  absolute: string;
  percent: string;
};

export function calculatePriceChange(
  price: string,
  previousClose: string | null,
): PriceChange | null {
  if (previousClose === null) {
    return null;
  }

  const currentPrice = Number(price);
  const closingPrice = Number(previousClose);

  const containsInvalidValue =
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(closingPrice) ||
    closingPrice <= 0;

  if (containsInvalidValue) {
    return null;
  }

  const absoluteChange =
    currentPrice - closingPrice;

  const percentageChange =
    (absoluteChange / closingPrice) * 100;

  return {
    absolute: absoluteChange.toFixed(2),
    percent: percentageChange.toFixed(2),
  };
}