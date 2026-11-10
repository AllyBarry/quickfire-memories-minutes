import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { atNoon, fmtDate, fmtDateTime, formatZar, inkById, inks, LIMITS, nextRun, planById, plans, timeline } from "@yir/shared";
import { api, ApiError, type ApiTape, type ApiTrack } from "../lib/api";
import { priceInfo, usePricing } from "../lib/pricing";
import { AdminPricing } from "../components/AdminPricing";
import "./flow.css";
import "../components/Field.css";
import "./AdminPage.css";

/** Staff-only. Cloudflare Access protects /admin and /api/admin/* in production. */
interface AdminTape extends ApiTape {
  owner: { name: string | null; email: string | null };
  tracks: number;
  hidden: number;
  paymentStatus: string | null;
  paidZar: number;
}
interface TapeDetail extends ApiTape {
  counts: { total: number; approved: number; hidden: number };
  members: { email: string; role: string; name: string; phone: string | null }[];
  payments: { provider: string; reference: string; amount_zar: number; status: string; note: string | null; created_at: string }[];
  tracks: ApiTrack[];
  audit: { at: string; actor_type: string; actor: string | null; action: string; detail: string | null }[];
  shareUrl: string;
}
interface Enquiry {
  id: string;
  name: string;
  email: string;
  honoree: string;
  occasion: string;
  party_date: string;
  plan_id: string;
  ink_id: string;
  born_year: number | null;
  invited: number | null;
  message: string | null;
  created_at: string;
}
interface OrganiserRow {
  email: string;
  name: string;
  phone: string | null;
  source: string;
  created_at: string;
  tapes: number;
  paid_zar: number;
  last_seen: string | null;
}

type Tab = "tapes" | "requests" | "add" | "organisers" | "pricing";
const STAGES = ["awaiting_payment", "collecting", "curating", "approved", "printing", "shipped", "delivered", "cancelled"] as const;
const STAGE_LABEL: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  collecting: "Collecting",
  curating: "Curating",
  approved: "Approved",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const FILTERS = [
  { id: "active", label: "Active" },
  { id: "all", label: "All" },
  { id: "collecting", label: "Collecting" },
  { id: "curating", label: "Curating" },
  { id: "print-queue", label: "Print queue" },
  { id: "printing", label: "Printing" },
  { id: "shipped", label: "Shipped" },
  { id: "delivered", label: "Delivered" },
] as const;
const ACTIVE = ["awaiting_payment", "collecting", "curating", "approved", "printing", "shipped"];
const isQueued = (t: { status: string; planId: string }) => t.status === "approved" && planById(t.planId).printed;

function InkDots({ id, large = false }: { id: string; large?: boolean }) {
  const ink = inkById(id);
  return (
    <span className={`admin__ink ${large ? "admin__ink--lg" : ""}`} title={ink.name} aria-label={`Inks: ${ink.name}`} role="img">
      <i style={{ background: ink.light.ink }} />
      <i style={{ background: ink.light.pop }} />
    </span>
  );
}

const errText = (err: unknown) => (err instanceof ApiError && err.status === 403 ? "Staff access only. Sign in through Cloudflare Access." : err instanceof Error ? err.message : "Something went wrong.");

export function AdminPage() {
  const [who, setWho] = useState<string | null>(null);
  const [denied, setDenied] = useState("");
  const [tab, setTab] = useState<Tab>("tapes");
  const [tapes, setTapes] = useState<AdminTape[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [prefill, setPrefill] = useState<Enquiry | null>(null);
  const [notice, setNotice] = useState("");
  usePricing(); // load today's prices early, for the add-organiser form

  const loadTapes = useCallback(() => api<AdminTape[]>("/api/admin/tapes").then(setTapes), []);
  const loadEnquiries = useCallback(() => api<Enquiry[]>("/api/admin/enquiries").then(setEnquiries), []);

  useEffect(() => {
    api<{ email: string }>("/api/admin/whoami")
      .then((w) => {
        setWho(w.email);
        return Promise.all([loadTapes(), loadEnquiries()]);
      })
      .catch((err) => setDenied(errText(err)));
  }, [loadTapes, loadEnquiries]);

  if (denied) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Site admin</p>
          <h1>Staff only</h1>
          <p>{denied}</p>
        </header>
      </div>
    );
  }
  if (!who) {
    return (
      <div className="wrap app" aria-busy="true">
        <p className="label muted">Loading the admin...</p>
      </div>
    );
  }

  const month = tapes.filter((t) => new Date(t.createdAt).getTime() > Date.now() - 30 * 864e5);
  const revenue = month.reduce((s, t) => s + t.paidZar, 0);

  return (
    <div className="wrap app admin">
      <header className="app__head">
        <p className="label app__eyebrow">Site admin · {who}</p>
        <h1>Everything in rotation</h1>
        <p>Every tape, request and organiser. Every change you make here is written to the audit log with your email.</p>
      </header>

      <div className="stats">
        <div className="stat">
          <b>{formatZar(revenue)}</b>
          <span>paid in the last 30 days ({month.length} tapes)</span>
        </div>
        <div className="stat">
          <b>{tapes.filter((t) => ACTIVE.includes(t.status)).length}</b>
          <span>tapes in progress</span>
        </div>
        <div className="stat">
          <b>{tapes.filter(isQueued).length}</b>
          <span>boxes for the {fmtDate(nextRun())} print run</span>
        </div>
        <div className="stat">
          <b>{enquiries.length}</b>
          <span>tape requests waiting</span>
        </div>
      </div>

      <div className="admin__tabs" role="tablist" aria-label="Admin sections">
        {(
          [
            ["tapes", "Tapes"],
            ["requests", "Requests"],
            ["add", "Add organiser"],
            ["organisers", "Organisers"],
            ["pricing", "Pricing"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}>
            {label}
            {id === "requests" && enquiries.length > 0 && <span className="admin__count">{enquiries.length}</span>}
          </button>
        ))}
      </div>

      {notice && (
        <p className="demo-note admin__notice" role="status">
          {notice}{" "}
          <button type="button" className="linkish" onClick={() => setNotice("")}>
            Dismiss
          </button>
        </p>
      )}

      {tab === "tapes" && <TapesTab tapes={tapes} reload={loadTapes} notify={setNotice} />}
      {tab === "requests" && (
        <RequestsTab
          enquiries={enquiries}
          onSetUp={(e) => {
            setPrefill(e);
            setTab("add");
          }}
          onHandled={async (id) => {
            try {
              await api(`/api/admin/enquiries/${id}/handled`, { method: "POST" });
              await loadEnquiries();
            } catch (err) {
              setNotice(errText(err));
            }
          }}
        />
      )}
      {tab === "add" && (
        <AddOrganiser
          key={prefill?.id ?? "blank"}
          prefill={prefill}
          onCreated={async (msg) => {
            setNotice(msg);
            setPrefill(null);
            await Promise.all([loadTapes(), loadEnquiries()]);
          }}
        />
      )}
      {tab === "organisers" && <OrganisersTab notify={setNotice} />}
      {tab === "pricing" && <AdminPricing notify={setNotice} />}
    </div>
  );
}

function TapesTab({ tapes, reload, notify }: { tapes: AdminTape[]; reload: () => Promise<void>; notify: (s: string) => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const shown = tapes.filter((t) => {
    const inFilter = filter === "all" ? true : filter === "active" ? ACTIVE.includes(t.status) : filter === "print-queue" ? isQueued(t) : t.status === filter;
    const inQuery = !q || [t.id, t.slug, t.honoree, t.owner.email ?? "", t.owner.name ?? ""].some((s) => s.toLowerCase().includes(q));
    return inFilter && inQuery;
  });
  return (
    <div id="panel-tapes" role="tabpanel" aria-labelledby="tab-tapes" className={`admin__orders ${selectedId ? "has-detail" : ""}`}>
      <div className="panel">
        <div className="admin__filters">
          <div className="row" role="group" aria-label="Filter by stage">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="filterchip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="field admin__search">
            <label htmlFor="admin-q" className="sr-only">
              Search tapes
            </label>
            <input id="admin-q" type="search" placeholder="Search name, slug, organiser or email" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">For</th>
                <th scope="col">Organiser</th>
                <th scope="col">Plan</th>
                <th scope="col">Party</th>
                <th scope="col">Songs</th>
                <th scope="col">Stage</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className={t.id === selectedId ? "is-on" : ""}>
                  <td>
                    <button type="button" className="admin__rowbtn" onClick={() => setSelectedId(t.id === selectedId ? null : t.id)} aria-expanded={t.id === selectedId}>
                      {t.honoree}
                    </button>
                    <div className="muted small">
                      {t.occasion} · /{t.slug}
                    </div>
                  </td>
                  <td>
                    {t.owner.name}
                    <div className="muted small">{t.owner.email}</div>
                  </td>
                  <td className="nowrap">
                    <InkDots id={t.inkId} />
                    {planById(t.planId).name}
                  </td>
                  <td className="nowrap">{fmtDate(atNoon(t.partyDate))}</td>
                  <td className="nowrap mono">
                    {t.tracks}/{t.invited}
                    {t.hidden ? <span className="chip chip--warn admin__flag">{t.hidden} hidden</span> : null}
                  </td>
                  <td>
                    <span className={`stage stage--${t.status}`}>{STAGE_LABEL[t.status] ?? t.status}</span>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted">
                    No tapes match. Try "All" or clear the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {selectedId && <TapeDetailPanel key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} notify={notify} />}
    </div>
  );
}

function TapeDetailPanel({ id, onClose, onChanged, notify }: { id: string; onClose: () => void; onChanged: () => Promise<void>; notify: (s: string) => void }) {
  const [t, setT] = useState<TapeDetail | null>(null);
  const [stage, setStage] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(
    () =>
      api<TapeDetail>(`/api/admin/tapes/${id}`)
        .then((d) => {
          setT(d);
          setStage(d.status);
        })
        .catch((err) => notify(errText(err))),
    [id, notify],
  );
  useEffect(() => {
    load();
  }, [load]);

  const run = async (what: () => Promise<unknown>, done: string) => {
    try {
      await what();
      notify(done);
      await Promise.all([load(), onChanged()]);
    } catch (err) {
      notify(errText(err));
    }
  };

  if (!t) {
    return (
      <aside className="panel admin__detail" aria-busy="true">
        <p className="muted">Loading...</p>
      </aside>
    );
  }
  const owner = t.members.find((m) => m.role === "owner");
  return (
    <aside className="panel admin__detail" aria-label={`Tape for ${t.honoree}`}>
      <div className="row row--between">
        <h2>
          {t.honoree} {t.occasion}
        </h2>
        <button type="button" className="linkish" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted small">
        {planById(t.planId).name} in {inkById(t.inkId).name} · born {t.bornYear} · id <span className="selectable">{t.id}</span>
        <br />
        <a href={t.shareUrl} target="_blank" rel="noopener noreferrer">
          {t.shareUrl.replace(/^https?:\/\//, "")}
        </a>
      </p>

      <div>
        <h3>Stage</h3>
        <div className="row">
          <div className="field">
            <label htmlFor="stage" className="sr-only">
              Stage
            </label>
            <select id="stage" value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <Button variant="ghost" disabled={stage === t.status} onClick={() => run(() => api(`/api/admin/tapes/${id}`, { method: "PATCH", json: { status: stage } }), `Moved to ${STAGE_LABEL[stage]}.`)}>
            Save stage
          </Button>
        </div>
      </div>

      <div>
        <h3>Organisers</h3>
        <ul className="admin__plain small">
          {t.members.map((m) => (
            <li key={m.email}>
              {m.name} ({m.role === "owner" ? "owner" : "co-organiser"}) <span className="selectable">{m.email}</span>
              {m.phone ? ` · ${m.phone}` : ""}
            </li>
          ))}
        </ul>
        {owner && (
          <Button variant="ghost" onClick={() => run(() => api(`/api/admin/organisers/${encodeURIComponent(owner.email)}/send-link`, { method: "POST", json: { tapeId: id } }), `Sign-in link sent to ${owner.email}.`)}>
            Send sign-in link
          </Button>
        )}
      </div>

      <div>
        <h3>Timeline</h3>
        <ol className="tl">
          {timeline(t.partyDate, planById(t.planId).printed, t.closeIsCustom ? t.closeAt : undefined).map((m) => (
            <li key={m.key}>
              <span>{m.label}</span>
              <time dateTime={m.date.toISOString()}>{m.key === "close" ? fmtDateTime(m.date) : fmtDate(m.date)}</time>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h3>Payments</h3>
        <ul className="admin__plain small">
          {t.payments.map((p) => (
            <li key={p.reference}>
              {p.provider} · {formatZar(p.amount_zar)} · <b>{p.status}</b>
              {p.note ? ` · ${p.note}` : ""}
            </li>
          ))}
          {t.payments.length === 0 && <li className="muted">None</li>}
        </ul>
      </div>

      <div>
        <h3>
          Songs ({t.counts.total}, {t.counts.approved} approved, {t.counts.hidden} hidden)
        </h3>
        <ul className="admin__plain small">
          {t.tracks.map((tr) => (
            <li key={tr.id}>
              <b>{tr.song}</b> by {tr.artist}, from {tr.contributor} <span className={`chip chip--${tr.status}`}>{tr.status}</span>{" "}
              {removing === tr.id ? (
                <span className="admin__remove">
                  <label htmlFor={`why-${tr.id}`} className="sr-only">
                    Reason for removal
                  </label>
                  <input id={`why-${tr.id}`} placeholder="Reason, e.g. contributor asked by email" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button
                    type="button"
                    className="linkish"
                    disabled={!reason.trim()}
                    onClick={() =>
                      run(() => api(`/api/admin/tracks/${tr.id}`, { method: "DELETE", json: { reason } }), `Removed "${tr.song}" and its photo.`).then(() => {
                        setRemoving(null);
                        setReason("");
                      })
                    }
                  >
                    Remove for good
                  </button>
                  <button type="button" className="linkish" onClick={() => setRemoving(null)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button type="button" className="linkish" onClick={() => setRemoving(tr.id)}>
                  Privacy removal
                </button>
              )}
            </li>
          ))}
          {t.tracks.length === 0 && <li className="muted">No songs yet.</li>}
        </ul>
      </div>

      <details>
        <summary className="small">Audit log ({t.audit.length})</summary>
        <ul className="admin__plain small">
          {t.audit.map((a, i) => (
            <li key={i}>
              {fmtDateTime(new Date(a.at))} · {a.actor_type} {a.actor ?? ""} · {a.action}
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}

function RequestsTab({ enquiries, onSetUp, onHandled }: { enquiries: Enquiry[]; onSetUp: (e: Enquiry) => void; onHandled: (id: string) => void }) {
  return (
    <div id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="panel">
      <h2>Tape requests</h2>
      <p className="muted small">People who asked for a tape while online payment is off. Agree payment with them, then set the tape up.</p>
      <ul className="admin__mod">
        {enquiries.map((e) => (
          <li key={e.id}>
            <InkDots id={e.ink_id} large />
            <div>
              <strong>
                {e.honoree} {e.occasion}, {planById(e.plan_id).name}
              </strong>
              <p className="small">
                {e.name} · <span className="selectable">{e.email}</span> · party {fmtDate(atNoon(e.party_date))} · about {e.invited ?? "?"} friends
              </p>
              {e.message && <p className="muted small">{e.message}</p>}
              <p className="muted small">Asked {fmtDateTime(new Date(e.created_at))}</p>
            </div>
            <div className="admin__actions">
              <Button onClick={() => onSetUp(e)}>Set up this tape</Button>
              <Button variant="ghost" onClick={() => onHandled(e.id)}>
                Mark handled
              </Button>
            </div>
          </li>
        ))}
        {enquiries.length === 0 && <li className="muted">No open requests.</li>}
      </ul>
    </div>
  );
}

function AddOrganiser({ prefill, onCreated }: { prefill: Enquiry | null; onCreated: (msg: string) => void }) {
  const prices = usePricing();
  const planPrice = (id: string) => {
    const pr = priceInfo(prices, id);
    return pr.was === null ? formatZar(pr.now) : `${formatZar(pr.now)} on sale, usually ${formatZar(pr.was)}`;
  };
  const [f, setF] = useState(() => ({
    name: prefill?.name ?? "",
    email: prefill?.email ?? "",
    phone: "",
    honoree: prefill?.honoree ?? "",
    occasion: prefill?.occasion ?? "turns 30",
    bornYear: String(prefill?.born_year ?? new Date().getFullYear() - 30),
    partyDate: prefill?.party_date ?? "",
    planId: prefill?.plan_id ?? "boxed",
    inkId: prefill?.ink_id ?? inks[0].id,
    invited: String(prefill?.invited ?? 20),
    paymentStatus: "paid" as "paid" | "comped",
    amountZar: String(priceInfo(prices, prefill?.plan_id ?? "boxed").now),
    note: "",
    sendLink: true,
    allowShortNotice: false,
  }));
  const [error, setError] = useState("");
  const [field, setField] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const err = (name: string) => (field === name ? error : undefined);

  const submit = async () => {
    setBusy(true);
    setError("");
    setField("");
    try {
      const res = await api<{ shareUrl: string; linkSent: boolean }>("/api/admin/organisers", {
        method: "POST",
        json: {
          name: f.name,
          email: f.email,
          phone: f.phone,
          tape: { honoree: f.honoree, occasion: f.occasion, bornYear: Number(f.bornYear), partyDate: f.partyDate, planId: f.planId, inkId: f.inkId, invited: Number(f.invited) },
          payment: { status: f.paymentStatus, amountZar: Number(f.amountZar), note: f.note },
          sendLink: f.sendLink,
          allowShortNotice: f.allowShortNotice,
          enquiryId: prefill?.id,
        },
      });
      onCreated(`Tape created: ${res.shareUrl}${res.linkSent ? `. Sign-in link sent to ${f.email}.` : "."}`);
    } catch (e) {
      setError(errText(e));
      if (e instanceof ApiError && e.field) setField(e.field.replace(/^tape\.|^payment\./, ""));
    } finally {
      setBusy(false);
    }
  };

  const generalError = error && !["name", "email", "phone", "honoree", "occasion", "bornYear", "partyDate", "invited", "amountZar", "note"].includes(field);

  return (
    <form
      id="panel-add"
      role="tabpanel"
      aria-labelledby="tab-add"
      className="panel admin__form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2>{prefill ? `Set up ${prefill.honoree}'s tape` : "Add an organiser and their tape"}</h2>
      <p className="muted small">For EFT orders, requests and complimentary tapes. The organiser gets an email with a sign-in link to their dashboard.</p>
      <div className="grid-2">
        <Field id="a-name" label="Organiser's name" value={f.name} onChange={(e) => set({ name: e.target.value })} error={err("name")} />
        <Field id="a-email" type="email" label="Organiser's email" value={f.email} onChange={(e) => set({ email: e.target.value })} error={err("email")} />
        <Field id="a-phone" label="Phone (optional)" value={f.phone} onChange={(e) => set({ phone: e.target.value })} error={err("phone")} />
      </div>
      <div className="grid-2">
        <Field id="a-honoree" label="Guest of honour" value={f.honoree} limit={LIMITS.honoree} onChange={(e) => set({ honoree: e.target.value })} error={err("honoree")} />
        <Field id="a-occasion" label="Occasion" value={f.occasion} onChange={(e) => set({ occasion: e.target.value })} error={err("occasion")} />
        <Field id="a-born" type="number" label="Year born" value={f.bornYear} onChange={(e) => set({ bornYear: e.target.value })} error={err("bornYear")} />
        <Field id="a-party" type="date" label="Party date" value={f.partyDate} onChange={(e) => set({ partyDate: e.target.value })} error={err("partyDate")} />
        <Field id="a-invited" type="number" label="Friends invited" value={f.invited} onChange={(e) => set({ invited: e.target.value })} error={err("invited")} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="a-plan">Plan</label>
          <select id="a-plan" value={f.planId} onChange={(e) => set({ planId: e.target.value, amountZar: String(priceInfo(prices, e.target.value).now) })}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({planPrice(p.id)})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-ink">Inks</label>
          <select id="a-ink" value={f.inkId} onChange={(e) => set({ inkId: e.target.value })}>
            {inks.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="a-paid">Payment</label>
          <select id="a-paid" value={f.paymentStatus} onChange={(e) => set({ paymentStatus: e.target.value as "paid" | "comped" })}>
            <option value="paid">Paid (EFT or card)</option>
            <option value="comped">Complimentary</option>
          </select>
        </div>
        {f.paymentStatus === "paid" && <Field id="a-amount" type="number" label="Amount paid (rand)" value={f.amountZar} onChange={(e) => set({ amountZar: e.target.value })} error={err("amountZar")} />}
      </div>
      <Field id="a-note" label="Payment note (optional)" hint="E.g. the EFT reference." value={f.note} onChange={(e) => set({ note: e.target.value })} error={err("note")} />
      <label className="admin__check">
        <input type="checkbox" checked={f.sendLink} onChange={(e) => set({ sendLink: e.target.checked })} /> Email the organiser their sign-in link now
      </label>
      <label className="admin__check">
        <input type="checkbox" checked={f.allowShortNotice} onChange={(e) => set({ allowShortNotice: e.target.checked })} /> Short notice: allow a party date inside the usual lead time
      </label>
      {generalError && (
        <p className="field__err" role="alert">
          {error}
        </p>
      )}
      <div className="row row--end">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating..." : "Create tape"}
        </Button>
      </div>
    </form>
  );
}

function OrganisersTab({ notify }: { notify: (s: string) => void }) {
  const [rows, setRows] = useState<OrganiserRow[] | null>(null);
  useEffect(() => {
    api<OrganiserRow[]>("/api/admin/organisers")
      .then(setRows)
      .catch((err) => notify(errText(err)));
  }, [notify]);
  const sorted = useMemo(() => rows ?? [], [rows]);
  return (
    <div id="panel-organisers" role="tabpanel" aria-labelledby="tab-organisers" className="panel">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Organiser</th>
              <th scope="col">Email</th>
              <th scope="col">Tapes</th>
              <th scope="col">Paid</th>
              <th scope="col">Last signed in</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((o) => (
              <tr key={o.email}>
                <td>
                  <strong>{o.name}</strong>
                  <div className="muted small">{o.source === "admin" ? "Added by staff" : "Checkout"}</div>
                </td>
                <td className="selectable">{o.email}</td>
                <td className="mono">{o.tapes}</td>
                <td className="mono nowrap">{formatZar(o.paid_zar)}</td>
                <td className="small">{o.last_seen ? fmtDateTime(new Date(o.last_seen)) : "Never"}</td>
                <td>
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      api(`/api/admin/organisers/${encodeURIComponent(o.email)}/send-link`, { method: "POST", json: {} })
                        .then(() => notify(`Sign-in link sent to ${o.email}.`))
                        .catch((err) => notify(errText(err)))
                    }
                  >
                    Send link
                  </button>
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No organisers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
