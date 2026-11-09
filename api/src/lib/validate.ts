/** Small hand-rolled validators: no schema library, every limit stated once here. */

export const LIMITS = {
  name: 60,
  contributor: 40,
  tagline: 28,
  song: 60,
  artist: 60,
  link: 500,
  message: 320,
  honoree: 14,
  occasion: 40,
  photoBytes: 600 * 1024, // the web app sends a ~420 px JPEG, usually under 80 KB
} as const;

// Keep these in step with web/src/data/plans.ts and web/src/data/inks.ts.
export const PLANS = ["digital", "boxed", "double"] as const;
export const INKS = ["night-neon", "forest-tangerine", "oxblood-sky", "graphite-sunflower"] as const;
export const PLAN_PRICE_ZAR: Record<(typeof PLANS)[number], number> = { digital: 349, boxed: 899, double: 1299 };
export const PLAN_TRACKS: Record<(typeof PLANS)[number], number> = { digital: 40, boxed: 40, double: 80 };

export class Invalid extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
  }
}

/** Trim, strip control characters, enforce a max length. */
export function text(value: unknown, field: string, max: number, { required = true } = {}) {
  const s = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
  if (required && !s) throw new Invalid(field, `${field} is required.`);
  if (s.length > max) throw new Invalid(field, `${field} must be ${max} characters or fewer.`);
  return s;
}

/** Multi-line text: keeps line breaks, strips other control characters. */
export function longText(value: unknown, field: string, max: number, { required = true } = {}) {
  const s = typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim() : "";
  if (required && !s) throw new Invalid(field, `${field} is required.`);
  if (s.length > max) throw new Invalid(field, `${field} must be ${max} characters or fewer.`);
  return s;
}

export function email(value: unknown, field = "email") {
  const s = text(value, field, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new Invalid(field, "Enter a valid email address.");
  return s;
}

export function isoDate(value: unknown, field: string) {
  const s = text(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) throw new Invalid(field, `${field} must be YYYY-MM-DD.`);
  return s;
}

/** A date in the past or today (SAST is close enough to UTC for a "when did you meet" date). */
export function pastDate(value: unknown, field: string) {
  const s = isoDate(value, field);
  if (s > new Date(Date.now() + 2 * 36e5).toISOString().slice(0, 10)) throw new Invalid(field, `${field} can't be in the future.`);
  if (s < "1900-01-01") throw new Invalid(field, `${field} is too far back.`);
  return s;
}

/** An optional http(s) link, or null. */
export function link(value: unknown, field: string) {
  const s = text(value, field, LIMITS.link, { required: false });
  if (!s) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Invalid(field, "Paste the full link, starting with https://, or leave it empty.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Invalid(field, "Only web links are allowed.");
  return u.toString();
}

export function oneOf<T extends readonly string[]>(value: unknown, field: string, options: T): T[number] {
  if (typeof value !== "string" || !options.includes(value)) throw new Invalid(field, `${field} must be one of: ${options.join(", ")}.`);
  return value as T[number];
}

export function intInRange(value: unknown, field: string, min: number, max: number, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Invalid(field, `${field} must be between ${min} and ${max}.`);
  return n;
}

export function bornYear(value: unknown, field = "bornYear") {
  const max = new Date().getUTCFullYear();
  const n = Number(value);
  if (value === undefined || value === null || value === "" || !Number.isInteger(n) || n < 1910 || n > max) {
    throw new Invalid(field, `${field} must be a year between 1910 and ${max}.`);
  }
  return n;
}
