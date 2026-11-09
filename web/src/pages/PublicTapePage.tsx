import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { LinerNote } from "../components/LinerNote";
import { ShareLink } from "../components/ShareLink";
import { SongPickForm } from "../components/SongPickForm";
import { TapePlayer } from "../components/TapePlayer";
import type { Track } from "../data/types";
import { api, ApiError, dataUrlToBlob, type PublicTape } from "../lib/api";
import { useInk } from "../lib/InkContext";
import { toContribution } from "../lib/liveTape";
import { fmtDateTime } from "../lib/timeline";
import { PickHeader } from "./ContributePage";
import "./flow.css";

const savedKey = (slug: string) => `yir-picks-${slug}`;
interface SavedPick {
  song: string;
  editUrl: string;
}
function savedPicks(slug: string): SavedPick[] {
  try {
    return JSON.parse(localStorage.getItem(savedKey(slug)) ?? "[]") as SavedPick[];
  } catch {
    return [];
  }
}
function rememberPick(slug: string, pick: SavedPick) {
  try {
    localStorage.setItem(savedKey(slug), JSON.stringify([pick, ...savedPicks(slug)].slice(0, 5)));
  } catch {
    /* the friend still sees the link on screen */
  }
}

/** minutes.qfm.co.za/<slug>: the song-pick form while the tape is open, then the finished tape once it's approved. */
export function PublicTapePage({ slug }: { slug: string }) {
  const { setInk } = useInk();
  const [tape, setTape] = useState<PublicTape | null>(null);
  const [problem, setProblem] = useState<"" | "not_found" | "failed">("");
  const [sent, setSent] = useState<{ track: Track; editUrl: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await api<PublicTape>(`/api/public/tapes/${encodeURIComponent(slug)}`);
      setTape(t);
      setInk(t.inkId);
      setProblem("");
    } catch (err) {
      setProblem(err instanceof ApiError && err.status === 404 ? "not_found" : "failed");
    }
  }, [slug, setInk]);
  useEffect(() => {
    load();
  }, [load]);

  if (problem) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Years in Rotation</p>
          <h1>{problem === "not_found" ? "We couldn't find that tape" : "That didn't load"}</h1>
          <p>{problem === "not_found" ? "Check the link with whoever sent it. It looks like minutes.qfm.co.za/ followed by a name and a number." : "Check your connection and try again."}</p>
        </header>
        {problem === "failed" && <Button onClick={load}>Try again</Button>}
      </div>
    );
  }
  if (!tape) {
    return (
      <div className="wrap app" aria-busy="true">
        <p className="label muted">Loading the tape...</p>
      </div>
    );
  }

  const close = new Date(tape.closeAt);
  const organiser = tape.organiserName ?? "";

  if (tape.state === "live") {
    const tracks = tape.tracks.map(toContribution);
    const age = tape.occasion.replace(/\D/g, "");
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Years in Rotation</p>
          <h1 className="riso">
            {tape.honoree}, {tracks.length} friends made you a tape
          </h1>
          <p>Every track is a friend, in the order you met them. Pick a track to read their note, or open the song in your music app.</p>
        </header>
        <TapePlayer tracks={tracks} honoree={tape.honoree} bornYear={tape.bornYear} label={`${tape.honoree}${age ? ` ${age}` : ""} · years in rotation`} idPrefix="tape" />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Sent</p>
          <h1>You're on {tape.honoree}'s tape</h1>
          <p>
            {organiser || "The organiser"} sets the running order after picks close on {fmtDateTime(close)}. Your track lands in place by when you met, so it may move.
          </p>
        </header>
        <div className="split">
          <LinerNote track={sent.track} code="??" honoree={tape.honoree} bornYear={tape.bornYear} />
          <aside>
            <div className="panel">
              <h3>Your private link</h3>
              <p className="muted small">Keep this to change your song while picks are open, or to delete it at any time. Anyone with it can edit your pick, so don't share it.</p>
              <ShareLink link={sent.editUrl.replace(/^https?:\/\//, "").replace(/#.*$/, "#...")} url={sent.editUrl} />
              <Button href={sent.editUrl.replace(/^https?:\/\/[^/]+/, "")} variant="ghost">
                Open it now
              </Button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (tape.state === "closed") {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">{tape.honoree}'s tape</p>
          <h1>Song picks have closed</h1>
          <p>
            {organiser || "The organiser"} is setting the running order now. If you still want to add a song, ask them to reopen it. This link turns into the finished tape once it's approved.
          </p>
        </header>
      </div>
    );
  }

  const earlier = savedPicks(slug);
  return (
    <div className="wrap app">
      <PickHeader honoree={tape.honoree} occasion={tape.occasion} organiserName={organiser} close={close} />
      {earlier.length > 0 && (
        <p className="demo-note app-error">
          You've already added {earlier.map((p) => `"${p.song}"`).join(", ")} from this browser.{" "}
          <a href={earlier[0].editUrl.replace(/^https?:\/\/[^/]+/, "")}>Change it</a>, or add another song for someone else below.
        </p>
      )}
      <SongPickForm
        honoree={tape.honoree}
        bornYear={tape.bornYear}
        organiserName={organiser}
        submitLabel="Add my song"
        onSubmit={async (track, photo) => {
          const form = new FormData();
          form.set(
            "track",
            JSON.stringify({ contributor: track.contributor, tagline: track.tagline, since: track.since, song: track.song, artist: track.artist, link: track.link ?? "", message: track.message }),
          );
          if (photo) form.set("photo", await dataUrlToBlob(photo), "photo.jpg");
          const res = await api<{ id: string; editUrl: string }>(`/api/public/tapes/${encodeURIComponent(slug)}/tracks`, { method: "POST", body: form });
          rememberPick(slug, { song: track.song, editUrl: res.editUrl });
          setSent({ track: { ...track, photo: photo ?? undefined }, editUrl: res.editUrl });
          window.scrollTo(0, 0);
        }}
      />
    </div>
  );
}
