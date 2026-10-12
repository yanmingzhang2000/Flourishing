/** Local date helpers. Kept in sync with the server's local-timezone day. */
export function localToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Parse a YYYY-MM-DD string as a local Date (no UTC shift). */
export function parseIsoDate(iso: string): Date {
  const parts = iso.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** iso ± n days, staying in the same local-day representation. */
export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "10/12" style short label for dense strips. */
export function formatMonthDay(iso: string): string {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** "10月12日" style label for headings. */
export function formatMonthDayLong(iso: string): string {
  const date = parseIsoDate(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatWeekday(iso: string): string {
  return WEEKDAY_LABELS[parseIsoDate(iso).getDay()] ?? '';
}
