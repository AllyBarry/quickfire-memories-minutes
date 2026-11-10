import { currentPrice, DEFAULT_PRICING, PLAN_IDS, type PlanId, type PlanPricing } from "@yir/shared";
import type { Env } from "../env";

interface Row {
  plan_id: PlanId;
  price_zar: number;
  sale_price_zar: number | null;
  sale_label: string | null;
  sale_ends_at: string | null;
}

/** Advertised prices from the database, in plan order. A missing row falls back to the built-in price. */
export async function loadPricing(env: Env): Promise<PlanPricing[]> {
  const { results } = await env.DB.prepare("SELECT plan_id, price_zar, sale_price_zar, sale_label, sale_ends_at FROM plan_price").all<Row>();
  return PLAN_IDS.map((id) => {
    const r = results.find((x) => x.plan_id === id);
    if (!r) return DEFAULT_PRICING.find((d) => d.planId === id)!;
    return { planId: id, priceZar: r.price_zar, salePriceZar: r.sale_price_zar, saleLabel: r.sale_label, saleEndsAt: r.sale_ends_at };
  });
}

/** What a plan costs right now (the sale price while a sale runs). */
export async function priceNow(env: Env, planId: PlanId) {
  return currentPrice((await loadPricing(env)).find((x) => x.planId === planId)!);
}
