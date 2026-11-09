import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { inkById, inks } from "../data/inks";
import type { Ink } from "../data/types";

/** The buyer's chosen inks, written to the root element as --pal-* variables that tokens.css reads. */
interface Ctx {
  ink: Ink;
  setInk: (id: string) => void;
}
const InkCtx = createContext<Ctx | null>(null);
const KEY = "yir-ink-v1";

export function inkVars(ink: Ink): Record<string, string> {
  const out: Record<string, string> = {};
  for (const mode of ["light", "dark"] as const) {
    const s = ink[mode];
    const suffix = mode === "dark" ? "-dark" : "";
    out[`--pal-ink${suffix}`] = s.ink;
    out[`--pal-pop${suffix}`] = s.pop;
    out[`--pal-pop-text${suffix}`] = s.popText;
    out[`--pal-paper${suffix}`] = s.paper;
    out[`--pal-card${suffix}`] = s.card;
  }
  return out;
}

export function InkProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? inks[0].id;
    } catch {
      return inks[0].id;
    }
  });
  const ink = inkById(id);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    for (const [k, v] of Object.entries(inkVars(ink))) style.setProperty(k, v);
    try {
      localStorage.setItem(KEY, ink.id);
    } catch {
      /* private mode: the choice just won't survive a reload */
    }
  }, [ink]);
  const value = useMemo(() => ({ ink, setInk: setId }), [ink]);
  return <InkCtx.Provider value={value}>{children}</InkCtx.Provider>;
}

export function useInk() {
  const ctx = useContext(InkCtx);
  if (!ctx) throw new Error("useInk needs InkProvider");
  return ctx;
}
