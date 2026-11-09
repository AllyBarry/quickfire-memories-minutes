import "./Cassette.css";

interface Props {
  /** Handwritten text on the label. */
  label: string;
  side?: string;
  /** Three-digit tape counter. */
  counter?: string;
  /** 0 at the start of the tape, 1 at the end. Moves tape from the left reel to the right. */
  progress?: number;
  spinning?: boolean;
  className?: string;
  title?: string;
}

/** The cassette, drawn in the two inks. Reels spin while a track is being cued. */
export function Cassette({ label, side = "A", counter = "000", progress = 0, spinning = false, className = "", title }: Props) {
  const p = Math.min(1, Math.max(0, progress));
  const rL = 40 - 20 * p;
  const rR = 20 + 20 * p;
  const long = label.length > 24;
  return (
    <svg className={`cassette ${spinning ? "is-spinning" : ""} ${className}`} viewBox="0 0 520 330" role="img" aria-label={title ?? `Cassette labelled ${label}, side ${side}`}>
      <rect className="cassette__shell" x="4" y="4" width="512" height="322" rx="18" />
      {[
        [24, 24],
        [496, 24],
        [24, 306],
        [496, 306],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} className="cassette__screw" cx={x} cy={y} r="5" />
      ))}
      <rect className="cassette__label" x="34" y="26" width="452" height="196" rx="8" />
      <rect className="cassette__stripe" x="34" y="58" width="452" height="10" />
      <text className="cassette__side" x="52" y="50">
        {side}
      </text>
      <text className="cassette__hand" x="90" y="52" {...(long ? { textLength: 330, lengthAdjust: "spacingAndGlyphs" } : {})}>
        {label}
      </text>
      <text className="cassette__counter" x="468" y="50" textAnchor="end">
        {counter}
      </text>
      <rect className="cassette__window" x="130" y="96" width="260" height="96" rx="48" />
      <circle className="cassette__wound" cx="186" cy="144" r={rL} />
      <circle className="cassette__wound" cx="334" cy="144" r={rR} />
      {[186, 334].map((cx) => (
        <g key={cx} className="cassette__reel">
          <circle className="cassette__hub" cx={cx} cy="144" r="18" />
          <line className="cassette__spoke" x1={cx} y1="130" x2={cx} y2="136" />
          <line className="cassette__spoke" x1={cx + 12} y1="151" x2={cx + 7} y2="148" />
          <line className="cassette__spoke" x1={cx - 12} y1="151" x2={cx - 7} y2="148" />
        </g>
      ))}
      <path className="cassette__label" d="M120 326 L140 262 H380 L400 326 Z" opacity="0.9" />
      <circle className="cassette__shell" cx="200" cy="296" r="9" />
      <circle className="cassette__shell" cx="320" cy="296" r="9" />
    </svg>
  );
}
