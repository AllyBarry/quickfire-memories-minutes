import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../components/Button";
import { api, ApiError, type ApiTape, type ApiTrack } from "./api";
import { reducer, TapeContext, type Action, type Contribution, type Order, type TapeCtx } from "./demoStore";
import { useInk } from "./InkContext";
import { navigate } from "./router";
import { toLocalInput } from "./timeline";

interface DashboardTape extends ApiTape {
  organiserName: string | null;
  organiserEmail: string | null;
}

type State = { order: Order; contributions: Contribution[] };

const LIVE = ["approved", "printing", "shipped", "delivered"];

export function toOrder(t: DashboardTape): Order {
  return {
    honoree: t.honoree,
    occasion: t.occasion,
    bornYear: t.bornYear,
    partyDate: t.partyDate,
    closeAt: t.closeIsCustom ? toLocalInput(new Date(t.closeAt)) : undefined,
    planId: t.planId,
    inkId: t.inkId,
    organiserName: t.organiserName ?? "",
    organiserEmail: t.organiserEmail ?? "",
    slug: t.slug,
    invited: t.invited,
    paid: true,
    status: LIVE.includes(t.status) ? "approved" : t.status === "curating" ? "curating" : "collecting",
  };
}

export function toContribution(t: ApiTrack): Contribution {
  return {
    id: t.id,
    contributor: t.contributor,
    tagline: t.tagline,
    since: t.since,
    song: t.song,
    artist: t.artist,
    link: t.link ?? undefined,
    message: t.message,
    photo: t.photo ?? undefined,
    qr: t.qr,
    status: t.status,
    submittedAt: t.createdAt,
  };
}

const TRACK_FIELDS = ["contributor", "tagline", "since", "song", "artist", "link", "message", "status"] as const;

/** A real tape from the API, behind the same context the demo pages use. */
export function LiveTapeProvider({ tapeId, children }: { tapeId: string; children: ReactNode }) {
  const { setInk } = useInk();
  const [state, setState] = useState<State | null>(null);
  const [problem, setProblem] = useState<"" | "not_found" | "failed">("");
  const [error, setError] = useState("");
  const stateRef = useRef<State | null>(null);
  stateRef.current = state;
  const pending = useRef(new Map<string, { fields: Record<string, unknown>; timer?: number }>());
  const orderTimer = useRef<number>();

  const load = useCallback(async () => {
    try {
      const [tape, tracks] = await Promise.all([api<DashboardTape>(`/api/tapes/${tapeId}`), api<ApiTrack[]>(`/api/tapes/${tapeId}/tracks`)]);
      setState({ order: toOrder(tape), contributions: tracks.map(toContribution) });
      setInk(tape.inkId);
      setProblem("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate(`/organiser?next=${encodeURIComponent(window.location.pathname)}`, { replace: true });
        return;
      }
      setProblem(err instanceof ApiError && err.status === 404 ? "not_found" : "failed");
    }
  }, [tapeId, setInk]);

  useEffect(() => {
    load();
  }, [load]);

  const fail = useCallback(
    (err: unknown) => {
      setError(err instanceof Error ? err.message : "That change didn't save. Try again.");
      load(); // put the page back in step with what the server has
    },
    [load],
  );

  const reloadTape = useCallback(async () => {
    const tape = await api<DashboardTape>(`/api/tapes/${tapeId}`);
    setState((s) => (s ? { ...s, order: toOrder(tape) } : s));
  }, [tapeId]);

  const flushTrack = useCallback(
    (id: string) => {
      const p = pending.current.get(id);
      if (!p) return;
      window.clearTimeout(p.timer);
      pending.current.delete(id);
      api(`/api/tapes/${tapeId}/tracks/${id}`, { method: "PATCH", json: p.fields }).catch(fail);
    },
    [tapeId, fail],
  );

  const sendOrder = useCallback(() => {
    window.clearTimeout(orderTimer.current);
    orderTimer.current = window.setTimeout(() => {
      const ids = stateRef.current?.contributions.map((c) => c.id) ?? [];
      api(`/api/tapes/${tapeId}/tracks/order`, { method: "POST", json: { ids } }).catch(fail);
    }, 500);
  }, [tapeId, fail]);

  const dispatch = useCallback(
    (action: Action) => {
      setState((s) => (s ? reducer(s, action) : s));
      setError("");
      switch (action.type) {
        case "order": {
          const p = action.patch;
          const run = async () => {
            if ("closeAt" in p) {
              // CloseDateEditor: "close now" sets status curating, a new time sets collecting, unset means suggested
              const closeAt = p.status === "curating" ? "now" : p.closeAt ? new Date(p.closeAt).toISOString() : null;
              await api(`/api/tapes/${tapeId}`, { method: "PATCH", json: { closeAt } });
            } else if (p.status === "approved") {
              // send any edits still waiting first, so the server sees every approval
              for (const id of [...pending.current.keys()]) flushTrack(id);
              await api(`/api/tapes/${tapeId}/approve`, { method: "POST" });
            } else if (p.status === "curating") {
              await api(`/api/tapes/${tapeId}/reopen`, { method: "POST" });
            }
            const rest: Record<string, unknown> = {};
            if ("inkId" in p) rest.inkId = p.inkId;
            if ("invited" in p) rest.invited = p.invited;
            if (Object.keys(rest).length) await api(`/api/tapes/${tapeId}`, { method: "PATCH", json: rest });
            await reloadTape();
          };
          run().catch(fail);
          break;
        }
        case "update": {
          const fields: Record<string, unknown> = {};
          for (const k of TRACK_FIELDS) if (k in action.patch) fields[k] = action.patch[k as keyof Contribution];
          if (!Object.keys(fields).length) break;
          const p = pending.current.get(action.id) ?? { fields: {} };
          Object.assign(p.fields, fields);
          window.clearTimeout(p.timer);
          pending.current.set(action.id, p);
          // a status change (approve, hide) saves straight away, typing waits for a pause
          if ("status" in fields && !TRACK_FIELDS.slice(0, -1).some((k) => k in fields)) flushTrack(action.id);
          else p.timer = window.setTimeout(() => flushTrack(action.id), 700);
          break;
        }
        case "move":
        case "sortByYear":
          sendOrder();
          break;
        case "add":
        case "replace":
        case "reset":
          break;
      }
    },
    [tapeId, fail, flushTrack, sendOrder, reloadTape],
  );

  // save anything still waiting when the organiser leaves the page
  useEffect(
    () => () => {
      for (const id of [...pending.current.keys()]) flushTrack(id);
    },
    [flushTrack],
  );

  const value = useMemo<TapeCtx | null>(() => {
    if (!state) return null;
    const slug = state.order.slug;
    return {
      ...state,
      mode: "live",
      dispatch,
      error,
      clearError: () => setError(""),
      links: {
        dashboard: `/organiser/${tapeId}`,
        order: `/organiser/${tapeId}/order`,
        tape: `/organiser/${tapeId}/tape`,
        pick: `/${slug}`,
        share: `${window.location.host}/${slug}`,
      },
    };
  }, [state, dispatch, error, tapeId]);

  if (problem) {
    return (
      <div className="wrap app">
        <header className="app__head">
          <p className="label app__eyebrow">Organiser</p>
          <h1>{problem === "not_found" ? "We couldn't find that tape" : "That didn't load"}</h1>
          <p>{problem === "not_found" ? "It may belong to a different email address. Sign in with the address the tape was set up for." : "Check your connection and try again."}</p>
        </header>
        <div className="row">
          {problem === "failed" && <Button onClick={load}>Try again</Button>}
          <Button href="/organiser" variant="ghost">
            Your tapes
          </Button>
        </div>
      </div>
    );
  }
  if (!value) {
    return (
      <div className="wrap app" aria-busy="true">
        <p className="label muted">Loading the tape...</p>
      </div>
    );
  }
  return (
    <TapeContext.Provider value={value}>
      {error && (
        <div className="wrap">
          <p className="demo-note app-error" role="alert">
            {error}{" "}
            <button type="button" className="linkish" onClick={() => setError("")}>
              Dismiss
            </button>
          </p>
        </div>
      )}
      {children}
    </TapeContext.Provider>
  );
}
