export const TIMEZONE = "Asia/Jakarta";

// en-CA formats as YYYY-MM-DD.
export const jakartaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

export const jakartaTodayLabel = () =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

export function addDays(key: string, n: number) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// Prisma stores timestamps as UTC without a zone.
export const wib = (column: string) => `((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${TIMEZONE}')`;
