import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getAuth } from "../auth";
import type { AppEnv, Env } from "../env";
import { safeEqual } from "./ids";

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** True only for local development requests, so a misconfigured deploy can't open the dev shortcuts. */
export function isLocalDev(env: Env, url: string) {
  if (env.ENVIRONMENT !== "development") return false;
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Staff only. Production: Cloudflare Access sits in front of /admin and /api/admin/*, and adds a signed
 * Cf-Access-Jwt-Assertion header. We verify it against the team's public keys and the application AUD,
 * so a request that somehow bypasses Access is still refused. Local development: ADMIN_DEV_EMAIL stands in.
 */
export const requireStaff = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.env;
  if (isLocalDev(env, c.req.url) && env.ADMIN_DEV_EMAIL) {
    c.set("staffEmail", env.ADMIN_DEV_EMAIL.toLowerCase());
    return next();
  }
  const token = c.req.header("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) throw new HTTPException(403, { message: "Staff access only." });
  const team = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let keys = jwks.get(team);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${team}/cdn-cgi/access/certs`));
    jwks.set(team, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: team, audience: env.ACCESS_AUD });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) throw new Error("no email claim");
    c.set("staffEmail", email);
  } catch {
    throw new HTTPException(403, { message: "Staff access only." });
  }
  return next();
});

/** Signed-in organiser (magic link). Sets organiserEmail. Tape membership is checked per route. */
export const requireOrganiser = createMiddleware<AppEnv>(async (c, next) => {
  const session = await getAuth(c.env).api.getSession({ headers: c.req.raw.headers });
  if (!session) throw new HTTPException(401, { message: "Sign in to continue." });
  c.set("organiserEmail", session.user.email.toLowerCase());
  return next();
});

/** The daily job: GitHub Actions sends `Authorization: Bearer <CRON_SECRET>`. */
export const requireCron = createMiddleware<AppEnv>(async (c, next) => {
  const secret = c.env.CRON_SECRET ?? "";
  const given = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret.length < 16 || !safeEqual(given, secret)) throw new HTTPException(401, { message: "Not allowed." });
  return next();
});
