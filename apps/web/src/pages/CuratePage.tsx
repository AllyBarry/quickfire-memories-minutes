import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { LinerNote } from "../components/LinerNote";
import { fmtDate, LIMITS, planById, timeline } from "@yir/shared";
import { useTape, type Contribution } from "../lib/demoStore";
import { useInk } from "../lib/InkContext";
import { isUrl, sidesOf, sinceYear, trackCode } from "../lib/tape";
import "./flow.css";

/** Things an organiser should look at before a track prints. */
function warningsFor(c: Contribution, all: Contribution[], honoree: string, bornYear: number) {
  const out: string[] = [];
  const others = all.filter((o) => o.id !== c.id && o.status !== "hidden");
  const same = others.find((o) => o.song.trim().toLowerCase() === c.song.trim().toLowerCase() && o.artist.trim().toLowerCase() === c.artist.trim().toLowerCase());
  if (same) out.push(`${same.contributor} picked the same song. Ask one of them for another, or keep both on purpose.`);
  if (c.message.length > 280) out.push("The liner note is long, so the printed card cuts it short. The full note stays on the tape page.");
  if (c.link && !isUrl(c.link)) out.push("The song link doesn't look like a web address. We'll search for the song instead.");
  if (!c.link) out.push("No song link. We'll match it by title and artist, so check the spelling.");
  if (c.since && sinceYear(c.since) < bornYear) out.push(`They met before ${honoree} was born. Fine for family, but check it isn't a typo.`);
  if (!c.photo) out.push("No photo, so the card prints their initials.");
  return out;
}

/** The organiser reviews every track, fixes it, sets the order and approves the tape. */
export function CuratePage() {
  const { order, contributions, dispatch, links } = useTape();
  const { ink } = useInk();
  const [selectedId, setSelectedId] = useState(contributions.find((c) => c.status === "new")?.id ?? contributions[0]?.id);
  const selected = contributions.find((c) => c.id === selectedId) ?? contributions[0];
  const visible = contributions.filter((c) => c.status !== "hidden");
  const approved = visible.filter((c) => c.status === "approved").length;
  const allApproved = visible.length > 0 && approved === visible.length;
  const plan = planById(order.planId);
  const ms = timeline(order.partyDate, plan.printed, order.closeAt);
  const sorted = contributions.every((c, i) => i === 0 || contributions[i - 1].since <= c.since);

  const warnings = useMemo(() => new Map(contributions.map((c) => [c.id, warningsFor(c, contributions, order.honoree, order.bornYear)])), [contributions, order.honoree, order.bornYear]);

  // editing an approved track sends it back for review
  const update = (patch: Partial<Contribution>) => selected && dispatch({ type: "update", id: selected.id, patch: { ...patch, status: selected.status === "approved" ? "new" : selected.status } });
  const goNext = () => {
    const i = contributions.findIndex((c) => c.id === selected?.id);
    const next = contributions.slice(i + 1).find((c) => c.status === "new") ?? contributions.find((c) => c.status === "new" && c.id !== selected?.id);
    if (next) setSelectedId(next.id);
  };

  if (order.status === "approved") {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Running order approved</p>
          <h1>
            {visible.length} tracks are {plan.printed ? "on their way to print" : "ready for the party"}
          </h1>
          <p>
            {plan.name} tape in {ink.name}. {plan.printed ? "We'll email you a tracking link when the box ships." : "The tape page goes live on the party date."}
          </p>
        </header>
        <div className="split">
          <div className="panel">
            <h2>What happens next</h2>
            <ol className="tl">
              {ms.slice(2).map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <time dateTime={m.date.toISOString()}>{fmtDate(m.date)}</time>
                </li>
              ))}
            </ol>
            <div className="row">
              <Button href={links.tape}>See the finished tape</Button>
              <Button variant="ghost" onClick={() => dispatch({ type: "order", patch: { status: "curating" } })}>
                Reopen the running order
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Running order</p>
          <h1>No songs yet</h1>
          <p>Share the link and the first picks show up here.</p>
        </header>
        <Button href={links.dashboard}>Back to the dashboard</Button>
      </div>
    );
  }

  const i = contributions.findIndex((c) => c.id === selected.id);
  const visibleIndex = visible.findIndex((c) => c.id === selected.id);
  const code = visibleIndex >= 0 ? trackCode(visibleIndex, visible.length) : "Hidden";
  const w = warnings.get(selected.id) ?? [];
  // the list shows tracks grouped by the side they'll land on; hidden tracks sit at the end
  const sides = sidesOf(visible);
  const hidden = contributions.filter((c) => c.status === "hidden");

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">Running order</p>
        <h1>Check every track before it {plan.printed ? "prints" : "goes live"}</h1>
        <p>Fix typos, move tracks between sides, and hide anything that shouldn't be on the tape. Nothing changes for friends until you approve.</p>
      </header>

      <div className="panel curate-bar">
        <div>
          <strong>
            {approved} of {visible.length} tracks approved
          </strong>
          <div className="bar" aria-hidden="true">
            <span style={{ width: `${visible.length ? (approved / visible.length) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="row">
          <Button variant="ghost" disabled={sorted} onClick={() => dispatch({ type: "sortByYear" })}>
            {sorted ? "In order of meeting" : "Sort by year met"}
          </Button>
          <Button disabled={!allApproved} onClick={() => dispatch({ type: "order", patch: { status: "approved" } })}>
            {allApproved ? "Approve the tape" : `${visible.length - approved} still to review`}
          </Button>
        </div>
      </div>

      <div className="curate">
        <nav className="panel curate__list" aria-label="Tracks">
          <div className="curate__scroll">
            {[...sides.map((s) => ({ key: s.letter, title: `Side ${s.letter}`, list: s.tracks as Contribution[] })), ...(hidden.length ? [{ key: "hidden", title: "Hidden", list: hidden }] : [])].map((group) => (
              <div key={group.key}>
                <h3>{group.title}</h3>
                <ol>
                  {group.list.map((c) => {
                    const k = contributions.findIndex((x) => x.id === c.id);
                    const vi = visible.findIndex((x) => x.id === c.id);
                    const first = vi >= 0 ? vi === 0 : k === 0;
                    const last = vi >= 0 ? vi === visible.length - 1 : k === contributions.length - 1;
                    return (
                      <li key={c.id} className={`${c.id === selected.id ? "is-on" : ""} ${c.status === "hidden" ? "is-hidden" : ""}`}>
                        <button type="button" className="curate__pick" aria-current={c.id === selected.id ? "true" : undefined} onClick={() => setSelectedId(c.id)}>
                          <span className="mono">{vi >= 0 ? trackCode(vi, visible.length) : "--"}</span>
                          <span className="curate__who">
                            <b>{c.song}</b>
                            <span className="row" style={{ gap: 6 }}>
                              <span className="muted small">{c.contributor.split(" ")[0]}</span>
                              <span className={`chip chip--${c.status}`}>{c.status === "new" ? "Review" : c.status === "approved" ? "OK" : "Hidden"}</span>
                            </span>
                          </span>
                        </button>
                        <span className="curate__move">
                          <button type="button" aria-label={`Move ${c.song} earlier`} disabled={first} onClick={() => dispatch({ type: "move", id: c.id, dir: -1 })}>
                            ▲
                          </button>
                          <button type="button" aria-label={`Move ${c.song} later`} disabled={last} onClick={() => dispatch({ type: "move", id: c.id, dir: 1 })}>
                            ▼
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </nav>

        <section className="panel" aria-label={`Editing ${selected.song}`}>
          <div className="row row--between">
            <h2>
              {code} · {selected.contributor}
            </h2>
            <span className="muted small">
              {i + 1} of {contributions.length}
            </span>
          </div>
          {w.length > 0 && (
            <ul className="curate__warn" aria-label="Things to check">
              {w.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="curate__body">
            <div className="curate__fields">
              <div className="grid-2">
                <Field id="e-song" label="Song" value={selected.song} limit={LIMITS.song} onChange={(e) => update({ song: e.target.value })} />
                <Field id="e-artist" label="Artist" value={selected.artist} limit={LIMITS.artist} onChange={(e) => update({ artist: e.target.value })} />
              </div>
              <div className="grid-2">
                <Field id="e-tagline" label="How they know them" value={selected.tagline} limit={LIMITS.tagline} onChange={(e) => update({ tagline: e.target.value })} />
                <Field id="e-since" type="date" label="When they met" value={selected.since} onChange={(e) => e.target.value && update({ since: e.target.value })} />
              </div>
              <Field id="e-link" type="url" label="Song link" value={selected.link ?? ""} onChange={(e) => update({ link: e.target.value })} placeholder="https://" />
              <Field id="e-message" multiline label="Liner note" value={selected.message} limit={LIMITS.message} onChange={(e) => update({ message: e.target.value })} />
            </div>
            <div className="curate__preview">
              <LinerNote track={selected} code={code} honoree={order.honoree} bornYear={order.bornYear} />
              <div className="curate__actions">
                {selected.status !== "approved" && selected.status !== "hidden" && (
                  <Button
                    onClick={() => {
                      dispatch({ type: "update", id: selected.id, patch: { status: "approved" } });
                      goNext();
                    }}
                  >
                    Approve and next
                  </Button>
                )}
                {selected.status === "approved" && <p className="chip chip--approved">Approved</p>}
                <Button variant="ghost" onClick={() => dispatch({ type: "update", id: selected.id, patch: { status: selected.status === "hidden" ? "new" : "hidden" } })}>
                  {selected.status === "hidden" ? "Put back on the tape" : "Hide from the tape"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
