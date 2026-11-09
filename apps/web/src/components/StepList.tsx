import type { ReactNode } from "react";
import "./StepList.css";

export interface Step {
  title: string;
  body: ReactNode;
  visual?: ReactNode;
}

/** A real sequence, so the steps are numbered like tracks. */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li key={s.title} className="steps__item">
          <span className="steps__num label" aria-hidden="true">
            Step {i + 1}
          </span>
          {s.visual && <div className="steps__visual">{s.visual}</div>}
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
