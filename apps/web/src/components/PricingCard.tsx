import { formatZar, type Plan } from "@yir/shared";
import { saleEnds, usePrice } from "../lib/pricing";
import { Button } from "./Button";
import "./PricingCard.css";

export function PricingCard({ plan, onChoose }: { plan: Plan; onChoose?: (plan: Plan) => void }) {
  const price = usePrice(plan.id);
  const onSale = price.was !== null;
  return (
    <article className={`plan ${plan.featured ? "plan--featured" : ""} ${onSale ? "plan--sale" : ""}`} aria-labelledby={`plan-${plan.id}`}>
      {plan.featured && <span className="plan__badge label">Most chosen</span>}
      <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
      <p className="plan__tag">{plan.tagline}</p>
      {onSale && (
        <p className="plan__sale">
          <span className="plan__sale-pill label">{price.label || "Sale"}</span>
          {price.endsAt && <span className="plan__sale-ends">{saleEnds(price.endsAt)}</span>}
        </p>
      )}
      <p className="plan__price">
        {onSale && (
          <s className="plan__was">
            <span className="sr-only">Was </span>
            {formatZar(price.was!)}
          </s>
        )}
        <span>
          {onSale && <span className="sr-only">now </span>}
          {formatZar(price.now)}
        </span>{" "}
        once-off
      </p>
      <ul>
        {plan.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <Button variant={plan.featured ? "pop" : "ghost"} onClick={() => onChoose?.(plan)}>
        {plan.cta}
      </Button>
    </article>
  );
}

/** A price with the standard price struck through while a sale runs, for option lists and summaries. */
export function Price({ planId }: { planId: string }) {
  const price = usePrice(planId);
  return (
    <>
      {formatZar(price.now)}
      {price.was !== null && (
        <>
          {" "}
          <s className="price__was">
            <span className="sr-only">was </span>
            {formatZar(price.was)}
          </s>
        </>
      )}
    </>
  );
}
