import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { sampleTape } from "../data/sampleTape";
import type { Track } from "../data/types";

/**
 * One tape and its tracks, as the organiser pages see it. Two providers fill the same context:
 * DemoStoreProvider (sample data in this browser, for /demo/*) and LiveTapeProvider (the API, for /organiser/*).
 */
export interface Order {
  honoree: string;
  occasion: string;
  /** Year the guest of honour was born. The rotation strip on each card starts here. */
  bornYear: number;
  partyDate: string; // YYYY-MM-DD
  /** organiser's chosen close, local "YYYY-MM-DDTHH:mm". Unset means the suggested date. */
  closeAt?: string;
  planId: string;
  inkId?: string;
  organiserName: string;
  organiserEmail: string;
  slug: string;
  invited: number;
  paid: boolean;
  status: "draft" | "collecting" | "curating" | "approved";
}

export type TrackStatus = "new" | "approved" | "hidden";
export interface Contribution extends Track {
  status: TrackStatus;
  submittedAt: string; // ISO
}

interface State {
  order: Order;
  contributions: Contribution[];
}

export type Action =
  | { type: "order"; patch: Partial<Order> }
  | { type: "add"; contribution: Contribution }
  | { type: "update"; id: string; patch: Partial<Contribution> }
  | { type: "move"; id: string; dir: -1 | 1 }
  | { type: "sortByYear" }
  | { type: "replace"; state: State }
  | { type: "reset" };

/** Where the organiser pages link to. Different for the demo and for a real tape. */
export interface TapeLinks {
  dashboard: string;
  order: string;
  tape: string;
  /** The friend's form. */
  pick: string;
  /** The share link as shown to the organiser, without https://. */
  share: string;
}

export interface TapeCtx extends State {
  mode: "demo" | "live";
  dispatch: (a: Action) => void;
  links: TapeLinks;
  /** Last error from the server, shown above the page. */
  error: string;
  clearError: () => void;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

/** One more track than the sales page shows, so the dashboard has something to review. */
const extra: Track = {
  id: "t9mpo",
  contributor: "Mpho Dlamini",
  tagline: "Cousin, partner in crime",
  since: "1996-12-25",
  song: "Higher Love",
  artist: "Whitney Houston",
  message: "Gogo played this every Christmas and you made us do the whole routine for the aunties, every single year. I've known you your whole life and you're still my favourite.",
};

function initialState(): State {
  const tracks = [extra, ...sampleTape.tracks];
  return {
    order: {
      honoree: sampleTape.honoree,
      occasion: sampleTape.occasion,
      bornYear: sampleTape.bornYear,
      partyDate: iso(daysFromNow(32)),
      planId: "boxed",
      organiserName: "Kabelo",
      organiserEmail: "kabelo@example.com",
      slug: "nandi30",
      invited: 14,
      paid: true,
      status: "collecting",
    },
    contributions: tracks.map((t, i) => ({
      ...t,
      status: i > 0 && i < 4 ? "approved" : "new",
      submittedAt: daysFromNow(-9 + i).toISOString(),
    })),
  };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "order":
      return { ...state, order: { ...state.order, ...action.patch } };
    case "add": {
      // a new track lands in place by when that friend met the guest of honour
      const list = [...state.contributions];
      const at = list.findIndex((c) => c.since > action.contribution.since);
      list.splice(at < 0 ? list.length : at, 0, action.contribution);
      return { ...state, contributions: list };
    }
    case "update":
      return { ...state, contributions: state.contributions.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) };
    case "move": {
      const list = [...state.contributions];
      const i = list.findIndex((c) => c.id === action.id);
      if (i < 0) return state;
      // a track on the tape skips past hidden ones, so every move shows on the tape
      let j = i + action.dir;
      if (list[i].status !== "hidden") while (j >= 0 && j < list.length && list[j].status === "hidden") j += action.dir;
      if (j < 0 || j >= list.length) return state;
      [list[i], list[j]] = [list[j], list[i]];
      return { ...state, contributions: list };
    }
    case "sortByYear":
      return { ...state, contributions: [...state.contributions].sort((a, b) => a.since.localeCompare(b.since)) };
    case "replace":
      return action.state;
    case "reset":
      return initialState();
  }
}

const KEY = "yir-demo-v1";
function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    /* fall through to a fresh demo */
  }
  return initialState();
}

export const TapeContext = createContext<TapeCtx | null>(null);

export const DEMO_LINKS: TapeLinks = {
  dashboard: "/demo/organiser",
  order: "/demo/order",
  tape: "/demo/tape",
  pick: "/demo/pick",
  share: "minutes.qfm.co.za/nandi30",
};

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* private mode or a full store: the demo just won't survive a reload */
    }
  }, [state]);
  const value = useMemo<TapeCtx>(
    () => ({ ...state, dispatch, mode: "demo", links: { ...DEMO_LINKS, share: `minutes.qfm.co.za/${state.order.slug}` }, error: "", clearError: () => {} }),
    [state],
  );
  return <TapeContext.Provider value={value}>{children}</TapeContext.Provider>;
}

/** The tape the current page is about: the demo, or a real one from the API. */
export function useTape() {
  const ctx = useContext(TapeContext);
  if (!ctx) throw new Error("useTape needs DemoStoreProvider or LiveTapeProvider");
  return ctx;
}

/** Old name, kept so the demo pages read naturally. */
export const useDemoStore = useTape;

export const newId = () => Math.random().toString(36).slice(2, 7);
