export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("en-SG", {
    maximumFractionDigits: 0,
    style: "percent",
  }).format(value);
}
