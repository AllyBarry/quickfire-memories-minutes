import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { getAuth } from "./auth";
import { runDaily } from "./cron";
import type { AppEnv } from "./env";
import { isLocalDev, requireCron } from "./lib/access";
import { devOutbox } from "./lib/email";
import { Invalid } from "./lib/validate";
import { adminRoutes } from "./routes/admin";
import { organiserRoutes } from "./routes/organiser";
import { paymentRoutes } from "./routes/payments";
import { goRoutes, publicRoutes } from "./routes/public";

/** The whole API. Cloudflare Pages runs it as Functions for /api/* and /go/* (see ../functions). */
const app = new Hono<AppEnv>();

app.use("*", secureHeaders());
// API responses are per user and change often; never let a cache keep them
app.use("/api/*", async (c, next) => {
  await next();
  if (!c.res.headers.has("cache-control")) c.res.headers.set("cache-control", "no-store");
});

app.get("/api/health", (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));

// Better Auth: magic-link sign-in, sessions, sign-out (registered before other /api routes)
app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth(c.env).handler(c.req.raw));

app.route("/api/public", publicRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api", paymentRoutes); // /api/checkout, /api/webhooks/paystack
app.route("/api", organiserRoutes); // /api/me, /api/tapes/*  (session required)
app.route("/", goRoutes); // /go/:id, the QR links

// The daily job (GitHub Actions schedule, bearer token)
app.post("/api/cron", requireCron, async (c) => c.json(await runDaily(c.env)));

// Local development only: read the emails that would have been sent, and run the daily job by hand
app.get("/api/dev/emails", (c) => (isLocalDev(c.env, c.req.url) ? c.json(devOutbox) : c.notFound()));
app.post("/api/dev/cron", async (c) => (isLocalDev(c.env, c.req.url) ? c.json(await runDaily(c.env)) : c.notFound()));

app.notFound((c) => c.json({ error: "not_found", message: "Not found." }, 404));

app.onError((err, c) => {
  if (err instanceof Invalid) return c.json({ error: "invalid", field: err.field, message: err.message }, 400);
  if (err instanceof HTTPException) {
    const code = err.status === 401 ? "unauthorised" : err.status === 403 ? "forbidden" : err.status === 404 ? "not_found" : err.status === 409 ? "conflict" : "error";
    return c.json({ error: code, message: err.message }, err.status);
  }
  if (err instanceof SyntaxError) return c.json({ error: "invalid", message: "Request body must be valid JSON." }, 400);
  console.error(err);
  return c.json({ error: "server_error", message: "Something went wrong on our side." }, 500);
});

export default app;
