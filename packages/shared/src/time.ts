/**
 * All times are stored in UTC and displayed in Asia/Amman (spec section 4).
 * Jordan uses UTC+3 all year (no daylight saving since 2022).
 */

export const AMMAN_TZ = "Asia/Amman";

/** Today's calendar date in Amman as YYYY-MM-DD. */
export function ammanToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: AMMAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The UTC instant an offer ends: 23:59:59 Amman time on the given date when no time
 * is given (FR-LC-01).
 */
export function endOfAmmanDayUtc(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  // Amman is UTC+3, so 23:59:59 local is 20:59:59 UTC.
  return new Date(`${date}T23:59:59+03:00`);
}
