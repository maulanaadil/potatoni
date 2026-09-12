export const TIMEZONE = "Asia/Jakarta";

/** Calendar date in Jakarta as YYYY-MM-DD. */
export const jakartaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

/** "Saturday, 12 September 2026" for the system prompt. */
export const jakartaTodayLabel = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(),
  );

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** SQL: Jakarta wall-clock time of a timestamp column (Prisma stores UTC without a zone). */
export const wib = (column: string) => `((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${TIMEZONE}')`;
