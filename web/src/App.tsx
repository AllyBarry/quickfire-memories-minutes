import { useEffect, type ReactNode } from "react";
import { navigate, useLinkInterception, useRoute } from "./lib/router";
import { InkProvider } from "./lib/InkContext";
import { DemoStoreProvider } from "./lib/demoStore";
import { LiveTapeProvider } from "./lib/liveTape";
import { SiteHeader } from "./components/SiteHeader";
import { SiteFooter } from "./components/SiteFooter";
import { HomePage } from "./pages/HomePage";
import { TapePage } from "./pages/TapePage";
import { StartPage } from "./pages/StartPage";
import { ContributePage } from "./pages/ContributePage";
import { OrganiserPage } from "./pages/OrganiserPage";
import { CuratePage } from "./pages/CuratePage";
import { AdminPage } from "./pages/AdminPage";
import { PublicTapePage } from "./pages/PublicTapePage";
import { EditTrackPage } from "./pages/EditTrackPage";
import { CheckoutCompletePage, NotFoundPage, OrganiserHomePage } from "./pages/OrganiserHomePage";

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function DemoBanner() {
  return (
    <div className="wrap">
      <p className="demo-note demo-banner">
        Demo on sample data, kept in this browser. Nothing is sent. <a href="/start">Start a real tape</a>
      </p>
    </div>
  );
}

/**
 * Routes. Real pages use paths so Cloudflare Access can protect /admin and share links stay plain:
 *   /                         sales page          /start                    checkout
 *   /<slug>                   share link: song pick, then the finished tape
 *   /<slug>/edit/<id>#token   a friend's private edit link
 *   /organiser                sign in, your tapes /organiser/<id>[/order|/tape]  dashboard, running order, preview
 *   /admin                    staff (Cloudflare Access)
 *   /demo/...                 the clickable demo on sample data
 * /api/* and /go/* never reach this app: Pages Functions answer them.
 */
function Page({ parts, hash, query }: { parts: string[]; hash: string; query: URLSearchParams }): ReactNode {
  const [a, b, c] = parts;
  if (!a) return <HomePage />;
  switch (a) {
    case "start":
      return parts.length === 1 ? <StartPage live initialPlan={query.get("plan") ?? "boxed"} /> : <NotFoundPage />;
    case "checkout":
      return b === "complete" ? <CheckoutCompletePage /> : <NotFoundPage />;
    case "admin":
      return <AdminPage />;
    case "demo": {
      const page =
        b === "start" ? <StartPage /> : b === "pick" ? <ContributePage /> : b === "organiser" ? <OrganiserPage /> : b === "order" ? <CuratePage /> : b === "tape" ? <TapePage /> : null;
      if (!page) return <Redirect to="/#flow" />;
      return (
        <>
          <DemoBanner />
          {page}
        </>
      );
    }
    case "organiser": {
      if (!b) return <OrganiserHomePage next={query.get("next") ?? undefined} />;
      const page = !c ? <OrganiserPage /> : c === "order" ? <CuratePage /> : c === "tape" ? <TapePage /> : null;
      return page ? (
        <LiveTapeProvider key={b} tapeId={b}>
          {page}
        </LiveTapeProvider>
      ) : (
        <NotFoundPage />
      );
    }
  }
  if (parts.length === 1 && /^[a-z0-9-]{2,40}$/i.test(a)) return <PublicTapePage key={a} slug={a} />;
  if (parts.length === 3 && b === "edit") return <EditTrackPage key={c} id={c} token={hash} />;
  return <NotFoundPage />;
}

export function App() {
  const route = useRoute();
  useLinkInterception();
  return (
    <InkProvider>
      <DemoStoreProvider>
        <a
          className="sr-only skip"
          href="#main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("main")?.focus();
          }}
        >
          Skip to content
        </a>
        <SiteHeader path={route.path} />
        <main id="main" tabIndex={-1}>
          <Page parts={route.parts} hash={route.hash} query={route.query} />
        </main>
        <SiteFooter />
      </DemoStoreProvider>
    </InkProvider>
  );
}
