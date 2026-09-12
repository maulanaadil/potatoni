export const TIMEZONE = "Asia/Jakarta";

/** 18000 -> "18K", as printed on the menu board. */
export function formatK(amount: number) {
  const k = amount / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
}

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** 18000 -> "Rp 18.000" */
export function formatRupiah(amount: number) {
  return rupiah.format(amount).replace(/ /g, " ");
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatTime(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Calendar date in Jakarta as YYYY-MM-DD. */
export function jakartaDateKey(date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(date);
}

/** UTC instant for 00:00 WIB on the given Jakarta calendar day (+ offset days). */
export function startOfJakartaDay(date: Date = new Date(), offsetDays = 0) {
  const [y, m, d] = jakartaDateKey(date).split("-").map(Number) as [number, number, number];
  // WIB is UTC+7 with no DST.
  return new Date(Date.UTC(y, m - 1, d + offsetDays, -7));
}

export function mediaUrl(key: string | null | undefined) {
  return key ? `/api/media/${key}` : null;
}

/** "2026-09-13" → "13 Sep 2026" (calendar day, no timezone shift). */
export function formatDay(key: string | null | undefined, withYear = true) {
  if (!key) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${key}T00:00:00Z`));
}
