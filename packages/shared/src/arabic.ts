/**
 * Arabic text helpers used for search and AI extraction.
 * Spec section 4: keep a normalised Arabic copy of searchable text
 * (remove diacritics, unify alef/yaa/taa marbuta variants).
 */

// Harakat, tanween, shadda, sukun, superscript alef, Quranic marks and tatweel.
const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Normalise Arabic (and mixed) text for search: one canonical spelling per word. */
export function normalizeArabic(input: string): string {
  return toWesternDigits(input)
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
    .replace(/ى/g, "ي") // ى -> ي
    .replace(/ة/g, "ه") // ة -> ه
    .replace(/ؤ/g, "و") // ؤ -> و
    .replace(/ئ/g, "ي") // ئ -> ي
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Convert Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to 0-9 (FR-AI-04). */
export function toWesternDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".") // Arabic decimal separator
    .replace(/٬/g, ","); // Arabic thousands separator
}
