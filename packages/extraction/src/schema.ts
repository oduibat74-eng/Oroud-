import { z } from "zod";

/** Category slugs the model may choose from. Kept in sync with the categories table. */
export const CATEGORY_SLUGS = [
  "fashion",
  "shoes",
  "beauty",
  "electronics",
  "home",
  "groceries",
  "restaurants",
  "cafes",
  "health",
  "kids",
  "sports",
  "services",
  "other",
] as const;

/** Items that are never auto-published (FR-AI-06). */
export const RESTRICTED_FLAGS = [
  "tobacco",
  "alcohol",
  "weapons",
  "medicines",
  "adult",
  "counterfeit",
] as const;

const confidence = z.number().min(0).max(1);

/**
 * What the model returns (spec section 6). Every field missing from the source is null:
 * the model must never invent prices or dates.
 */
export const ExtractionOutputSchema = z.object({
  is_offer: z.boolean(),
  /** "deal": a discount or special price. "listing": an item for sale at a plain price. */
  kind: z.enum(["deal", "listing"]).nullable(),
  title_en: z.string().nullable(),
  title_ar: z.string().nullable(),
  category: z.enum(CATEGORY_SLUGS).nullable(),
  price: z.number().nullable(),
  was_price: z.number().nullable(),
  discount_pct: z.number().nullable(),
  currency: z.literal("JOD"),
  branch_hint: z.string().nullable(),
  starts_at: z.string().nullable().describe("YYYY-MM-DD in Asia/Amman"),
  ends_at: z.string().nullable().describe("YYYY-MM-DD in Asia/Amman"),
  end_date_basis: z.enum(["stated", "inferred", "none"]),
  restricted: z.array(z.enum(RESTRICTED_FLAGS)),
  confidence: z.object({
    is_offer: confidence,
    price: confidence,
    discount: confidence,
    ends_at: confidence,
    category: confidence,
  }),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

/** Where the extraction came from; drives the publish rules in FR-AI-05. */
export type SourceKind =
  | "whatsapp_shop" // a known shop's own WhatsApp number
  | "instagram_connected"
  | "instagram_discovery"
  | "instagram_mention"
  | "link_shop"
  | "link_buyer"
  | "admin";

export interface ExtractionInput {
  /** Caption or message text (Arabic, English or mixed). */
  text: string;
  /** Up to 4 images (WhatsApp photos or screenshots). */
  images?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string }[];
  /** Defaults to now; used to resolve relative dates in Asia/Amman. */
  now?: Date;
  shopBranches?: string[];
}
