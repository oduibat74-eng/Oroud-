import { describe, expect, it } from "vitest";
import {
  ammanToday,
  canonicalInstagramPermalink,
  discountPct,
  endOfAmmanDayUtc,
  normalizeArabic,
  normalizeInstagramUsername,
  toWesternDigits,
} from "./index.ts";

describe("normalizeArabic", () => {
  it("unifies alef, yaa and taa marbuta variants", () => {
    expect(normalizeArabic("أحذية")).toBe(normalizeArabic("احذيه"));
    expect(normalizeArabic("مستشفى")).toBe(normalizeArabic("مستشفي"));
    expect(normalizeArabic("إكسسوارات")).toBe("اكسسوارات");
  });

  it("removes diacritics and tatweel", () => {
    expect(normalizeArabic("عَرْضٌ")).toBe("عرض");
    expect(normalizeArabic("عـــروض")).toBe("عروض");
  });

  it("lowercases mixed English and collapses spaces", () => {
    expect(normalizeArabic("  SALE   خصم ")).toBe("sale خصم");
  });
});

describe("toWesternDigits", () => {
  it("converts Arabic-Indic digits", () => {
    expect(toWesternDigits("٢١ دينار بدل ٣٠")).toBe("21 دينار بدل 30");
    expect(toWesternDigits("۱۵")).toBe("15");
    expect(toWesternDigits("٢٫٥")).toBe("2.5");
  });
});

describe("discountPct", () => {
  it("computes a whole-number discount", () => {
    expect(discountPct(21, 30)).toBe(30);
    expect(discountPct(9.99, 14.99)).toBe(33);
  });
  it("returns null when there is no real discount", () => {
    expect(discountPct(30, 30)).toBeNull();
    expect(discountPct(35, 30)).toBeNull();
    expect(discountPct(10, 0)).toBeNull();
  });
});

describe("Amman time", () => {
  it("uses the Amman date, not the UTC date", () => {
    // 22:30 UTC on Nov 17 is 01:30 on Nov 18 in Amman.
    expect(ammanToday(new Date("2026-11-17T22:30:00Z"))).toBe("2026-11-18");
  });
  it("ends an offer at 23:59:59 Amman time", () => {
    expect(endOfAmmanDayUtc("2026-11-30").toISOString()).toBe("2026-11-30T20:59:59.000Z");
  });
});

describe("normalizeInstagramUsername", () => {
  it.each([
    ["@Shoe.Store_jo", "shoe.store_jo"],
    ["https://www.instagram.com/shoe.store_jo/?igsh=abc123", "shoe.store_jo"],
    ["instagram.com/shoe.store_jo", "shoe.store_jo"],
    ["shoe.store_jo/", null],
    ["https://www.instagram.com/p/C1234abc/", null],
    ["not a username!", null],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeInstagramUsername(input)).toBe(expected);
  });
});

describe("canonicalInstagramPermalink", () => {
  it("strips tracking params and the username prefix", () => {
    expect(canonicalInstagramPermalink("https://instagram.com/reels/DAbc_12-x/?igsh=zz")).toBe(
      "https://www.instagram.com/reel/DAbc_12-x/",
    );
    expect(canonicalInstagramPermalink("https://www.instagram.com/shop/p/XYZ/")).toBe(
      "https://www.instagram.com/p/XYZ/",
    );
  });
  it("rejects non-Instagram links", () => {
    expect(canonicalInstagramPermalink("https://facebook.com/p/XYZ")).toBeNull();
  });
});
