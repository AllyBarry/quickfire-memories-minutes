# Years in Rotation: architecture

One Cloudflare Pages project serves everything on one domain. Deployment: [DEPLOY.md](DEPLOY.md).

```
                         minutes.qfm.co.za (Cloudflare Pages)
   ┌──────────────────────────────────────────────────────────┐
   │  /, /start, /<slug>, /organiser, /admin ...              │
   │      static web app (React, apps/web)                    │
   │  /api/*   Pages Function: the API (Hono)                 │──► D1 "yir": organisers, tapes, tracks,
   │  /go/*    Pages Function: QR redirects                   │          payments, requests, audit, auth
   │  /admin and /api/admin/* behind Cloudflare Access        │──► R2 "yir-photos": friends' photos (private)
   └──────────────────────────────────────────────────────────┘──► Resend: sign-in links and reminders
                                                                ──► Paystack: hosted checkout + signed webhook
                                                                ──► song.link (Odesli): one link for every music app
   GitHub Actions, daily 08:00 SAST ──► POST /api/cron (bearer token)
```

## Pages

| Path | Who | What |
| --- | --- | --- |
| `/` | Buyers | Sales page with the playable sample tape |
| `/start` | Buyers | Order details, then "Coming soon": the last step is a waitlist sign-up that goes to the site administrator. Online payment (Paystack) is built but not offered yet. |
| `/checkout/complete` | Buyers | Where Paystack sends them back |
| `/<slug>` | Friends, then guests | The share link. The song-pick form while open, a closed notice, then the finished tape once approved |
| `/<slug>/edit/<id>#<token>` | One friend | Their private link to change or delete their song. The token stays in the `#` part, so it never reaches server logs. |
| `/go/<id>` | Guests | The QR code on each printed card. Redirects to the song, so a dead link can be fixed after printing. |
| `/organiser` | Organisers | Magic-link sign-in and the list of their tapes |
| `/organiser/<id>` | Organisers | Dashboard: picks, deadline, share link, reminders, timeline, inks |
| `/organiser/<id>/order` | Organisers | Running order: edit, reorder, hide, approve |
| `/organiser/<id>/tape` | Organisers | Preview of the tape and the printed pieces |
| `/admin` | Staff | Tapes, requests, add organiser, organisers, pricing and sales |
| `/demo/*` | Developers | The clickable demo on sample data in the browser. Local development and the one-file demo build only, never deployed. |

The organiser pages are the same components in the demo and for real. They read one context (`useTape`), which
`DemoStoreProvider` fills from localStorage and `LiveTapeProvider` fills from the API.
Text edits in the running order are saved after a short pause, and status changes and reordering are saved straight away.

## Who can do what

| Who | How they get in | What they can reach |
| --- | --- | --- |
| Organiser | Better Auth magic link (no password). Only emails in the `organiser` table get a link. | Tapes where `tape_member.email` is their verified email |
| Friend | No account. The share link, plus a private edit token returned once when they submit. | Add a song while the tape is open. Edit their own song while open, delete it at any time. |
| Party guest | No account. The share link or a QR link. | Only approved tapes, never hidden tracks, never the raw links friends pasted |
| Staff | Cloudflare Access in front of `/admin` and `/api/admin/*`. The API also verifies the Access JWT. | Everything. Every write goes to `audit_log` with their email. |
| Daily job | `Authorization: Bearer <CRON_SECRET>` on `POST /api/cron` | The three daily jobs only |

Rules the API enforces on the server:

- **Membership:** every organiser route looks the tape up joined to `tape_member` on the session's email. A missing tape and someone else's tape both return 404, so ids can't be probed.
- **Edit tokens:** only their SHA-256 hash is stored, and they're compared in constant time.
- **Photos:** checked by their first bytes (JPEG or PNG only, 600 KB max), stored privately, and served only to the tape's organisers, to staff, or to guests once the tape is live.
- **Deadlines:** close times are checked against the print run (`latestClose`), in South African time.
- **Payment:** a tape becomes paid only through Paystack's signed webhook, with the amount checked. Staff-created tapes get a `manual` payment row (`paid` or `comped`).
- **Local shortcuts** (the dev email outbox, the admin without Access) only work when `ENVIRONMENT` is `development` and the request is to `localhost`.

## API

| Method and path | Who | What |
| --- | --- | --- |
| `GET /api/health` | anyone | Health check |
| `GET, POST /api/auth/*` | anyone | Better Auth: `POST /sign-in/magic-link`, `GET /magic-link/verify`, `GET /get-session`, `POST /sign-out` |
| `GET /api/public/tapes/:slug` | friend, guest | Form header while open, the visible tracks once live |
| `POST /api/public/tapes/:slug/tracks` | friend | multipart: `track` (JSON) + optional `photo`. Returns `{id, editToken, editUrl}`. |
| `GET, PATCH, DELETE /api/public/tracks/:id` | friend (`X-Edit-Token`) | Own song |
| `PUT, DELETE /api/public/tracks/:id/photo` | friend (`X-Edit-Token`) | Replace or remove their photo |
| `GET /api/public/tracks/:id/photo` | guest | Photo, once the tape is live |
| `POST /api/public/enquiries` | anyone | Waitlist sign-up from the last step of `/start` while online ordering is coming soon. Saved for the admin (Requests) and emailed to the site administrator (`STAFF_EMAIL`). |
| `GET /api/public/pricing` | anyone | Advertised prices per plan: `priceZar`, plus `salePriceZar`, `saleLabel` and `saleEndsAt` while a sale is set. Cached for 60 seconds. |
| `GET /go/:id` | guest | QR redirect: song.link page, the friend's link, or a search |
| `GET /api/me` | organiser | Their tapes |
| `GET, PATCH /api/tapes/:id` | organiser | Tape. PATCH `closeAt` (ISO, `null` = suggested, `"now"`), `inkId`, `invited` |
| `GET /api/tapes/:id/tracks` | organiser | Tracks in running order |
| `PATCH /api/tapes/:id/tracks/:tid` | organiser | Edit, approve or hide. Editing sends an approved track back to `new`. |
| `POST /api/tapes/:id/tracks/order` | organiser | Set the running order |
| `GET /api/tapes/:id/tracks/:tid/photo` | organiser | Photo while curating |
| `POST /api/tapes/:id/approve`, `/reopen` | organiser | Approve once every visible track is approved, or reopen before printing |
| `POST /api/tapes/:id/members` | owner | Add a co-organiser and email them a link |
| `GET /api/admin/tapes?status=&q=`, `GET, PATCH /api/admin/tapes/:id` | staff | Tapes, detail with members, payments, tracks and audit. PATCH `status`, `closeAt`. |
| `GET, POST /api/admin/organisers`, `POST .../:email/send-link` | staff | List, add an organiser with their first tape, resend a link |
| `GET /api/admin/enquiries`, `POST .../:id/handled` | staff | Tape requests |
| `DELETE /api/admin/tracks/:id` | staff | Privacy removal (`reason` required). Removes the song and photo. |
| `GET /api/admin/audit?tapeId=` | staff | Audit log |
| `GET /api/admin/pricing`, `PUT /api/admin/pricing/:planId` | staff | Standard price and sale per plan. PUT `priceZar`, `salePriceZar` (lower than the standard price, `null` ends the sale), `saleLabel`, `saleEndsAt` (a future ISO time, or `null`). Checkout and new paid orders use the price showing at the time. Audited. |
| `GET, POST /api/checkout` | anyone | Whether checkout is on, and start a Paystack payment. Not used by `/start` while ordering is coming soon. |
| `POST /api/webhooks/paystack` | Paystack | Signed (HMAC-SHA512) and idempotent |
| `POST /api/cron` | daily job | Auto-close, reminders, retention |

Errors are always JSON: `{error, message, field?}`, with status 400 (invalid), 401, 403, 404, 409 (closed or wrong state) or 503.

## Daily jobs (08:00 SAST, from GitHub Actions)

- **Auto-close:** tapes past their close time move to `curating`, and the organiser gets an email with the running-order link.
- **Reminders:** one "two days left" email per tape, with the share link.
- **Retention:** tapes whose party was more than 5 years ago are deleted, photos included, and each deletion is audited.

Each job is safe to run twice.

## What's built and verified

- `packages/shared`: 11 unit tests cover the deadlines in South African time (including browsers in other time zones), the print run and the timeline.
- `apps/api`: typechecks. 13 unit tests cover open and closed tapes, ids, tokens and slugs, validation, QR destinations and Paystack signatures.
  70 end-to-end checks run against `wrangler pages dev` with local D1 and R2 and real Better Auth ([apps/api/test/e2e_local.py](../apps/api/test/e2e_local.py)).
- `apps/web`: typechecks and builds. The whole flow was clicked through in a browser against the local stack:
  a friend picks a song, the organiser signs in from the emailed link and approves it, the share link turns into the tape, and the admin shows it.
- Not yet run against real Cloudflare, Resend or Paystack accounts. That needs the one-time setup in [DEPLOY.md](DEPLOY.md).
