import type { Plan } from "../data/types";
import { formatZar } from "../data/plans";
import { Button } from "./Button";
import "./PricingCard.css";

export function PricingCard({ plan, onChoose }: { plan: Plan; onChoose?: (plan: Plan) => void }) {
  return (
    <article className={`plan ${plan.featured ? "plan--featured" : ""}`} aria-labelledby={`plan-${plan.id}`}>
      {plan.featured && <span className="plan__badge label">Most chosen</span>}
      <h3 id={`plan-${plan.id}`}>{plan.name}</h3>
      <p className="plan__tag">{plan.tagline}</p>
      <p className="plan__price">
        <span>{formatZar(plan.priceZar)}</span> once-off
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
