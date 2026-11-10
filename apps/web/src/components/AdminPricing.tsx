import { useEffect, useState } from "react";
import { fmtDateTime, formatZar, planById, saleActive, type PlanPricing } from "@yir/shared";
import { api, ApiError } from "../lib/api";
import { setPricing } from "../lib/pricing";
import { Button } from "./Button";
import { Field } from "./Field";

/** ISO time <-> the value a datetime-local input wants, in the browser's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

/** Admin "Pricing" tab: each plan's standard price and any sale, as shown on the home page and at checkout. */
export function AdminPricing({ notify }: { notify: (s: string) => void }) {
  const [prices, setPrices] = useState<PlanPricing[] | null>(null);
  useEffect(() => {
    api<PlanPricing[]>("/api/admin/pricing")
      .then(setPrices)
      .catch((err) => notify(err instanceof Error ? err.message : "Prices didn't load."));
  }, [notify]);

  return (
    <div id="panel-pricing" role="tabpanel" aria-labelledby="tab-pricing">
      <p className="muted admin__lede">
        Changes show on the home page and at checkout within a minute, and new orders are charged the price showing at the time. A sale shows the standard price struck through,
        with its label and end date, and ends by itself at the end time.
      </p>
      {!prices ? (
        <p className="label muted">Loading prices...</p>
      ) : (
        <div className="pricing-admin">
          {prices.map((p) => (
            <PlanPriceForm
              key={p.planId}
              price={p}
              onSaved={(next) => {
                const list = prices.map((x) => (x.planId === next.planId ? next : x));
                setPrices(list);
                setPricing(list); // the rest of the site picks it up straight away
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanPriceForm({ price, onSaved }: { price: PlanPricing; onSaved: (p: PlanPricing) => void }) {
  const fromPrice = (p: PlanPricing) => ({
    priceZar: String(p.priceZar),
    sale: p.salePriceZar !== null,
    salePriceZar: p.salePriceZar === null ? "" : String(p.salePriceZar),
    saleLabel: p.saleLabel ?? "",
    saleEndsAt: toLocalInput(p.saleEndsAt),
  });
  const [f, setF] = useState(() => fromPrice(price));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setF(fromPrice(price)), [price]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<typeof f>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  };
  const id = (k: string) => `pr-${price.planId}-${k}`;
  const live = saleActive(price);
  const ended = price.salePriceZar !== null && !live;

  const save = async () => {
    const e: Record<string, string> = {};
    const std = Number(f.priceZar);
    const sale = Number(f.salePriceZar);
    if (!f.priceZar || !Number.isInteger(std) || std < 1) e.priceZar = "Use a whole number of rand.";
    if (f.sale) {
      if (!f.salePriceZar || !Number.isInteger(sale) || sale < 1) e.salePriceZar = "Use a whole number of rand.";
      else if (sale >= std) e.salePriceZar = "Make it lower than the standard price.";
      if (f.saleEndsAt && new Date(f.saleEndsAt).getTime() <= Date.now()) e.saleEndsAt = "Pick a time in the future, or leave it blank.";
    }
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) return document.getElementById(id(first))?.focus();
    setBusy(true);
    try {
      const next = await api<PlanPricing>(`/api/admin/pricing/${price.planId}`, {
        method: "PUT",
        json: {
          priceZar: std,
          salePriceZar: f.sale ? sale : null,
          saleLabel: f.sale ? f.saleLabel.trim() || null : null,
          saleEndsAt: f.sale && f.saleEndsAt ? new Date(f.saleEndsAt).toISOString() : null,
        },
      });
      onSaved(next);
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setErrors({ [err.field]: err.message });
        document.getElementById(id(err.field))?.focus();
      } else setErrors({ form: err instanceof Error ? err.message : "That didn't save. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="panel pricing-admin__plan"
      noValidate
      aria-labelledby={id("title")}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 id={id("title")}>{planById(price.planId).name}</h3>
        {live ? <span className="chip chip--new">On sale</span> : ended ? <span className="chip chip--hidden">Sale ended</span> : <span className="chip chip--approved">Standard</span>}
      </div>
      <p className="pricing-admin__now">
        Showing now: <strong>{formatZar(live ? price.salePriceZar! : price.priceZar)}</strong>
        {live && <s className="muted"> {formatZar(price.priceZar)}</s>}
        {live && price.saleEndsAt && <span className="muted small"> until {fmtDateTime(new Date(price.saleEndsAt))}</span>}
      </p>
      <Field id={id("priceZar")} label="Standard price (rand)" inputMode="numeric" value={f.priceZar} onChange={(e) => set({ priceZar: e.target.value.replace(/\D/g, "") })} error={errors.priceZar} />
      <label className="admin__check">
        <input type="checkbox" checked={f.sale} onChange={(e) => set({ sale: e.target.checked })} /> Run a sale
      </label>
      {f.sale && (
        <>
          <Field id={id("salePriceZar")} label="Sale price (rand)" inputMode="numeric" value={f.salePriceZar} onChange={(e) => set({ salePriceZar: e.target.value.replace(/\D/g, "") })} error={errors.salePriceZar} />
          <Field id={id("saleLabel")} label="Label (optional)" hint={'Shown on the price card. Blank shows "Sale".'} limit={40} placeholder="e.g. Launch special" value={f.saleLabel} onChange={(e) => set({ saleLabel: e.target.value })} error={errors.saleLabel} />
          <Field id={id("saleEndsAt")} type="datetime-local" label="Ends (optional)" hint="Blank runs the sale until you turn it off." value={f.saleEndsAt} onChange={(e) => set({ saleEndsAt: e.target.value })} error={errors.saleEndsAt} />
        </>
      )}
      {errors.form && (
        <p className="field__err" role="alert">
          {errors.form}
        </p>
      )}
      <div className="row row--end">
        {saved && (
          <span className="muted small" role="status">
            Saved and live.
          </span>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving..." : "Save price"}
        </Button>
      </div>
    </form>
  );
}
