import type { Track } from "../data/types";
import { sidesOf } from "../lib/tape";
import "./JCard.css";

interface Props {
  honoree: string;
  occasion: string;
  tracks: Track[];
  className?: string;
}

/**
 * The tracklist insert, laid flat. Real cassette J-card proportions:
 * 15.9 mm back flap, 12.7 mm spine, 63.5 mm front, all 101.6 mm tall.
 */
export function JCard({ honoree, occasion, tracks, className = "" }: Props) {
  const sides = sidesOf(tracks);
  const years = tracks.length ? `${tracks[0].since.slice(0, 4)} to ${new Date().getFullYear()}` : "";
  return (
    <figure className={`jcard ${className}`} aria-label={`J-card tracklist for ${honoree}`}>
      <div className="jcard__flap">
        <span>{tracks.length} tracks</span>
        <span>{years}</span>
      </div>
      <div className="jcard__spine">
        <span>
          {honoree} {occasion} · Years in Rotation
        </span>
      </div>
      <div className="jcard__front">
        <p className="jcard__title riso">
          Years in
          <br />
          Rotation
        </p>
        <p className="jcard__for hand">for {honoree}</p>
        <div className="jcard__sides">
          {sides.map((s) => (
            <div key={s.letter}>
              <p className="jcard__side">Side {s.letter}</p>
              <ol>
                {s.tracks.map((t) => (
                  <li key={t.id}>{t.song}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
