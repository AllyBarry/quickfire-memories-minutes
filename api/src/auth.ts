import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import type { Env } from "./env";
import { sendEmail, signInEmail } from "./lib/email";

function createAuth(env: Env) {
  return betterAuth({
    appName: "Years in Rotation",
    // D1 binding straight into Better Auth's built-in Kysely adapter (documented for Cloudflare D1)
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    // magic-link callback URLs must point at the web app
    trustedOrigins: [env.APP_URL],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh at most daily
    },
    advanced: {
      useSecureCookies: env.ENVIRONMENT === "production",
      // Cloudflare puts the visitor's real IP here. Rate limiting is per IP.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: { enabled: true, window: 60, max: 30 },
    plugins: [
      magicLink({
        expiresIn: 15 * 60,
        sendMagicLink: async ({ email, url }) => {
          // Only organisers get links. Anyone else gets the same "check your email" response and no email,
          // so the endpoint can't be used to spam strangers or to find out who is an organiser.
          const org = await env.DB.prepare(
            `SELECT o.name, t.honoree FROM organiser o
             LEFT JOIN tape_member m ON m.email = o.email
             LEFT JOIN tape t ON t.id = m.tape_id
             WHERE o.email = ? ORDER BY t.created_at DESC LIMIT 1`,
          )
            .bind(email.toLowerCase())
            .first<{ name: string; honoree: string | null }>();
          if (!org) {
            console.log(`[auth] magic link requested for non-organiser ${email}: not sent`);
            return;
          }
          await sendEmail(env, { to: email, ...signInEmail(url, { name: org.name, honoree: org.honoree ?? undefined }) });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Bindings are fixed for the life of an isolate, so build the auth instance once per env object.
const cache = new WeakMap<Env, Auth>();
export function getAuth(env: Env): Auth {
  let auth = cache.get(env);
  if (!auth) {
    auth = createAuth(env);
    cache.set(env, auth);
  }
  return auth;
}

/** Send a sign-in link that lands on `callbackPath` in the web app (e.g. "/organiser/abc123"). */
export async function sendSignInLink(env: Env, email: string, name: string, callbackPath: string) {
  await getAuth(env).api.signInMagicLink({
    body: { email, name, callbackURL: `${env.APP_URL}${callbackPath}` },
    headers: new Headers(),
  });
}
