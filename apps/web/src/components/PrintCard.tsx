import type { Track } from "../data/types";
import { initials, songUrl } from "../lib/tape";
import { QrCode } from "./QrCode";
import "./PrintCard.css";

interface Props {
  track: Track;
  code: string;
  honoree: string;
  className?: string;
}

/** One printed liner-note card (63 x 88 mm). Type scales with the card, like a print layout. */
export function PrintCard({ track, code, honoree, className = "" }: Props) {
  return (
    <article className={`pcard ${className}`} aria-label={`Printed card ${code}: ${track.song}`}>
      <div className="pcard__in">
        <div className="pcard__top">
          <span>{code}</span>
          <span>Years in Rotation · {honoree}</span>
        </div>
        <div className="pcard__photo">{track.photo ? <img src={track.photo} alt="" /> : <span className="riso">{initials(track.contributor) || "?"}</span>}</div>
        <p className="pcard__song">{track.song}</p>
        <p className="pcard__artist">{track.artist}</p>
        <p className="pcard__tag hand">{track.tagline}</p>
        <p className="pcard__msg">{track.message}</p>
        <div className="pcard__foot">
          <span className="pcard__qr">
            <QrCode value={songUrl(track)} bg="#ffffff" title={`QR code for ${track.song}`} />
          </span>
          <span>
            From <b>{track.contributor}</b>
            <br />
            Scan to play in any music app
          </span>
        </div>
      </div>
    </article>
  );
}
