import { describe, expect, it } from "vitest";
import { decide, postProcess } from "./postprocess.ts";
import type { ExtractionOutput } from "./schema.ts";

function offer(overrides: Partial<ExtractionOutput> = {}): ExtractionOutput {
  return {
    is_offer: true,
    title_en: "Sports shoes 30% off",
    title_ar: "خصم 30% على الأحذية الرياضية",
    category: "shoes",
    price: 21,
    was_price: 30,
    discount_pct: 30,
    currency: "JOD",
    branch_hint: "Khalda",
    starts_at: "2026-11-17",
    ends_at: "2026-11-30",
    end_date_basis: "stated",
    restricted: [],
    confidence: { is_offer: 0.97, price: 0.9, discount: 0.9, ends_at: 0.85, category: 0.95 },
    ...overrides,
  };
}

describe("postProcess", () => {
  it("computes the discount from prices", () => {
    expect(postProcess(offer({ discount_pct: null })).discount_pct).toBe(30);
  });
  it("flags a stated discount that doesn't match the prices", () => {
    const out = postProcess(offer({ discount_pct: 50 }));
    expect(out.discount_mismatch).toBe(true);
    expect(out.discount_pct).toBe(30);
  });
  it("marks a missing end date as none", () => {
    expect(postProcess(offer({ ends_at: null, end_date_basis: "inferred" })).end_date_basis).toBe("none");
  });
});

describe("decide", () => {
  it("auto-publishes a confident Instagram offer", () => {
    expect(decide(postProcess(offer()), "instagram_connected")).toEqual({ action: "publish" });
  });
  it("sends a low-confidence Instagram offer to review", () => {
    const low = offer({ confidence: { is_offer: 0.7, price: 0.9, discount: 0.9, ends_at: 0.8, category: 0.9 } });
    expect(decide(postProcess(low), "instagram_discovery")).toEqual({ action: "review", reason: "low_confidence" });
  });
  it("discards Instagram posts that aren't offers", () => {
    expect(decide(postProcess(offer({ is_offer: false })), "instagram_connected").action).toBe("discard");
  });
  it("never auto-publishes restricted items", () => {
    expect(decide(postProcess(offer({ restricted: ["tobacco"] })), "instagram_connected")).toEqual({
      action: "review",
      reason: "restricted_item",
    });
  });
  it("asks the shop to confirm WhatsApp drafts", () => {
    expect(decide(postProcess(offer()), "whatsapp_shop")).toEqual({ action: "confirm_with_shop" });
  });
  it("reviews buyer-shared links", () => {
    expect(decide(postProcess(offer()), "link_buyer").action).toBe("review");
  });
});
