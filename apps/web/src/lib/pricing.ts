import { useEffect, useState } from "react";
import { currentPrice, DEFAULT_PRICING, saleActive, type PlanPricing } from "@yir/shared";
import { api } from "./api";

/**
 * Advertised prices, shared by every page that shows them. Starts from the built-in prices so a price is never
 * blank (and the one-file demo, which has no API, keeps them), fetches once per page load, and updates every
 * page straight away when staff save a change in the admin Pricing tab.
 */
let cache: PlanPricing[] = DEFAULT_PRICING;
let fetched: Promise<void> | null = null;
const listeners = new Set<(p: PlanPricing[]) => void>();

export function setPricing(next: PlanPricing[]) {
  cache = next;
  listeners.forEach((l) => l(next));
}

function fetchOnce() {
  fetched ??= api<PlanPricing[]>("/api/public/pricing").then(
    (p) => {
      if (Array.isArray(p) && p.length) setPricing(p);
    },
    () => {
      fetched = null; // keep the built-in prices and try again on the next page that asks
    },
  );
  return fetched;
}

export function usePricing(): PlanPricing[] {
  const [prices, setPrices] = useState(cache);
  useEffect(() => {
    listeners.add(setPrices);
    setPrices(cache);
    void fetchOnce();
    return () => {
      listeners.delete(setPrices);
    };
  }, []);
  return prices;
}

export interface PriceInfo {
  /** what it costs right now */
  now: number;
  /** the standard price while a sale runs, otherwise null */
  was: number | null;
  label: string | null;
  endsAt: string | null;
}

export function priceInfo(prices: PlanPricing[], planId: string): PriceInfo {
  const p = prices.find((x) => x.planId === planId) ?? DEFAULT_PRICING.find((x) => x.planId === planId) ?? DEFAULT_PRICING[1];
  const on = saleActive(p);
  return { now: currentPrice(p), was: on ? p.priceZar : null, label: on ? p.saleLabel : null, endsAt: on ? p.saleEndsAt : null };
}

/** Today's price and sale details for one plan, kept up to date. */
export const usePrice = (planId: string) => priceInfo(usePricing(), planId);

/** "Ends 30 Nov" in South African time. */
export const saleEnds = (iso: string) => `Ends ${new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", timeZone: "Africa/Johannesburg" })}`;
