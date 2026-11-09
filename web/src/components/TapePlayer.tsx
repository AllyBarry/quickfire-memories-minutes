import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "../data/types";
import { firstName, sidesOf, trackCode, yearsSince } from "../lib/tape";
import { Cassette } from "./Cassette";
import { LinerNote } from "./LinerNote";
import "./TapePlayer.css";

interface Props {
  tracks: Track[];
  honoree: string;
  bornYear: number;
  /** Text on the cassette label. */
  label: string;
  /** Prefix for element ids, so two players can share a page. */
  idPrefix?: string;
}

/** The finished tape: the cassette and its sides on the left, the cued track's liner note on the right. */
export function TapePlayer({ tracks, honoree, bornYear, label, idPrefix = "tp" }: Props) {
  const [current, setCurrent] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [swapKey, setSwapKey] = useState(0);
  const timer = useRef<number>();
  const root = useRef<HTMLDivElement>(null);
  const n = tracks.length;
  const cur = Math.min(current, Math.max(0, n - 1));

  const cue = useCallback(
    (i: number) => {
      if (!n) return;
      setCurrent(((i % n) + n) % n);
      setSwapKey((k) => k + 1);
      setSpinning(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSpinning(false), 900);
    },
    [n],
  );

  // left and right arrows skip, unless someone is typing
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") cue(cur + 1);
      if (e.key === "ArrowLeft") cue(cur - 1);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [cue, cur]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!n) {
    return (
      <div className="player player--empty">
        <Cassette label={label} />
        <p>No tracks on this tape yet. Approved song picks show up here.</p>
      </div>
    );
  }

  const sides = sidesOf(tracks);
  const track = tracks[cur];
  const code = trackCode(cur, n);
  const progress = (cur + 0.5) / n;

  return (
    <div className="player" ref={root}>
      <section className="player__deck" aria-label="The tape">
        <Cassette label={label} side={code[0]} counter={String(yearsSince(track.since) * 10 + (cur % 10)).padStart(3, "0")} progress={progress} spinning={spinning} />
        <div className="player__sides">
          {sides.map((s) => (
            <div className="player__side" key={s.letter}>
              <h3 className="label">
                Side {s.letter}
                <small>
                  {s.tracks[0].since.slice(0, 4)} to {s.tracks[s.tracks.length - 1].since.slice(0, 4)}
                </small>
              </h3>
              <ol>
                {s.tracks.map((t, k) => {
                  const i = s.offset + k;
                  return (
                    <li key={t.id}>
                      <button type="button" id={`${idPrefix}-${t.id}`} className="player__track" aria-pressed={i === cur} onClick={() => cue(i)}>
                        <span className="player__no">
                          {s.letter}
                          {k + 1}
                        </span>
                        <span className="player__what">
                          <span className="player__song">{t.song}</span>
                          <span className="player__who">
                            {t.artist} · from {firstName(t.contributor)}
                          </span>
                        </span>
                        <span className="player__yrs">{yearsSince(t.since)} yrs</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
        <div className="player__transport">
          <button type="button" className="btn btn--ghost" onClick={() => cue(cur - 1)} aria-label="Previous track">
            ◂◂ Rew
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => cue(cur + 1)} aria-label="Next track">
            FF ▸▸
          </button>
          <span className="player__hint">← → to skip</span>
        </div>
      </section>
      <div className="player__liner" aria-live="polite">
        <LinerNote key={swapKey} className="player__swap" track={track} code={code} honoree={honoree} bornYear={bornYear} />
      </div>
    </div>
  );
}
