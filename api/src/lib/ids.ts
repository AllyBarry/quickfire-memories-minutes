/** Ids and secrets. Everything comes from crypto.getRandomValues. */

// no 0/o/1/l/i, so ids read clearly if someone types a QR link by hand
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";

/** A random id. 12 chars of a 31-letter alphabet is about 59 bits: not guessable, still short in a QR code. */
export function randomId(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** A 256-bit secret as base64url, e.g. a friend's private edit token. */
export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two strings of equal length. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Paths a share-link slug must never take, because the web app or Pages uses them. */
export const RESERVED_SLUGS = new Set(["api", "go", "admin", "organiser", "start", "demo", "checkout", "assets", "privacy", "terms", "about", "help"]);

/** A readable share-link slug from the honoree's name and occasion, e.g. "nandi30". Uniqueness is checked by the caller. */
export function slugFor(honoree: string, occasion: string) {
  const name = honoree
    .normalize("NFKD")
    .replace(/[^\w]/g, "")
    .toLowerCase()
    .slice(0, 14);
  const digits = occasion.replace(/\D/g, "").slice(0, 3);
  const slug = (name || "tape") + digits;
  return RESERVED_SLUGS.has(slug) ? `${slug}-tape` : slug;
}
