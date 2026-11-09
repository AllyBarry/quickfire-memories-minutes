# Years in Rotation

A mixtape for a birthday, wedding or farewell. Each friend picks one song, says when they met the guest of honour,
and writes the liner note behind it. The tape runs in the order they met.

The organiser gets two things:

- **The tape.** The share link turns into the tape once the organiser approves it. Every track shows its liner note, and every song opens in the guest's own music app.
- **The box** (Boxed and Double album plans). One printed card per friend with a QR code to their song, a J-card tracklist insert, and a keepsake tape box.

It's a product spin-off of the private 30th birthday playlist in `../zabs-30-birthday-playlist`, rebuilt without any of Spotify's branding.
See "Staying clear of Spotify" in [web/README.md](web/README.md).

## What's here

| Folder | What it is |
| --- | --- |
| [web/](web/) | The web app: sales page, checkout, the friend's song pick, the organiser's dashboard and running order, the tape, staff admin, and a clickable demo on sample data at `/demo/*` |
| [api/](api/) | The API as Cloudflare Pages Functions: Hono, Better Auth magic links, D1, R2 photos, Resend, Paystack, song.link |
| [.github/workflows/](.github/workflows/) | `deploy.yml` tests and deploys to Cloudflare Pages. `daily.yml` runs the daily jobs. |
| [docs/](docs/) | [DEPLOY.md](docs/DEPLOY.md): one-time setup and day-to-day. [ARCHITECTURE.md](docs/ARCHITECTURE.md): pages, API, who can do what. [ROADMAP.md](docs/ROADMAP.md): what's next. |

## Running it locally

```bash
cd web && npm install && npm run build && cd ../api
npm install
cp .dev.vars.example .dev.vars          # fill in BETTER_AUTH_SECRET and CRON_SECRET
npm run db:migrate:local
npm run dev                             # Pages + Functions on http://localhost:8788
cd ../web && npm run dev                # http://localhost:5173
```

Emails aren't sent locally. Sign-in links appear at `/api/dev/emails`. Details are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Deploying

Push to `main`. GitHub Actions runs the unit and end-to-end tests, applies D1 migrations, syncs secrets and deploys to Cloudflare Pages.
The one-time setup (domain, D1, R2, Access, Resend, GitHub secrets) is in [docs/DEPLOY.md](docs/DEPLOY.md).

Use Node 24 (`nvm use 24`).
