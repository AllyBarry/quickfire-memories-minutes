/** Pages Functions bindings, vars (wrangler.jsonc) and secrets (`wrangler pages secret` / .dev.vars). */
export interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;

  ENVIRONMENT: "development" | "production";
  /** The site's origin. Sign-in links, share links and QR links use it. */
  APP_URL: string;
  /** Where Better Auth is served. Same origin as APP_URL. */
  BETTER_AUTH_URL: string;
  EMAIL_MODE: "log" | "resend";
  EMAIL_FROM: string;
  /** Inbox that hears about new "reserve a tape" requests. */
  STAFF_EMAIL: string;
  CHECKOUT_ENABLED: string;
  /** Cloudflare Access team domain and application AUD tag for the admin API. */
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;

  // secrets
  BETTER_AUTH_SECRET: string;
  /** Sent by the daily GitHub Actions job as a bearer token to /api/cron. */
  CRON_SECRET?: string;
  RESEND_API_KEY?: string;
  PAYSTACK_SECRET_KEY?: string;
  /** Development only: treat admin requests as this staff email (no Cloudflare Access locally). */
  ADMIN_DEV_EMAIL?: string;
}

export interface Vars {
  staffEmail?: string;
  organiserEmail?: string;
}

export type AppEnv = { Bindings: Env; Variables: Vars };
