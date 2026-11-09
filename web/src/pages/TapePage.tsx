import { Button } from "../components/Button";
import { JCard } from "../components/JCard";
import { PrintCard } from "../components/PrintCard";
import { TapePlayer } from "../components/TapePlayer";
import { planById } from "../data/plans";
import { useTape } from "../lib/demoStore";
import { trackCode } from "../lib/tape";
import "./flow.css";

/** The finished tape: what guests open at the party, and the printed pieces in the box. */
export function TapePage() {
  const { order, contributions, links, mode } = useTape();
  const tracks = contributions.filter((c) => c.status !== "hidden");
  const plan = planById(order.planId);
  const age = order.occasion.replace(/\D/g, "");
  const label = `${order.honoree}${age ? ` ${age}` : ""} · years in rotation`;
  const pending = contributions.filter((c) => c.status === "new").length;

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">{links.share}</p>
        <h1 className="riso">
          {order.honoree}, {tracks.length} friends made you a tape
        </h1>
        <p>
          This is the page guests open at the party. Every track is a friend, in the order {order.honoree} met them.
          {pending > 0 && ` ${pending} ${pending === 1 ? "track is" : "tracks are"} still waiting for the organiser's review, and show here as a preview.`}
        </p>
      </header>

      <TapePlayer tracks={tracks} honoree={order.honoree} bornYear={order.bornYear} label={label} idPrefix="tape" />

      <section className="app__pieces" aria-labelledby="pieces-title" style={{ marginTop: 56 }}>
        <header className="app__head">
          <p className="label app__eyebrow">{plan.printed ? "In the box" : "Print at home"}</p>
          <h2 id="pieces-title" style={{ fontSize: "clamp(26px, 4vw, 40px)" }}>
            {plan.printed ? "The printed pieces" : "Your print-at-home sheets"}
          </h2>
          <p>{plan.printed ? "One card per track and the J-card insert, printed in your two inks." : "The same cards as a PDF, ready for any home printer."}</p>
        </header>
        <div className="pieces">
          <figure style={{ margin: 0 }}>
            <JCard honoree={order.honoree} occasion={order.occasion} tracks={tracks} />
            <figcaption>J-card insert, laid flat. Fold on the dashed lines.</figcaption>
          </figure>
          <div className="pieces__cards">
            {tracks.map((t, i) => (
              <PrintCard key={t.id} track={t} code={trackCode(i, tracks.length)} honoree={order.honoree} />
            ))}
          </div>
        </div>
      </section>

      <div className="row" style={{ marginTop: 40 }}>
        <Button href={links.order}>Change the running order</Button>
        <Button href={mode === "demo" ? "/" : links.dashboard} variant="ghost">
          {mode === "demo" ? "Back to the store" : "Back to the dashboard"}
        </Button>
      </div>
    </div>
  );
}
