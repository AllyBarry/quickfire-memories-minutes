import { describe, expect, it } from "vitest";
import { checkCloseAt, closeDate, defaultClose, fmtDate, fmtTime, latestClose, minPartyDate, nextRun, printRun, sastDate, timeline, toSastInput } from "../src";

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
  it("needs three weeks for printed tapes and five days for Digital", () => {
    const now = Date.parse("2026-11-09T10:00:00Z");
    expect(minPartyDate(true, now)).toBe("2026-11-30");
    expect(minPartyDate(false, now)).toBe("2026-11-14");
  });
  it("reads a bare datetime-local value as South African time, wherever the browser is", () => {
    expect(closeDate(PARTY, true, "2026-12-03T18:00").toISOString()).toBe("2026-12-03T16:00:00.000Z");
    expect(toSastInput(new Date("2026-12-03T16:00:00Z"))).toBe("2026-12-03T18:00");
    expect(checkCloseAt("2026-12-06T23:59", PARTY, true, Date.parse("2026-11-09T10:00:00Z"))).toBeNull();
  });
  it("formats dates and times in South African time", () => {
    expect(fmtTime(new Date("2026-12-04T21:59:00Z"))).toBe("23:59");
    expect(fmtDate(new Date("2026-12-04T22:30:00Z"))).toMatch(/Sat.*5 Dec/);
  });
  it("finds the next Tuesday print run", () => {
    expect(sastDate(nextRun(Date.parse("2026-11-09T10:00:00Z")))).toBe("2026-11-10");
    expect(sastDate(nextRun(Date.parse("2026-11-10T10:00:00Z")))).toBe("2026-11-17");
  });
  it("lists the printed tape's milestones in order", () => {
    const dates = timeline(PARTY, true).map((m) => m.date.getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    expect(timeline(PARTY, false).map((m) => m.key)).toEqual(["close", "approve", "party"]);
  });
});
