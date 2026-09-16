export function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

export function calendarDay(iso: string): string {
  return iso.slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / (24 * 60 * 60 * 1000);
}

export function distinctCount(values: readonly string[]): number {
  return new Set(values).size;
}
