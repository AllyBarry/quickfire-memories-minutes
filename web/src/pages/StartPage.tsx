import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Cassette } from "../components/Cassette";
import { Field } from "../components/Field";
import { InkPicker } from "../components/InkPicker";
import { ShareLink } from "../components/ShareLink";
import { formatZar, planById, plans } from "../data/plans";
import { api, ApiError } from "../lib/api";
import { useTape, type Order } from "../lib/demoStore";
import { useInk } from "../lib/InkContext";
import { daysUntil, fmtDate, minDigitalDate, minPrintedDate, timeline } from "../lib/timeline";
import "./flow.css";

const STEPS = ["Who it's for", "Plan and inks", "Your details", "Pay"] as const;
const OCCASIONS = ["turns 30", "turns 40", "turns 50", "turns 60", "is getting married", "is retiring", "is moving away"];
const THIS_YEAR = new Date().getFullYear();

const blankOrder = (planId: string): Order => ({
  honoree: "",
  occasion: "turns 30",
  bornYear: THIS_YEAR - 30,
  partyDate: "",
  planId: plans.some((p) => p.id === planId) ? planId : "boxed",
  organiserName: "",
  organiserEmail: "",
  slug: "",
  invited: 20,
  paid: false,
  status: "draft",
});

/**
 * Checkout. `live`: the real store (Paystack when it's switched on, otherwise a "reserve a tape" request).
 * Otherwise the demo, which saves into the demo store and simulates payment.
 */
export function StartPage({ live = false, initialPlan = "boxed" }: { live?: boolean; initialPlan?: string }) {
  const store = useTape();
  const { ink } = useInk();
  const [liveOrder, setLiveOrder] = useState<Order>(() => blankOrder(initialPlan));
  const order = live ? liveOrder : store.order;
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"" | "paid" | "requested">("");
  const [checkoutOpen, setCheckoutOpen] = useState<boolean | null>(live ? null : true);
  const [note, setNote] = useState("");
  const [payError, setPayError] = useState("");
  const plan = planById(order.planId);
  const printed = plan.printed;

  useEffect(() => {
    if (!live) return;
    api<{ enabled: boolean }>("/api/checkout")
      .then((r) => setCheckoutOpen(r.enabled))
      .catch(() => setCheckoutOpen(false));
  }, [live]);

  // a new party date or plan moves the deadlines, so drop any custom close time
  const set = (patch: Partial<Order>) => {
    if (live) return setLiveOrder((o) => ({ ...o, ...patch }));
    store.dispatch({ type: "order", patch: "partyDate" in patch || "planId" in patch ? { ...patch, closeAt: undefined } : patch });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!order.honoree.trim()) e.honoree = "Add the name that goes on the tape.";
      if (!order.bornYear || order.bornYear < 1910 || order.bornYear > THIS_YEAR) e.bornYear = `Add a year between 1910 and ${THIS_YEAR}.`;
      if (!order.partyDate) e.partyDate = "Pick the party date.";
      else if (printed && order.partyDate < minPrintedDate()) e.partyDate = "Too soon for a printed box. Choose Digital, or a date at least three weeks away.";
      else if (order.partyDate < minDigitalDate()) e.partyDate = "Pick a date at least five days away so friends have time to choose.";
    }
    if (step === 1 && printed && order.partyDate < minPrintedDate()) e.plan = "A printed box can't arrive before this party date. Choose Digital or change the date.";
    if (step === 2) {
      if (!order.organiserName.trim()) e.organiserName = "Add your name.";
      if (!/^\S+@\S+\.\S+$/.test(order.organiserEmail)) e.organiserEmail = "Add an email address we can send the link to.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const next = () => validate() && setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const details = () => ({
    name: order.organiserName.trim(),
    email: order.organiserEmail.trim(),
    honoree: order.honoree.trim(),
    occasion: order.occasion,
    bornYear: order.bornYear,
    partyDate: order.partyDate,
    planId: order.planId,
    inkId: ink.id,
    invited: order.invited,
  });

  const showServerError = (err: unknown) => {
    if (err instanceof ApiError && err.field) {
      const stepOf: Record<string, number> = { honoree: 0, bornYear: 0, partyDate: 0, occasion: 0, invited: 0, planId: 1, name: 2, email: 2 };
      const field = err.field === "name" ? "organiserName" : err.field === "email" ? "organiserEmail" : err.field;
      setErrors({ [field]: err.message });
      setStep(stepOf[err.field] ?? step);
    } else setPayError(err instanceof Error ? err.message : "That didn't go through. Try again.");
  };

  const pay = async () => {
    setPayError("");
    setBusy(true);
    if (!live) {
      setTimeout(() => {
        setBusy(false);
        const age = order.occasion.replace(/\D/g, "");
        set({ paid: true, status: "collecting", slug: order.honoree.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + age });
        setDone("paid");
      }, 1400);
      return;
    }
    try {
      if (checkoutOpen) {
        const res = await api<{ paymentUrl: string }>("/api/checkout", { method: "POST", json: details() });
        window.location.assign(res.paymentUrl);
        return;
      }
      await api("/api/public/enquiries", { method: "POST", json: { ...details(), message: note } });
      setDone("requested");
      window.scrollTo(0, 0);
    } catch (err) {
      showServerError(err);
    } finally {
      setBusy(false);
    }
  };

  const milestones = order.partyDate ? timeline(order.partyDate, printed, order.closeAt) : [];

  if (done === "requested") {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Request sent</p>
          <h1>We'll set up {order.honoree}'s tape</h1>
          <p>
            We'll email {order.organiserEmail} within one working day with how to pay. As soon as that's done, you get your share link and dashboard.
          </p>
        </header>
        <div className="split">
          <div className="panel">
            <h2>Your timeline</h2>
            <ol className="tl">
              {milestones.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <time dateTime={m.date.toISOString()}>{fmtDate(m.date)}</time>
                </li>
              ))}
            </ol>
            <div className="row">
              <Button href="/demo/organiser" variant="ghost">
                Try the dashboard demo meanwhile
              </Button>
            </div>
          </div>
          <aside>
            <Summary order={order} />
          </aside>
        </div>
      </div>
    );
  }

  if (done === "paid") {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Order confirmed</p>
          <h1>{order.honoree}'s tape is ready for songs</h1>
          <p>Share this link in the group chat. Everyone who opens it can pick one song and write the liner note behind it.</p>
        </header>
        <div className="split">
          <div className="panel">
            <h2>Your share link</h2>
            <ShareLink link={`minutes.qfm.co.za/${order.slug}`} />
            <h3>What happens next</h3>
            <ol className="tl">
              {milestones.map((m) => (
                <li key={m.key}>
                  <span>{m.label}</span>
                  <time dateTime={m.date.toISOString()}>{fmtDate(m.date)}</time>
                </li>
              ))}
            </ol>
            <div className="row">
              <Button href={store.links.dashboard}>Open your dashboard</Button>
              <Button href={store.links.pick} variant="ghost">
                See what friends see
              </Button>
            </div>
          </div>
          <aside>
            <Summary order={order} />
          </aside>
        </div>
      </div>
    );
  }

  const payStepTitle = live && checkoutOpen === false ? "Reserve your tape" : "Pay";

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">{live ? "Start a tape" : "Demo checkout"}</p>
        <h1>Make a tape for someone you love</h1>
        <p>Four quick steps. You can change the inks and fix any track later, before anything prints.</p>
      </header>

      <ol className="stepper" aria-label="Checkout steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={i < step ? "is-done" : ""}>
            {i === 3 ? payStepTitle : s}
          </li>
        ))}
      </ol>

      <div className="split">
        <form
          className="panel"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEPS.length - 1) next();
          }}
        >
          {step === 0 && (
            <>
              <h2>Who is the tape for?</h2>
              <Field id="honoree" label="Their name, as it goes on the label" value={order.honoree} limit={14} onChange={(e) => set({ honoree: e.target.value })} error={errors.honoree} autoComplete="off" />
              <div className="field">
                <label htmlFor="occasion">The occasion</label>
                <select id="occasion" value={order.occasion} onChange={(e) => set({ occasion: e.target.value })}>
                  {OCCASIONS.map((o) => (
                    <option key={o} value={o}>
                      {order.honoree || "They"} {o}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="bornYear"
                type="number"
                inputMode="numeric"
                label="Year they were born"
                hint="Each liner note draws their life so far, with that friendship filled in."
                value={String(order.bornYear || "")}
                min={1910}
                max={THIS_YEAR}
                onChange={(e) => set({ bornYear: Number(e.target.value) || 0 })}
                error={errors.bornYear}
              />
              <Field id="partyDate" type="date" label="Party date" hint="We work the deadlines back from this date." value={order.partyDate} min={minDigitalDate()} onChange={(e) => set({ partyDate: e.target.value })} error={errors.partyDate} />
              <div className="field">
                <label htmlFor="invited">Roughly how many friends will you invite?</label>
                <p className="field__hint" id="invited-hint">
                  Only used to show progress on your dashboard.
                </p>
                <input id="invited" type="number" inputMode="numeric" min={1} max={80} aria-describedby="invited-hint" value={order.invited} onChange={(e) => set({ invited: Math.max(1, Math.min(80, Number(e.target.value) || 1)) })} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Choose a plan</h2>
              <div className="opts" role="radiogroup" aria-label="Plan">
                {plans.map((p) => {
                  const tooSoon = p.printed && !!order.partyDate && order.partyDate < minPrintedDate();
                  return (
                    <label key={p.id} className="opt" aria-disabled={tooSoon}>
                      <input type="radio" name="plan" value={p.id} checked={order.planId === p.id} disabled={tooSoon} onChange={() => set({ planId: p.id })} />
                      <b>{p.name}</b>
                      <span className="price">{formatZar(p.priceZar)}</span>
                      <small>{tooSoon ? "Not enough time to print before the party" : `Up to ${p.tracks} friends${p.printed ? ", printed box" : ""}`}</small>
                    </label>
                  );
                })}
              </div>
              {errors.plan && <p className="field__err">{errors.plan}</p>}
              <InkPicker label="Tape inks" />
            </>
          )}

          {step === 2 && (
            <>
              <h2>Your details</h2>
              <p className="muted">We send the share link, reminders and your dashboard link here.{live ? "" : " Nothing is sent in this demo."}</p>
              <Field id="organiserName" label="Your name" value={order.organiserName} limit={60} onChange={(e) => set({ organiserName: e.target.value })} error={errors.organiserName} autoComplete="name" />
              <Field id="organiserEmail" type="email" label="Email" value={order.organiserEmail} onChange={(e) => set({ organiserEmail: e.target.value })} error={errors.organiserEmail} autoComplete="email" />
              {printed && <p className="muted">You'll add the delivery address after you approve the running order, so it can go straight to the party venue.</p>}
            </>
          )}

          {step === 3 && (
            <>
              <h2>{payStepTitle}</h2>
              {!live && <p className="demo-note">Demo store: no payment is taken and no card details are asked for. The real checkout hands over to Paystack's own secure page.</p>}
              {live && checkoutOpen === false && (
                <>
                  <p className="muted">Online payment opens soon. Send this request and we'll email you within one working day with how to pay (card link or EFT). Your share link follows as soon as it's paid.</p>
                  <Field id="note" multiline label="Anything we should know? (optional)" value={note} limit={500} onChange={(e) => setNote(e.target.value)} />
                </>
              )}
              {live && checkoutOpen && <p className="muted">You'll pay on Paystack's secure page. We never see your card details.</p>}
              <dl className="paysum">
                <div>
                  <dt>
                    {plan.name} tape in {ink.name}
                  </dt>
                  <dd>{formatZar(plan.priceZar)}</dd>
                </div>
                {printed && (
                  <div>
                    <dt>Delivery</dt>
                    <dd>Included</dd>
                  </div>
                )}
                <div className="paysum__total">
                  <dt>Total</dt>
                  <dd>{formatZar(plan.priceZar)}</dd>
                </div>
              </dl>
              {payError && (
                <p className="field__err" role="alert">
                  {payError}
                </p>
              )}
              <Button onClick={pay} disabled={busy || checkoutOpen === null}>
                {busy
                  ? live && !checkoutOpen
                    ? "Sending..."
                    : "Opening payment..."
                  : !live
                    ? `Pay ${formatZar(plan.priceZar)} with Paystack (demo)`
                    : checkoutOpen
                      ? `Pay ${formatZar(plan.priceZar)} with Paystack`
                      : "Send request"}
              </Button>
            </>
          )}

          <div className="row row--end">
            {step > 0 && (
              <Button variant="ghost" onClick={back}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 && <Button type="submit">Continue</Button>}
          </div>
        </form>

        <aside>
          <Summary order={order} />
          {order.partyDate && (
            <div className="panel">
              <h3>Your timeline</h3>
              <p className="muted small">{daysUntil(new Date(`${order.partyDate}T12:00:00`))} days until the party.</p>
              <ol className="tl">
                {milestones.map((m) => (
                  <li key={m.key}>
                    <span>{m.label}</span>
                    <time dateTime={m.date.toISOString()}>{fmtDate(m.date)}</time>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Summary({ order }: { order: Order }) {
  const plan = planById(order.planId);
  const age = order.occasion.replace(/\D/g, "");
  return (
    <div className="panel summary">
      <Cassette label={`${order.honoree || "Their name"} ${age}`.trim()} title="Your tape" />
      <div>
        <h3>{plan.name} tape</h3>
        <p className="muted small">
          For {order.honoree || "..."}, who {order.occasion}
        </p>
        <p className="summary__price">{formatZar(plan.priceZar)}</p>
      </div>
    </div>
  );
}
