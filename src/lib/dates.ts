export function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addCalendarMonths(date: Date, months: number) {
  const result = new Date(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDay));
  return dateOnly(result);
}

export function daysRemaining(end: Date) {
  const today = dateOnly(new Date()).getTime();
  return Math.max(0, Math.ceil((dateOnly(end).getTime() - today) / 86_400_000));
}

export function isCoverageActive(end: Date) {
  return dateOnly(end).getTime() >= dateOnly(new Date()).getTime();
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
