import { Logo } from "./Logo";
import { Button } from "./Button";
import "./SiteHeader.css";

export function SiteHeader({ path }: { path: string }) {
  const inDemo = path.startsWith("/demo");
  const inOrganiser = path.startsWith("/organiser");
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <a href="/" className="site-header__home" aria-label="Years in Rotation home">
          <Logo />
        </a>
        <nav aria-label="Main">
          <a href="/#how" aria-current={path === "/" ? "page" : undefined}>
            How it works
          </a>
          <a href="/#listen">Sample tape</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#flow" aria-current={inDemo ? "page" : undefined}>
            Demo
          </a>
          <a href="/organiser" aria-current={inOrganiser ? "page" : undefined}>
            Sign in
          </a>
        </nav>
        <Button href="/start" className="site-header__cta">
          Start a tape
        </Button>
      </div>
    </header>
  );
}
