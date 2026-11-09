import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { SongPickForm } from "../components/SongPickForm";
import type { Track } from "../data/types";
import { api, ApiError, dataUrlToBlob, type ApiTrack } from "../lib/api";
import "./flow.css";

interface OwnTrack extends ApiTrack {
  hasPhoto: boolean;
  tape: { slug: string; honoree: string; bornYear: number; open: boolean } | null;
}

/** minutes.qfm.co.za/<slug>/edit/<id>#<token>: a friend changes or deletes their own song. The token never leaves the browser in the URL. */
export function EditTrackPage({ id, token }: { id: string; token: string }) {
  const [track, setTrack] = useState<OwnTrack | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState<"" | "saved" | "deleted">("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const headers = { "X-Edit-Token": token };

  const load = useCallback(async () => {
    if (!token) return setProblem("This link is missing its private code. Use the full link you were given.");
    try {
      setTrack(await api<OwnTrack>(`/api/public/tracks/${id}`, { headers: { "X-Edit-Token": token } }));
    } catch (err) {
      setProblem(err instanceof ApiError && err.status === 404 ? "This link doesn't open a song any more. It may have been deleted." : "That didn't load. Check your connection and try again.");
    }
  }, [id, token]);
  useEffect(() => {
    load();
  }, [load]);

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`/api/public/tracks/${id}`, { method: "DELETE", headers });
      setDone("deleted");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That didn't delete. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (problem) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Your song</p>
          <h1>That link didn't work</h1>
          <p>{problem}</p>
        </header>
      </div>
    );
  }
  if (done) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Your song</p>
          <h1>{done === "deleted" ? "Your song is deleted" : "Saved"}</h1>
          <p>{done === "deleted" ? "It's off the tape, along with your note and photo." : "The organiser will see your changes when they set the running order."}</p>
        </header>
        {track?.tape && (
          <Button href={`/${track.tape.slug}`} variant="ghost">
            Back to {track.tape.honoree}'s tape
          </Button>
        )}
      </div>
    );
  }
  if (!track || !track.tape) {
    return (
      <div className="wrap app" aria-busy="true">
        <p className="label muted">Loading your song...</p>
      </div>
    );
  }

  const deleteControls = confirming ? (
    <span className="row">
      <span className="small">Delete your song, note and photo?</span>
      <Button variant="ghost" onClick={remove} disabled={deleting}>
        {deleting ? "Deleting..." : "Yes, delete it"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        Keep it
      </Button>
    </span>
  ) : (
    <Button variant="ghost" onClick={() => setConfirming(true)}>
      Delete my song
    </Button>
  );

  const initial: Track = { id: track.id, contributor: track.contributor, tagline: track.tagline, since: track.since, song: track.song, artist: track.artist, link: track.link ?? "", message: track.message };

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">{track.tape.honoree}'s tape</p>
        <h1>Your song: {track.song}</h1>
        <p>{track.tape.open ? "Change anything below. The organiser reviews it again after you save." : "Song picks have closed, so your song can't be changed now. You can still delete it."}</p>
      </header>
      {track.tape.open ? (
        <SongPickForm
          honoree={track.tape.honoree}
          bornYear={track.tape.bornYear}
          organiserName=""
          initial={initial}
          hasSavedPhoto={track.hasPhoto}
          submitLabel="Save changes"
          actions={deleteControls}
          onSubmit={async (t, photo) => {
            await api(`/api/public/tracks/${id}`, {
              method: "PATCH",
              headers,
              json: { contributor: t.contributor, tagline: t.tagline, since: t.since, song: t.song, artist: t.artist, link: t.link ?? "", message: t.message },
            });
            if (photo === null && track.hasPhoto) await api(`/api/public/tracks/${id}/photo`, { method: "DELETE", headers });
            if (photo) await api(`/api/public/tracks/${id}/photo`, { method: "PUT", headers: { ...headers, "Content-Type": "image/jpeg" }, body: await dataUrlToBlob(photo) });
            setDone("saved");
            window.scrollTo(0, 0);
          }}
        />
      ) : (
        <div className="panel">{deleteControls}</div>
      )}
    </div>
  );
}
