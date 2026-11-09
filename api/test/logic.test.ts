import { describe, expect, it } from "vitest";
import { randomId, randomToken, RESERVED_SLUGS, safeEqual, sha256Hex, slugFor } from "../src/lib/ids";
import { verifyPaystackSignature } from "../src/lib/paystack";
import { songDestination } from "../src/lib/songlink";
import { checkCloseAt, closeDate, defaultClose, isOpen, latestClose, minPartyDate, printRun } from "../src/lib/timeline";
import { bornYear, email, Invalid, link, longText, pastDate, text } from "../src/lib/validate";

// Party on Saturday 19 Dec 2026. 9 days before is Thu 10 Dec, and the Tuesday print run on or before that is 8 Dec.
const PARTY = "2026-12-19";

describe("timeline (SAST)", () => {
  it("finds the Tuesday print run on or before party minus 9 days", () => {
    expect(printRun(PARTY).toISOString().slice(0, 10)).toBe("2026-12-08");
  });
  it("suggests closing 4 days before print, at 23:59 South African time", () => {
    expect(defaultClose(PARTY, true).toISOString()).toBe("2026-12-04T21:59:00.000Z");
  });
  it("allows closing up to 2 days before print", () => {
    expect(latestClose(PARTY, true).toISOString()).toBe("2026-12-06T21:59:00.000Z");
  });
  it("gives Digital tapes until the day before the party", () => {
    expect(latestClose(PARTY, false).toISOString()).toBe("2026-12-18T21:59:00.000Z");
  });
  it("uses the organiser's close time when set", () => {
    expect(closeDate(PARTY, true, "2026-12-01T10:00:00.000Z").toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
  it("rejects a close time in the past or past the latest", () => {
    const now = Date.parse("2026-11-09T10:00:00Z");
    expect(checkCloseAt("2026-11-01T10:00:00Z", PARTY, true, now)).toMatch(/future/);
    expect(checkCloseAt("2026-12-07T10:00:00Z", PARTY, true, now)).toMatch(/too late/);
    expect(checkCloseAt("2026-12-03T10:00:00Z", PARTY, true, now)).toBeNull();
  });
  it("is open only while collecting and before the close", () => {
    const tape = { party_date: PARTY, plan_id: "boxed", close_at: null, status: "collecting" };
    expect(isOpen(tape, Date.parse("2026-12-01T00:00:00Z"))).toBe(true);
    expect(isOpen(tape, Date.parse("2026-12-05T00:00:00Z"))).toBe(false);
    expect(isOpen({ ...tape, status: "curating" }, Date.parse("2026-12-01T00:00:00Z"))).toBe(false);
  });
  it("needs three weeks for printed tapes and five days for Digital", () => {
    const now = Date.parse("2026-11-09T10:00:00Z");
    expect(minPartyDate(true, now)).toBe("2026-11-30");
    expect(minPartyDate(false, now)).toBe("2026-11-14");
  });
});

describe("ids and tokens", () => {
  it("makes readable random ids", () => {
    const id = randomId();
    expect(id).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]{12}$/);
    expect(randomId()).not.toBe(id);
  });
  it("makes 256-bit url-safe tokens", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("hashes and compares in constant time", async () => {
    const h = await sha256Hex("abc");
    expect(h).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(safeEqual(h, h)).toBe(true);
    expect(safeEqual(h, h.replace(/.$/, "0"))).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
  it("builds share slugs and avoids reserved paths", () => {
    expect(slugFor("Nandi", "turns 30")).toBe("nandi30");
    expect(slugFor("Zoë-Mae", "is retiring")).toBe("zoemae");
    expect(slugFor("Admin", "")).toBe("admin-tape");
    for (const s of RESERVED_SLUGS) expect(slugFor(s, "")).not.toBe(s);
  });
});

describe("validation", () => {
  it("trims and limits text", () => {
    expect(text("  hi\u0007 ", "x", 10)).toBe("hi");
    expect(() => text("", "x", 10)).toThrow(Invalid);
    expect(() => text("a".repeat(11), "x", 10)).toThrow(/10 characters/);
  });
  it("keeps line breaks in liner notes", () => {
    expect(longText("one\r\ntwo", "m", 50)).toBe("one\ntwo");
  });
  it("checks emails", () => {
    expect(email(" Kabelo@Example.com ")).toBe("kabelo@example.com");
    expect(() => email("nope")).toThrow(Invalid);
  });
  it("accepts only web links, or nothing", () => {
    expect(link("", "link")).toBeNull();
    expect(link("https://open.example.com/track/1", "link")).toBe("https://open.example.com/track/1");
    expect(() => link("javascript:alert(1)", "link")).toThrow(Invalid);
    expect(() => link("not a link", "link")).toThrow(/https/);
  });
  it("refuses meeting dates in the future", () => {
    expect(pastDate("2008-02-02", "since")).toBe("2008-02-02");
    expect(() => pastDate("2999-01-01", "since")).toThrow(/future/);
  });
  it("needs a sensible birth year", () => {
    expect(bornYear(1996)).toBe(1996);
    expect(() => bornYear(undefined)).toThrow(Invalid);
    expect(() => bornYear(1800)).toThrow(Invalid);
  });
});

describe("QR destination", () => {
  const base = { song: "Dreams", artist: "Fleetwood Mac" };
  it("prefers the resolved song.link page, then the friend's link, then a search", () => {
    expect(songDestination({ ...base, song_page_url: "https://song.link/x", link: "https://a.example/1" })).toBe("https://song.link/x");
    expect(songDestination({ ...base, song_page_url: null, link: "https://a.example/1" })).toBe("https://a.example/1");
    expect(songDestination({ ...base, song_page_url: null, link: null })).toContain("Fleetwood%20Mac%20Dreams");
  });
});

describe("Paystack signatures", () => {
  it("accepts the right HMAC-SHA512 and refuses others", async () => {
    const body = '{"event":"charge.success"}';
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("sk_test"), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
    const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect(await verifyPaystackSignature(body, sig, "sk_test")).toBe(true);
    expect(await verifyPaystackSignature(body, sig, "sk_other")).toBe(false);
    expect(await verifyPaystackSignature(body, undefined, "sk_test")).toBe(false);
  });
});
