import { useState } from "react";
import { Button } from "../components/Button";
import { LinerNote } from "../components/LinerNote";
import { SongPickForm } from "../components/SongPickForm";
import { planById } from "../data/plans";
import type { Track } from "../data/types";
import { useTape } from "../lib/demoStore";
import { trackCode } from "../lib/tape";
import { fmtDateTime, isClosed, timeline } from "../lib/timeline";
import "./flow.css";

/** Demo: what a friend sees when they open the share link. Saves into the demo store. */
export function ContributePage() {
  const { order, contributions, dispatch, links } = useTape();
  const [sent, setSent] = useState<Track | null>(null);
  const [formKey, setFormKey] = useState(0);
  const printed = planById(order.planId).printed;
  const close = timeline(order.partyDate, printed, order.closeAt)[0].date;
  const closed = isClosed(order.partyDate, printed, order.closeAt);

  if (sent) {
    const i = contributions.findIndex((c) => c.id === sent.id);
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Sent</p>
          <h1>You're on {order.honoree}'s tape</h1>
          <p>
            {order.organiserName} sets the running order before {fmtDateTime(close)}. Your track lands in place by when you met, so it may move.
          </p>
        </header>
        <div className="split">
          <LinerNote track={sent} code={trackCode(Math.max(0, i), contributions.length)} honoree={order.honoree} bornYear={order.bornYear} />
          <aside>
            <div className="panel">
              <h3>Try the other side</h3>
              <p className="muted small">This is a demo, so you can also see what the organiser sees.</p>
              <div className="row">
                <Button href={links.dashboard}>Open the dashboard</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSent(null);
                    setFormKey((k) => k + 1);
                  }}
                >
                  Pick another as someone else
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">{order.honoree}'s tape</p>
          <h1>Song picks have closed</h1>
          <p>
            {order.organiserName} closed the tape on {fmtDateTime(close)}. If you still want to add a song, ask them to reopen it.
          </p>
        </header>
        <Button href={links.dashboard}>Open the dashboard to reopen it</Button>
      </div>
    );
  }

  return (
    <div className="wrap app">
      <PickHeader honoree={order.honoree} occasion={order.occasion} organiserName={order.organiserName} close={close} />
      <SongPickForm
        key={formKey}
        honoree={order.honoree}
        bornYear={order.bornYear}
        organiserName={order.organiserName}
        submitLabel="Add my song"
        onSubmit={async (track, photo) => {
          const withPhoto = { ...track, photo: photo ?? undefined };
          dispatch({ type: "add", contribution: { ...withPhoto, status: "new", submittedAt: new Date().toISOString() } });
          setSent(withPhoto);
          window.scrollTo(0, 0);
        }}
      />
    </div>
  );
}

export function PickHeader({ honoree, occasion, organiserName, close }: { honoree: string; occasion: string; organiserName: string; close: Date }) {
  return (
    <header className="app__head">
      <p className="label app__eyebrow">{honoree}'s tape</p>
      <h1>Pick one song for {honoree}</h1>
      <p>
        The song that makes you think of them, and the story behind it. {organiserName ? `${organiserName} is` : "We're"} putting it together for when {honoree} {occasion}. Picks close {fmtDateTime(close)}.
      </p>
    </header>
  );
}
