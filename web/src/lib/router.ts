import { useEffect, useState } from "react";

/**
 * A small path router. Real paths (not "#/...") so Cloudflare Access can protect /admin,
 * and so share links and QR links are plain URLs. "/#pricing" is a section on the home page.
 */
export interface Route {
  path: string;
  /** Path split on "/", without empty parts: "/organiser/abc/order" is ["organiser", "abc", "order"]. */
  parts: string[];
  hash: string;
  query: URLSearchParams;
}

const EVENT = "yir:navigate";

function read(): Route {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return {
    path,
    parts: path.split("/").filter(Boolean).map(decodeURIComponent),
    hash: window.location.hash.slice(1),
    query: new URLSearchParams(window.location.search),
  };
}

/** Paths the server answers (Pages Functions). Links to these must load normally. */
const SERVER_PATHS = /^\/(api|go)\//;

export function navigate(to: string, { replace = false } = {}) {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin || SERVER_PATHS.test(url.pathname)) {
    window.location.assign(url.toString());
    return;
  }
  window.history[replace ? "replaceState" : "pushState"](null, "", url.pathname + url.search + url.hash);
  window.dispatchEvent(new Event(EVENT));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener("popstate", on);
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener("popstate", on);
      window.removeEventListener(EVENT, on);
    };
  }, []);
  useEffect(() => {
    const target = route.hash && /^[a-z][\w-]*$/i.test(route.hash) ? document.getElementById(route.hash) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth" }));
    else window.scrollTo(0, 0);
  }, [route.path, route.hash]);
  return route;
}

/** Turn same-site <a href="/..."> clicks into client-side navigation. */
export function useLinkInterception() {
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//") || SERVER_PATHS.test(href)) return;
      e.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", on);
    return () => document.removeEventListener("click", on);
  }, []);
}
