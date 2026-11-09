import type { Track } from "../data/types";
import { initials, sinceYear, songUrl, yearsSince } from "../lib/tape";
import { QrCode } from "./QrCode";
import "./LinerNote.css";

interface Props {
  track: Track;
  /** "A3" style position on the tape. */
  code: string;
  honoree: string;
  bornYear: number;
  className?: string;
}

/** The liner note for one track: who picked it, why, and how long they've been around. */
export function LinerNote({ track, code, honoree, bornYear, className = "" }: Props) {
  return (
    <article className={`liner ${className}`} aria-label={`Track ${code}: ${track.song}, picked by ${track.contributor}`}>
      <div className="liner__photo">
        {track.photo ? <img src={track.photo} alt={`${track.contributor}`} /> : <span className="liner__initials riso">{initials(track.contributor) || "?"}</span>}
      </div>
      <div className="liner__body">
        <p className="label liner__eyebrow">Track {code} · liner note</p>
        <h3>{track.song || "Song title"}</h3>
        <p className="liner__from">
          {track.artist || "Artist"}. Picked by <b>{track.contributor || "a friend"}</b>.
        </p>
        {track.tagline && <p className="liner__tagline hand">{track.tagline}</p>}
        <blockquote>{track.message || "Their note goes here."}</blockquote>
        {track.since && <RotationStrip since={track.since} bornYear={bornYear} honoree={honoree} />}
        <div className="liner__listen">
          <span className="liner__qr">
            <QrCode value={songUrl(track)} bg="#ffffff" title={`QR code that opens ${track.song}`} />
          </span>
          <p>
            Scan the code on the printed card, or{" "}
            <a href={songUrl(track)} target="_blank" rel="noopener noreferrer">
              open the song
            </a>{" "}
            in your music app.
          </p>
        </div>
      </div>
    </article>
  );
}

/** The guest of honour's life so far, to scale, with this friendship filled in. */
export function RotationStrip({ since, bornYear, honoree }: { since: string; bornYear: number; honoree: string }) {
  const end = new Date().getFullYear();
  const met = sinceYear(since);
  const start = Math.min(bornYear, met);
  const span = Math.max(1, end - start);
  const left = ((met - start) / span) * 100;
  const yrs = yearsSince(since);
  const age = Math.max(1, end - bornYear);
  const pct = Math.round(Math.min(1, yrs / age) * 100);
  const ticks = [start, start + Math.round(span / 3), start + Math.round((2 * span) / 3), end].filter((y, i, a) => a.indexOf(y) === i);
  const caption =
    met < bornYear ? (
      <>
        <b>{yrs} years</b>, since before {honoree} was born.
      </>
    ) : yrs === 0 ? (
      <>Met this year. Welcome to the tape.</>
    ) : (
      <>
        <b>{yrs} years</b> of {honoree}'s {age}, about {pct}% of a lifetime so far.
      </>
    );
  return (
    <div className="rot">
      <p className="label rot__title">In rotation since {met}</p>
      <div className="rot__bar" aria-hidden="true">
        <span style={{ left: `${left}%` }} />
      </div>
      <div className="rot__ticks" aria-hidden="true">
        {ticks.map((y) => (
          <span key={y} style={{ left: `${((y - start) / span) * 100}%` }}>
            {y}
          </span>
        ))}
      </div>
      <p className="rot__cap">{caption}</p>
    </div>
  );
}
