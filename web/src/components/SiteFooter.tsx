import { Logo } from "./Logo";
import { flowLinks } from "../data/flowLinks";
import "./SiteFooter.css";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__inner">
        <Logo />
        <nav aria-label="Site" className="site-footer__links">
          <a href="/start">Start a tape</a>
          <a href="/organiser">Organiser sign in</a>
          <a href="/#faq">Questions</a>
        </nav>
        <nav aria-label="Demo pages" className="site-footer__links site-footer__demo">
          <span className="label">Try the demo</span>
          {flowLinks.map((f) => (
            <a key={f.href} href={f.href}>
              {f.title}
            </a>
          ))}
        </nav>
        <p className="site-footer__small">
          Songs are linked to the official releases on each music service, never copied or hosted here. Made in South Africa.
        </p>
      </div>
    </footer>
  );
}
