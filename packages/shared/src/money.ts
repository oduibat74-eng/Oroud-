/**
 * Prices are stored as decimal JOD with 3 decimals (spec section 4).
 * We keep amounts as integer fils (1 JOD = 1000 fils) in code to avoid float errors.
 */

export const FILS_PER_JOD = 1000;

export function jodToFils(jod: number): number {
  return Math.round(jod * FILS_PER_JOD);
}

export function filsToJod(fils: number): number {
  return fils / FILS_PER_JOD;
}

/** Discount percentage from a price and a was-price, rounded to a whole number. */
export function discountPct(price: number, wasPrice: number): number | null {
  if (!(wasPrice > 0) || !(price >= 0) || price >= wasPrice) return null;
  return Math.round((1 - price / wasPrice) * 100);
}

/** Format a JOD amount for display, dropping trailing zeros (21 -> "21", 2.5 -> "2.5"). */
export function formatJod(jod: number, locale: "ar" | "en" = "en"): string {
  const amount = new Intl.NumberFormat(locale === "ar" ? "ar-JO" : "en-JO", {
    maximumFractionDigits: 3,
  }).format(jod);
  return locale === "ar" ? `${amount} د.أ` : `${amount} JOD`;
}
