import { useMemo } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  fg?: string;
  bg?: string;
  className?: string;
  title?: string;
}

/** A real, scannable QR code drawn as one SVG path so it can take the ink colours. */
export function QrCode({ value, fg = "currentColor", bg = "transparent", className, title }: Props) {
  const { size, d } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    let path = "";
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) path += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { size: n, d: path };
  }, [value]);
  const quiet = 2;
  return (
    <svg className={className} viewBox={`${-quiet} ${-quiet} ${size + quiet * 2} ${size + quiet * 2}`} shapeRendering="crispEdges" role="img" aria-label={title ?? `QR code for ${value}`}>
      <rect x={-quiet} y={-quiet} width={size + quiet * 2} height={size + quiet * 2} fill={bg} />
      <path d={d} fill={fg} />
    </svg>
  );
}
