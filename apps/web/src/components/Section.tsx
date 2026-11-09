import type { ReactNode } from "react";
import "./Section.css";

interface Props {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  intro?: ReactNode;
  tone?: "plain" | "sunk" | "ink";
  children: ReactNode;
}

export function Section({ id, eyebrow, title, intro, tone = "plain", children }: Props) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className={`section section--${tone}`} aria-labelledby={headingId}>
      <div className="wrap">
        <header className="section__head">
          {eyebrow && <p className="section__eyebrow label">{eyebrow}</p>}
          <h2 id={headingId}>{title}</h2>
          {intro && <p className="section__intro">{intro}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}
