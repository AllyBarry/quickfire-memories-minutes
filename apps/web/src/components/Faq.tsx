import "./Faq.css";

export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="faq">
      {items.map((item) => (
        <details key={item.q} className="faq__item">
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </div>
  );
}
