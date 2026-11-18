import { discountPct } from "@oroud/shared";
import type { ExtractionOutput, SourceKind } from "./schema.ts";

export interface Thresholds {
  /** Minimum is_offer confidence to auto-publish ingested offers (FR-AI-05). */
  isOffer: number;
  /** Minimum price or discount confidence to auto-publish ingested offers. */
  priceOrDiscount: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { isOffer: 0.9, priceOrDiscount: 0.8 };

export interface ProcessedExtraction extends ExtractionOutput {
  /** Set when the stated discount and the one computed from prices differ by more than 2 points. */
  discount_mismatch: boolean;
}

/** FR-AI-03: compute the discount server-side when both prices exist and flag mismatches. */
export function postProcess(raw: ExtractionOutput): ProcessedExtraction {
  const out: ProcessedExtraction = { ...raw, discount_mismatch: false };
  if (out.price !== null && out.was_price !== null) {
    const computed = discountPct(out.price, out.was_price);
    if (computed !== null) {
      if (out.discount_pct !== null && Math.abs(out.discount_pct - computed) > 2) {
        out.discount_mismatch = true;
      }
      out.discount_pct = computed;
    }
  }
  if (out.ends_at === null) out.end_date_basis = "none";
  return out;
}

export type Decision =
  | { action: "discard"; reason: string }
  | { action: "review"; reason: string }
  | { action: "confirm_with_shop" }
  | { action: "publish" };

/** FR-AI-05, FR-AI-06 and FR-IG-03: what happens to an extraction. */
export function decide(
  result: ProcessedExtraction,
  source: SourceKind,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Decision {
  if (!result.is_offer) {
    // Instagram imports that aren't offers are dropped; anything a person sent gets a look.
    return source.startsWith("instagram_")
      ? { action: "discard", reason: "not_offer" }
      : { action: "review", reason: "not_offer" };
  }
  if (result.restricted.length > 0) return { action: "review", reason: "restricted_item" };
  if (source === "whatsapp_shop" || source === "link_shop") return { action: "confirm_with_shop" };
  if (source === "admin") return { action: "review", reason: "admin_entry" };
  if (source === "link_buyer" || source === "instagram_mention") {
    return { action: "review", reason: "needs_review_source" };
  }

  const priceConfident =
    Math.max(result.confidence.price, result.confidence.discount) >= thresholds.priceOrDiscount;
  if (result.confidence.is_offer >= thresholds.isOffer && priceConfident && !result.discount_mismatch) {
    return { action: "publish" };
  }
  return { action: "review", reason: "low_confidence" };
}
