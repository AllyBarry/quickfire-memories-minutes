# Years in Rotation API

The API behind the site, running as Cloudflare Pages Functions next to the web app.
It handles organiser sign-in (Better Auth magic links), tapes and tracks (D1), friends' photos (R2), the QR redirects,
the staff admin API (Cloudflare Access), "reserve a tape" requests, Paystack (off until switched on) and the daily jobs.
The full design is in [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Run it locally

At the repo root, run `nvm use && npm install && npm run build` (Pages serves the built app from `../web/dist`). Then from this folder:

```bash
cp .dev.vars.example .dev.vars                # fill in BETTER_AUTH_SECRET and CRON_SECRET
npm run db:migrate:local                      # local D1
npm run dev                                   # http://localhost:8788
```

For the web app with hot reload, also run `npm run dev:web` at the root and open http://localhost:5173. It proxies `/api` and `/go` here.

Plans, inks, field limits and the deadline rules come from `@yir/shared` ([../../packages/shared](../../packages/shared)), the same code the web app uses.

In development:
- **Emails aren't sent.** Read them at `GET /api/dev/emails`. That's where the sign-in links are.
- **Admin routes act as `ADMIN_DEV_EMAIL`**, since there's no Cloudflare Access locally.
- **Run the daily jobs** with `POST /api/dev/cron`.

## Tests

```bash
npm run typecheck
npm test                      # 13 unit tests: open/closed, ids and tokens, validation, QR destinations, Paystack signatures
npm run e2e                   # 70 end-to-end checks against a running `wrangler pages dev`
```

The end-to-end script needs the server started with its URLs pointing at itself:

```bash
npx wrangler pages dev ../web/dist --port 8788 --binding APP_URL=http://localhost:8788 --binding BETTER_AUTH_URL=http://localhost:8788
```

It walks a whole order:
1. Checkout is off, so a buyer sends a request. Staff see it and set the tape up.
2. The organiser signs in through the magic link, and access between organisers is checked.
3. Friends add songs (one with a photo), which line up by when they met. Bad dates and fake photos are refused.
4. A friend edits their song and photo with their private token.
5. The organiser changes inks, closes picks, curates, reorders and approves.
6. The share link becomes the tape. Photos go public, QR links redirect, hidden tracks stay off.
7. Privacy: a friend deletes their own song, and staff remove one with a reason. It's all in the audit log.
8. Staff move the box to printing, after which the organiser can't reopen it.
9. The daily job needs its token. The Paystack webhook is off without a key.

## Deploy

GitHub Actions deploys on every push to `main`, after the unit and end-to-end tests pass. See [../docs/DEPLOY.md](../docs/DEPLOY.md).

```bash
npm run check:prod            # refuses placeholder production values
npm run functions:build       # bundles the Functions as a deploy would
```

[scripts/ensure-pages.mjs](scripts/ensure-pages.mjs) runs in the deploy before `wrangler pages deploy`. It creates the Pages project,
attaches the custom domain and adds its DNS record when they're missing, since Pages can't declare those in `wrangler.jsonc`.

## Layout

| Path | What |
| --- | --- |
| `functions/api/[[route]].ts`, `functions/go/[[route]].ts` | Pages Functions entry points. Both hand the request to the Hono app. |
| `src/app.ts` | Routes, error handling, the cron endpoint and the local dev helpers |
| `src/auth.ts` | Better Auth (D1, magic link, organiser-only emails) |
| `src/routes/public.ts` | Song pick, own-song edits, the live tape, photos, requests, QR redirects |
| `src/routes/organiser.ts` | Dashboard, deadline, inks, running order, approval, co-organisers |
| `src/routes/admin.ts` | Staff: tapes, organisers (add and send link), requests, privacy removal, audit, prices and sales |
| `src/routes/payments.ts` | Checkout (off by default) and the Paystack webhook |
| `src/cron.ts` | Auto-close, reminders, retention |
| `src/lib/` | Validation, ids and tokens, email, audit, access checks, Paystack, song.link, D1 and R2 helpers |
| `migrations/` | D1 schema: Better Auth tables, then the app tables |
| `scripts/` | Production config check, and the Pages project and domain setup the deploy runs |
| `wrangler.jsonc` | Pages config. Top level is local development, `env.production` is the live site. |
