import { Button } from "../components/Button";
import { CloseDateEditor } from "../components/CloseDateEditor";
import { ShareLink } from "../components/ShareLink";
import { daysUntil, fmtDate, fmtDateTime, isClosed, planById, timeline } from "@yir/shared";
import { useTape } from "../lib/demoStore";
import { InkPicker } from "../components/InkPicker";
import { useInk } from "../lib/InkContext";
import { trackCode, yearsSince } from "../lib/tape";
import "./flow.css";

const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

const statusLabel = { new: "To review", approved: "Approved", hidden: "Hidden" } as const;

/** A scheduled reminder that flips to "Sent" once its time has passed. */
function Reminder({ at, label }: { at: Date; label: string }) {
  const sent = at.getTime() <= Date.now();
  return (
    <li>
      <span className={`chip ${sent ? "chip--approved" : "chip--new"}`}>{sent ? "Sent" : "Scheduled"}</span> {label} {sent ? "" : `on ${fmtDate(at)}`}
    </li>
  );
}

/** The organiser's view while song picks come in. */
export function OrganiserPage() {
  const { order, contributions, dispatch, links, mode } = useTape();
  const { ink } = useInk();
  const plan = planById(order.planId);
  const ms = timeline(order.partyDate, plan.printed, order.closeAt);
  const close = ms[0].date;
  const party = ms[ms.length - 1].date;
  const closed = isClosed(order.partyDate, plan.printed, order.closeAt);
  const hoursLeft = Math.max(0, Math.round((close.getTime() - Date.now()) / 36e5));
  const visible = contributions.filter((c) => c.status !== "hidden");
  const pct = Math.min(100, Math.round((contributions.length / Math.max(1, order.invited)) * 100));
  const friendshipYears = visible.reduce((s, c) => s + yearsSince(c.since), 0);
  const toReview = contributions.filter((c) => c.status === "new").length;

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">Organiser dashboard</p>
        <h1>
          {order.honoree}'s tape: {contributions.length} {contributions.length === 1 ? "song" : "songs"} so far
        </h1>
        <p>
          {plan.name} tape in {ink.name}. Party on {fmtDate(party)}, {daysUntil(party)} days away.
        </p>
      </header>

      <div className="stats">
        <div className="stat">
          <b>
            {contributions.length}
            <small className="muted"> / {order.invited}</small>
          </b>
          <span>{contributions.length === 1 ? "friend has" : "friends have"} picked a song</span>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="stat">
          <b>{closed ? "Closed" : hoursLeft < 48 ? `${hoursLeft}h` : daysUntil(close)}</b>
          <span>{closed ? `picks closed ${fmtDateTime(close)}` : `${hoursLeft < 48 ? "" : "days "}until picks close (${fmtDateTime(close)})`}</span>
        </div>
        <div className="stat">
          <b>{friendshipYears}</b>
          <span>years of friendship on the tape</span>
        </div>
        <div className="stat">
          <b>{toReview}</b>
          <span>{toReview === 1 ? "track" : "tracks"} waiting for your review</span>
        </div>
      </div>

      <div className="split organiser">
        <div className="panel">
          <div className="row row--between">
            <h2>Song picks</h2>
            <Button href={links.order}>Set the running order</Button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Track</th>
                  <th scope="col">From</th>
                  <th scope="col">Song</th>
                  <th scope="col">Since</th>
                  <th scope="col">Sent</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, i) => (
                  <tr key={c.id}>
                    <td className="mono">{trackCode(i, contributions.length)}</td>
                    <td>
                      <strong>{c.contributor}</strong>
                      <div className="muted small">{c.tagline}</div>
                    </td>
                    <td>
                      {c.song}
                      <div className="muted small">{c.artist}</div>
                    </td>
                    <td className="mono">{c.since.slice(0, 4)}</td>
                    <td className="muted small nowrap">{ago(c.submittedAt)}</td>
                    <td>
                      <span className={`chip chip--${c.status}`}>{statusLabel[c.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">{visible.length} {visible.length === 1 ? "track goes" : "tracks will go"} on the tape. Hidden tracks stay in your download but don't print or play.</p>
        </div>

        <aside>
          <CloseDateEditor />
          <div className="panel">
            <h3>Share link</h3>
            <ShareLink link={links.share} />
            <p className="muted small">Post it in the group chat. {closed ? "Picks are closed, so the link now shows a closed message." : `Anyone with the link can add a song until ${fmtDateTime(close)}.`}</p>
          </div>
          <div className="panel">
            <h3>Reminders</h3>
            <ul className="reminders">
              <li>
                <span className="chip chip--approved">Sent</span> Launch email to you, with the link
              </li>
              <Reminder at={new Date(close.getTime() - 2 * 864e5)} label={'"Two days left" email to you, with the link to share again'} />
              <Reminder at={close} label="Picks close and we email you to set the running order" />
            </ul>
          </div>
          <div className="panel">
            <h3>Timeline</h3>
            <ol className="tl">
              {ms.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <time dateTime={m.date.toISOString()}>{fmtDate(m.date)}</time>
                </li>
              ))}
            </ol>
          </div>
          <div className="panel">
            <h3>Inks</h3>
            <InkPicker label="The two inks for the tape and the box" disabled={order.status === "approved"} onChange={(inkId) => dispatch({ type: "order", patch: { inkId } })} />
          </div>
          <div className="panel">
            <h3>{mode === "demo" ? "Try it as a friend" : "See what friends see"}</h3>
            <p className="muted small">
              {mode === "demo" ? "Pick a song yourself to see the friend's form and watch it land here." : "Open your share link to see the form. If you add a song yourself, it lands here like anyone else's."}
            </p>
            <div className="row">
              <Button href={links.pick} variant="ghost">
                Open the friend's form
              </Button>
              <Button href={links.tape} variant="ghost">
                Preview the tape
              </Button>
              {mode === "demo" && (
                <Button variant="ghost" onClick={() => dispatch({ type: "reset" })}>
                  Reset demo
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
