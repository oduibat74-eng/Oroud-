/**
 * FR-OB-01: accept any Instagram link or @username and normalise it to the username.
 * Instagram usernames: letters, digits, periods and underscores, at most 30 characters.
 */

const USERNAME = /^[a-z0-9._]{1,30}$/;
const RESERVED_PATHS = new Set(["p", "reel", "reels", "stories", "explore", "tv", "accounts"]);

export function normalizeInstagramUsername(input: string): string | null {
  let value = input.trim();
  if (!value) return null;

  if (/instagram\.com|instagr\.am/i.test(value)) {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      return null;
    }
    const first = url.pathname.split("/").filter(Boolean)[0];
    if (!first || RESERVED_PATHS.has(first.toLowerCase())) return null;
    value = first;
  }

  value = value.replace(/^@/, "").toLowerCase();
  if (!USERNAME.test(value) || value.startsWith(".") || value.endsWith(".")) return null;
  return value;
}

/** Instagram post or reel permalink -> canonical form, used for deduplication (FR-LK-04). */
export function canonicalInstagramPermalink(input: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/(?:[^/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const kind = match[1] === "reels" ? "reel" : match[1];
    return `https://www.instagram.com/${kind}/${match[2]}/`;
  } catch {
    return null;
  }
}
