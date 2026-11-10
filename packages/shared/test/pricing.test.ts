import { describe, expect, it } from "vitest";
import { currentPrice, DEFAULT_PRICING, planById, saleActive, type PlanPricing } from "../src/plans";

describe("sale pricing", () => {
  const base: PlanPricing = { ...DEFAULT_PRICING[1], salePriceZar: 699, saleLabel: "Launch", saleEndsAt: null };
  it("starts from the plan prices with no sale", () => {
    expect(DEFAULT_PRICING.map((p) => p.priceZar)).toEqual([planById("digital").priceZar, planById("boxed").priceZar, planById("double").priceZar]);
    expect(DEFAULT_PRICING.every((p) => !saleActive(p))).toBe(true);
  });
  it("charges the sale price while a sale runs", () => {
    expect(saleActive(base)).toBe(true);
    expect(currentPrice(base)).toBe(699);
  });
  it("goes back to the standard price after the end time", () => {
    const ended = { ...base, saleEndsAt: "2026-01-01T00:00:00.000Z" };
    expect(currentPrice(ended, Date.parse("2026-02-01"))).toBe(base.priceZar);
  });
  it("ignores a sale price that isn't lower", () => {
    expect(currentPrice({ ...base, salePriceZar: base.priceZar })).toBe(base.priceZar);
  });
});
