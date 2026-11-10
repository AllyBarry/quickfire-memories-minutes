# Deploying Years in Rotation

The site runs on **Cloudflare Pages**, on `minutes.qfm.co.za`, next to Quickfire Memories on `seconds.qfm.co.za` in the same Cloudflare account:

- **Everything a visitor sees** is the built web app ([apps/web](../apps/web)), served as static files.
- **`/api/*` and `/go/*`** are Pages Functions ([apps/api/functions](../apps/api/functions)), running the API in [apps/api/src](../apps/api/src).
- **Rules both share** (plans, inks, limits, deadlines) are in [packages/shared](../packages/shared).

Because both are on one domain, sign-in cookies are first-party and there's no CORS to manage.

GitHub Actions does the work:

| Workflow | When | What runs |
| --- | --- | --- |
| [deploy.yml](../.github/workflows/deploy.yml) | Pull request touching `apps/`, `packages/` or the root package files | Typecheck, unit tests, web build, and 70 end-to-end checks against a local Pages server |
| [deploy.yml](../.github/workflows/deploy.yml) | Push to `main`, or **Run workflow** | The same checks, then config check, D1 migrations, secret sync, deploy and a smoke test |
| [daily.yml](../.github/workflows/daily.yml) | Every day at 08:00 SAST, or **Run workflow** | Calls `/api/cron`: auto-close, "two days left" reminders, 5-year clean-up |

The daily job runs from GitHub because Cloudflare Pages has no cron triggers.

---

## One-time setup

Steps 1 to 5 are in Cloudflare and Resend, step 6 is in GitHub. Run `npm install` at the root once, then run wrangler commands from `apps/api/` after `npx wrangler login`.

### 1. Domain

`qfm.co.za` is already on Cloudflare for Quickfire Memories, so there's nothing to do here. The site lives on its own subdomain,
so it doesn't touch Quickfire's Worker on `seconds.qfm.co.za`.
To move it to a different domain, change `APP_URL`, `BETTER_AUTH_URL` and `EMAIL_FROM` in `env.production.vars` in
[apps/api/wrangler.jsonc](../apps/api/wrangler.jsonc), and set the GitHub variable `SITE_URL` (step 6).

### 2. Database and photo storage

```bash
npx wrangler d1 create yir                  # copy the database_id it prints
npx wrangler r2 bucket create yir-photos
```

Put the `database_id` in `apps/api/wrangler.jsonc` in **both** places (top level and `env.production`) and commit it. It isn't a secret.
The deploy refuses to run while the placeholder id or any `REPLACE` value is left (`node scripts/check-prod-config.mjs` checks this).

New tape requests are emailed to `STAFF_EMAIL` (`hello@qfm.co.za`, the same inbox Quickfire uses). Change it in `env.production.vars` if you want them elsewhere.

### 3. The Pages project and custom domain

Nothing to do by hand. Quickfire is a Worker, so `wrangler deploy` attaches `seconds.qfm.co.za` from the `routes` in its config.
Pages has no equivalent in `wrangler.jsonc`, so every deploy runs [apps/api/scripts/ensure-pages.mjs](../apps/api/scripts/ensure-pages.mjs) first. It creates whatever is missing:

1. the Pages project `years-in-rotation` (production branch `main`)
2. the custom domain from `SITE_URL` (`minutes.qfm.co.za`) on that project
3. a proxied CNAME from `minutes.qfm.co.za` to the project's `pages.dev` address, in the `qfm.co.za` zone

Once they exist it changes nothing. If `minutes.qfm.co.za` already has a DNS record pointing elsewhere, the deploy stops rather than overwrite it.
On the first deploy Cloudflare takes a few minutes to issue the domain's certificate. The smoke test waits up to 5 minutes for it.

### 4. Staff access (admin)

Use the same Cloudflare **Zero Trust** team as Quickfire, with its one-time PIN login (staff sign in with their own email address).

1. **Access, then Applications, then Add, then Self-hosted:** name it "Years in Rotation admin". Add the paths `minutes.qfm.co.za/admin` and `minutes.qfm.co.za/api/admin`.
2. **Policy:** action **Allow**, include **Emails**, and list each staff member's address. Set the session duration to 24 hours or less.
3. Copy the **team domain** (`<team>.cloudflareaccess.com`, the same one Quickfire uses) and this application's **AUD tag** into `env.production.vars` as `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`, then commit.
   The AUD tag is different from Quickfire's, so a Quickfire admin token doesn't open this admin.

The API checks the Access token itself as well, so the admin API stays closed even if the Access rule is changed by mistake.
The `*.pages.dev` address isn't covered by that Access application, but the admin API still refuses requests without a valid Access token.
To close it fully, add the `years-in-rotation.pages.dev` paths to the same Access application.

### 5. Email (Resend)

Use the Resend account where `qfm.co.za` is verified for Quickfire. Nothing new to verify, since any `@qfm.co.za` address can send.
Create a separate API key for this site, so either one can be revoked alone.
Production sends from `Years in Rotation <hello@qfm.co.za>`. Change `EMAIL_FROM` for a different address.

### 6. GitHub secrets and variables

**Cloudflare API token:** in Cloudflare go to My Profile, then API Tokens, then Create Token, then **Custom token**, with:

- **Account, Cloudflare Pages, Edit**
- **Account, D1, Edit**
- **Zone, Zone, Read** and **Zone, DNS, Edit** (for the custom domain's DNS record)
- limit **Account Resources** to your account and **Zone Resources** to `qfm.co.za`

In the GitHub repo, under **Settings, then Secrets and variables, then Actions**:

| Secret | Required | Value |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | yes | The token above |
| `CLOUDFLARE_ACCOUNT_ID` | yes | Dashboard, Workers & Pages, right sidebar |
| `BETTER_AUTH_SECRET` | yes | `openssl rand -base64 32`. Changing it signs every organiser out. |
| `CRON_SECRET` | yes | `openssl rand -hex 24`. The daily job sends it to `/api/cron`. |
| `RESEND_API_KEY` | yes, before launch | From Resend. Without it, sign-in emails fail. |
| `PAYSTACK_SECRET_KEY` | later | Only when online checkout opens |

| Variable | Required | Value |
| --- | --- | --- |
| `SITE_URL` | only to move the site | The live address. Defaults to `https://minutes.qfm.co.za`. The deploy attaches this domain. |

Every deploy pushes these secrets to the Pages project before the new code goes live.

**Optional:** under **Settings, then Environments, then production**, add yourself as a required reviewer so each deploy waits for your approval.

---

## First deploy

1. Commit the filled-in `apps/api/wrangler.jsonc` and push to `main`, or open **Actions, then Deploy (Cloudflare Pages), then Run workflow**.
2. The deploy job:
   1. checks secrets and config
   2. applies any new D1 migrations from `apps/api/migrations` (`0001_auth.sql` to `0003_plan_pricing.sql` so far)
   3. creates the Pages project, custom domain and DNS record the first time
   4. syncs secrets
   5. deploys the web app and Functions
   6. checks `$SITE_URL/api/health` and the home page
3. **Test it end to end:**
   - Open `/admin` (through Access), then **Add organiser**, using your own email and a party date six weeks out.
   - Click the emailed link. Your dashboard opens.
   - Open the share link in a private window, pick a song, then approve it in **Set the running order**.
   - Open the share link again: it's now the tape. Scan a QR code from the preview to check `/go/<id>`.
4. Open **Actions, then Daily jobs, then Run workflow** once and check it reports `{"autoClose":0,...}`.

---

## Everyday deploys

Merge to `main`. That's it.

- **Migrations** run before the new code goes live, so every migration must work with the code that's already running:
  - add tables or columns, with defaults where needed
  - don't rename or drop in the same release. Do that in a later release, once nothing uses the old column.
  - name new files `0003_...sql`, `0004_...sql` and so on. They never change after they've been applied.
- **Rolling back the code:** in the dashboard, open the Pages project, then **Deployments**, pick the last good one, then **Rollback**.
  D1 migrations don't roll back. Fix forward with a new migration, or restore the database to a point in time:
  `npx wrangler d1 time-travel restore yir --timestamp <ISO time>`.
- **Live logs:** `npx wrangler pages deployment tail --project-name years-in-rotation`.
- **Preview deployments:** the workflow only deploys `main`. Pull requests are tested but never deployed, so nothing half-finished is reachable.

## Turning on online checkout

Until then, `/start` sends a "reserve a tape" request, staff agree payment (EFT or a card link), and set the tape up in the admin under **Requests**.

1. Add the `PAYSTACK_SECRET_KEY` GitHub secret.
2. Set `CHECKOUT_ENABLED` to `"true"` in `env.production.vars` and commit.
3. In the Paystack dashboard, set the webhook URL to `https://minutes.qfm.co.za/api/webhooks/paystack`.
4. Merge to `main`. `/start` switches to "Pay with Paystack" by itself.

## Running it locally

From the repo root:

```bash
nvm use && npm install
npm run build                                       # the local Pages server serves apps/web/dist
cp apps/api/.dev.vars.example apps/api/.dev.vars    # fill in BETTER_AUTH_SECRET and CRON_SECRET
npm run db:migrate:local -w @yir/api
npm run dev:api                                     # Pages + Functions on http://localhost:8788
npm run dev:web                                     # second terminal: http://localhost:5173, /api and /go proxied to 8788
```

- **Emails aren't sent locally.** Read them at `http://localhost:5173/api/dev/emails`. That's where the sign-in links are.
- **The admin works without Access locally** and acts as `ADMIN_DEV_EMAIL`.
- **Run the daily jobs by hand** with `POST /api/dev/cron`.

## Costs

Expected to stay within Cloudflare's free tiers at launch: Pages (unlimited static requests, 100,000 Function requests a day), D1, R2 (10 GB) and Access (50 users).
Resend's free tier covers 3,000 emails a month. GitHub Actions minutes for the daily job are negligible.
