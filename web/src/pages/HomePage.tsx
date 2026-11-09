import { sampleTape } from "../data/sampleTape";
import { plans } from "../data/plans";
import { flowLinks } from "../data/flowLinks";
import { Button } from "../components/Button";
import { Cassette } from "../components/Cassette";
import { Faq, type FaqItem } from "../components/Faq";
import { InkPicker } from "../components/InkPicker";
import { JCard } from "../components/JCard";
import { PricingCard } from "../components/PricingCard";
import { PrintCard } from "../components/PrintCard";
import { Section } from "../components/Section";
import { StepList, type Step } from "../components/StepList";
import { TapePlayer } from "../components/TapePlayer";
import { navigate } from "../lib/router";
import { trackCode } from "../lib/tape";
import "./HomePage.css";

const tape = sampleTape;
const label = `${tape.honoree} 30 · years in rotation`;

const steps: Step[] = [
  {
    title: "Start a tape",
    body: "Tell us who it's for and the party date. You get one link to drop in the group chat.",
    visual: (
      <div className="mini-link">
        minutes.qfm.co.za/<b>nandi30</b>
      </div>
    ),
  },
  {
    title: "Friends pick a song",
    body: "Each person chooses one song, says when they met, and writes the liner note behind it. Any music app works.",
    visual: (
      <div className="mini-pick" aria-hidden="true">
        <span>Midnight City</span>
        <small>M83 · since 2015</small>
      </div>
    ),
  },
  {
    title: "You set the running order",
    body: "Tracks line up by when each friend met them. Fix typos, swap the order, hide anything that shouldn't print.",
    visual: (
      <ol className="mini-order" aria-hidden="true">
        <li>A1 · 2002</li>
        <li>A2 · 2008</li>
        <li>A3 · 2009</li>
      </ol>
    ),
  },
  {
    title: "Press play at the party",
    body: "The tape page goes live, and the printed box arrives with one card per friend. Scan any card to hear their song.",
    visual: <Cassette className="mini-tape" label="Nandi 30" title="A small cassette" />,
  },
];

const faqs: FaqItem[] = [
  {
    q: "Does everyone need the same music app?",
    a: "No. Friends paste a link from whatever they use. Every card's QR code opens a page that offers the song in Spotify, Apple Music, YouTube Music, Deezer and others, so guests listen in their own app.",
  },
  {
    q: "Do you host the music?",
    a: "No. We only link to each song's official release on the music services. The tape carries the notes, photos and running order, and the music stays where the artists put it.",
  },
  {
    q: "How long does it take?",
    a: "Give friends about two weeks to pick. Digital tapes go live as soon as you approve the running order. Boxed tapes ship in our weekly print run and arrive 3 to 5 working days later, so order at least four weeks before the party.",
  },
  {
    q: "Can I use it for something other than a birthday?",
    a: "Yes. Weddings, farewells, retirements and anniversaries all work. The tracklist still runs in the order people met the guest of honour.",
  },
  {
    q: "Is it private?",
    a: "Only people with your link can add a song, and only you see the picks before they're approved. The tape page isn't listed anywhere, and friends can ask us to remove what they sent.",
  },
];

export function HomePage() {
  const n = tape.tracks.length;
  return (
    <>
      <section className="hero">
        <div className="wrap hero__grid">
          <div className="hero__copy">
            <p className="label hero__eyebrow rise" style={{ ["--i" as string]: 0 }}>
              For 30ths, 40ths, weddings and farewells
            </p>
            <h1 className="riso rise" style={{ ["--i" as string]: 1 }}>
              Everyone picks a song. They get the mixtape.
            </h1>
            <p className="hero__lede rise" style={{ ["--i" as string]: 2 }}>
              Friends each choose one song and write the liner note behind it. We press it into a tape: a page that plays in any music app, and printed liner-note cards in a keepsake box. The tracklist runs in the order they met.
            </p>
            <div className="row rise" style={{ ["--i" as string]: 3 }}>
              <Button href="/start">Start a tape</Button>
              <Button href="/#listen" variant="ghost">
                Hear the sample tape
              </Button>
            </div>
            <ul className="hero__facts rise" style={{ ["--i" as string]: 4 }}>
              <li>
                <b>80</b> friends per tape
              </li>
              <li>
                <b>Any</b> music app
              </li>
              <li>
                <b>5 yrs</b> online
              </li>
            </ul>
          </div>
          <div className="hero__art" aria-hidden="true">
            <Cassette className="hero__tape" label={label} side="A" counter="240" progress={0.2} />
            <div className="hero__card">
              <PrintCard track={tape.tracks[4]} code={trackCode(4, n)} honoree={tape.honoree} />
            </div>
            <p className="hero__note hand">side A, 2002 to now</p>
          </div>
        </div>
      </section>

      <Section id="how" tone="ink" eyebrow="How it works" title="You send one link. Everyone else makes the tape." intro="No app to install. Friends open the link on their phone, and you decide what ends up in the box.">
        <StepList steps={steps} />
      </Section>

      <Section id="listen" eyebrow="The sample tape" title="Press play on Nandi's thirty years." intro="Pick a track or use the arrow keys. Each liner note shows how long that friend has been in rotation, drawn to scale across the whole life so far.">
        <TapePlayer tracks={tape.tracks} honoree={tape.honoree} bornYear={tape.bornYear} label={label} idPrefix="home" />
      </Section>

      <Section id="box" tone="sunk" eyebrow="What arrives" title="A tape box you can hold." intro="Boxed and Double album orders print every approved track. The tape page comes with every plan.">
        <div className="pieces">
          <figure className="home-piece">
            <JCard honoree={tape.honoree} occasion={tape.occasion} tracks={tape.tracks} />
            <figcaption>The J-card insert: tracklist on the front, name on the spine. Real cassette proportions.</figcaption>
          </figure>
          <div>
            <div className="pieces__cards">
              {[0, 3, 6].map((i) => (
                <PrintCard key={i} track={tape.tracks[i]} code={trackCode(i, n)} honoree={tape.honoree} />
              ))}
            </div>
            <p className="pieces__cap">One card per friend, 63 x 88 mm, matt laminate. The QR code opens their song in whatever app the guest uses.</p>
          </div>
        </div>
        <div className="row home-more">
          <Button href="/demo/tape" variant="ghost">
            See the whole sample tape
          </Button>
        </div>
      </Section>

      <Section id="pricing" eyebrow="Pricing" title="One price per tape. No subscriptions." intro="Hosting and song links are included. Choose your two inks and every piece updates.">
        <InkPicker className="pricing__picker" />
        <div className="pricing">
          {plans.map((p) => (
            <PricingCard
              key={p.id}
              plan={p}
              onChoose={(plan) => navigate(`/start?plan=${plan.id}`)}
            />
          ))}
        </div>
        <p className="pricing__note muted small">Printed tapes ship in a weekly print run. Order at least four weeks before the party.</p>
      </Section>

      <Section id="flow" tone="sunk" eyebrow="Demo" title="Walk through the whole flow" intro="Every step of the product on sample data, kept in your browser. What you do on one page shows up on the next.">
        <ol className="flowlinks">
          {flowLinks.map((f) => (
            <li key={f.href}>
              <a href={f.href}>
                <span className="label flowlinks__who">{f.who}</span>
                <b>{f.title}</b>
                <span>{f.body}</span>
              </a>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="faq" eyebrow="Questions" title="Good to know">
        <Faq items={faqs} />
      </Section>

      <section className="final">
        <div className="wrap final__inner">
          <h2 className="riso">Who would you make a tape for?</h2>
          <Button href="/start" variant="light">
            Start a tape
          </Button>
        </div>
      </section>
    </>
  );
}
