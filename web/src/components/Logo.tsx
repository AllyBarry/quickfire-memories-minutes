import "./Logo.css";

/** The mark: a cassette reduced to its two reels. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg className="logo__mark" width={size} height={size * 0.68} viewBox="0 0 50 34" aria-hidden="true">
      <rect x="1" y="1" width="48" height="32" rx="5" style={{ fill: "var(--text)" }} />
      <rect x="9" y="10" width="32" height="14" rx="7" style={{ fill: "var(--bg)" }} />
      <circle cx="17" cy="17" r="4.5" style={{ fill: "var(--pop)" }} />
      <circle cx="33" cy="17" r="4.5" style={{ fill: "var(--pop)" }} />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo__word">
        Years in
        <br />
        Rotation
      </span>
    </span>
  );
}
