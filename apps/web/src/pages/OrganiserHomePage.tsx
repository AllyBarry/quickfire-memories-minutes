import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { atNoon, fmtDate, fmtDateTime, planById } from "@yir/shared";
import { api, ApiError, type ApiTape } from "../lib/api";
import { navigate } from "../lib/router";
import { SHOW_DEMO } from "../lib/flags";
import "./flow.css";

interface Me {
  email: string;
  name: string | null;
  tapes: (ApiTape & { role: string })[];
}

const STATUS: Record<string, string> = {
  collecting: "Collecting songs",
  curating: "Set the running order",
  approved: "Approved",
  printing: "Printing",
  shipped: "On its way",
  delivered: "Delivered",
  awaiting_payment: "Waiting for payment",
};

/** /organiser: sign in with a magic link, then pick a tape. `next` is where a link should land. */
export function OrganiserHomePage({ next }: { next?: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [state, setState] = useState<"loading" | "signed-out" | "signed-in" | "failed">("loading");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const safeNext = next && next.startsWith("/organiser/") ? next : "/organiser";

  useEffect(() => {
    api<Me>("/api/me")
      .then((m) => {
        setMe(m);
        setState("signed-in");
        // one tape and a link that asked for the dashboard: go straight there
        if (next && next.startsWith("/organiser/")) navigate(next, { replace: true });
        else if (m.tapes.length === 1 && !next) navigate(`/organiser/${m.tapes[0].id}`, { replace: true });
      })
      .catch((err) => setState(err instanceof ApiError && err.status === 401 ? "signed-out" : "failed"));
  }, [next]);

  const signIn = async () => {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter the email address you used for your tape.");
    setBusy(true);
    try {
      await api("/api/auth/sign-in/magic-link", { method: "POST", json: { email: email.trim().toLowerCase(), callbackURL: `${window.location.origin}${safeNext}` } });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Too many tries. Wait a minute and try again." : err instanceof Error ? err.message : "That didn't send. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await api("/api/auth/sign-out", { method: "POST", json: {} }).catch(() => undefined);
    setMe(null);
    setState("signed-out");
  };

  if (state === "loading") {
    return (
      <div className="wrap app" aria-busy="true">
        <p className="label muted">Checking if you're signed in...</p>
      </div>
    );
  }

  if (state === "signed-out" || state === "failed") {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Organisers</p>
          <h1>Sign in to your tape</h1>
          <p>No password. We email you a link that signs you in on this device. It works once and lasts 15 minutes.</p>
        </header>
        <div className="split">
          {sent ? (
            <div className="panel" role="status">
              <h2>Check your email</h2>
              <p>
                If {email} runs a tape with us, a sign-in link is on its way. It can take a minute. Check spam if it doesn't arrive.
              </p>
              <button type="button" className="linkish" onClick={() => setSent(false)}>
                Use a different email
              </button>
            </div>
          ) : (
            <form
              className="panel"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                signIn();
              }}
            >
              {state === "failed" && <p className="demo-note">We couldn't check your sign-in. You can still ask for a link.</p>}
              <Field id="signin-email" type="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoComplete="email" />
              <div className="row row--end">
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Email me a link"}
                </Button>
              </div>
            </form>
          )}
          <aside>
            <div className="panel">
              <h3>No tape yet?</h3>
              <p className="muted small">{SHOW_DEMO ? "Start one, or try the organiser dashboard on sample data first." : "Ask whoever organised it to add you, or start one of your own."}</p>
              <div className="row">
                <Button href="/start">Start a tape</Button>
                {SHOW_DEMO && (
                  <Button href="/demo/organiser" variant="ghost">
                    Try the demo
                  </Button>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">Signed in as {me?.email}</p>
        <h1>Your tapes</h1>
      </header>
      {me && me.tapes.length === 0 && <p className="muted">There are no tapes on this email yet.</p>}
      <div className="grid-2">
        {me?.tapes.map((t) => (
          <a key={t.id} className="panel tapecard" href={`/organiser/${t.id}`}>
            <span className="label app__eyebrow">{STATUS[t.status] ?? t.status}</span>
            <b>
              {t.honoree} {t.occasion}
            </b>
            <span className="muted small">
              {planById(t.planId).name} · party {fmtDate(atNoon(t.partyDate))}
              {t.open ? ` · picks close ${fmtDateTime(new Date(t.closeAt))}` : ""}
            </span>
          </a>
        ))}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}

/** Paystack sends buyers back here. The webhook does the real work, so this page only explains what's next. */
export function CheckoutCompletePage() {
  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">Payment</p>
        <h1>Thank you. Your tape is on its way.</h1>
        <p>As soon as Paystack confirms the payment, we email you a link to your dashboard with the share link for the group chat. It usually takes under a minute.</p>
      </header>
      <div className="row">
        <Button href="/organiser">Go to sign in</Button>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="wrap app">
      <header className="app__head">
        <p className="label app__eyebrow">Side C</p>
        <h1>There's nothing on this side of the tape</h1>
        <p>Check the link, or start from the beginning.</p>
      </header>
      <Button href="/">Back to the start</Button>
    </div>
  );
}
