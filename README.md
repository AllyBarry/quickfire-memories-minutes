# Years in Rotation

A mixtape for a birthday, wedding or farewell. Each friend picks one song, says when they met the guest of honour,
and writes the liner note behind it. The tape runs in the order they met.

The organiser gets two things:

- **The tape.** The share link turns into the tape once the organiser approves it. Every track shows its liner note, and every song opens in the guest's own music app.
- **The box** (Boxed and Double album plans). One printed card per friend with a QR code to their song, a J-card tracklist insert, and a keepsake tape box.

It's a product spin-off of the private 30th birthday playlist in `../zabs-30-birthday-playlist`, rebuilt without any of Spotify's branding.
See "Staying clear of Spotify" in [apps/web/README.md](apps/web/README.md). It runs on `minutes.qfm.co.za`, next to Quickfire Memories.

## What's here

An npm workspaces monorepo, laid out like `../thirty-years-in-thirty-seconds`:

| Folder | Package | What it is |
| --- | --- | --- |
| [apps/web/](apps/web/) | `@yir/web` | The web app: sales page, checkout, the friend's song pick, the organiser's dashboard and running order, the tape, staff admin, and a clickable demo on sample data at `/demo/*` (local and the one-file demo build only, not deployed) |
| [apps/api/](apps/api/) | `@yir/api` | The API as Cloudflare Pages Functions: Hono, Better Auth magic links, D1, R2 photos, Resend, Paystack, song.link |
| [packages/shared/](packages/shared/) | `@yir/shared` | The rules both must agree on: plans and prices, inks, field limits, and deadlines in South African time |
| [.github/workflows/](.github/workflows/) | | `deploy.yml` tests and deploys to Cloudflare Pages. `daily.yml` runs the daily jobs. |
| [docs/](docs/) | | [DEPLOY.md](docs/DEPLOY.md): one-time setup and day-to-day. [ARCHITECTURE.md](docs/ARCHITECTURE.md): pages, API, who can do what. [ROADMAP.md](docs/ROADMAP.md): what's next. |

There is one `package-lock.json`, at the root. Install from the root, never inside a package.

## Running it locally

```bash
nvm use                                 # Node 24, from .nvmrc
npm install
npm run build                           # the API's local Pages server serves apps/web/dist
cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in BETTER_AUTH_SECRET and CRON_SECRET
npm run db:migrate:local -w @yir/api
npm run dev:api                         # Pages + Functions on http://localhost:8788
npm run dev:web                         # in a second terminal: http://localhost:5173, with hot reload
```

Emails aren't sent locally. Sign-in links appear at `/api/dev/emails`. Details are in [docs/DEPLOY.md](docs/DEPLOY.md).

| From the root | What it does |
| --- | --- |
| `npm run typecheck` | Typechecks every package |
| `npm test` | Unit tests in every package |
| `npm run e2e` | The end-to-end checks, against a running `dev:api` started as in [apps/api/README.md](apps/api/README.md) |
| `npm run build` / `npm run build:demo` | The web app for Pages, or the demo as one HTML file |
| `npm run deploy:check` | Builds, checks the production config and bundles the Functions as a deploy would |

## Deploying

Push to `main`. GitHub Actions runs the unit and end-to-end tests, applies D1 migrations, makes sure the Pages project and
its domain exist, syncs secrets and deploys. The one-time setup (D1, R2, Access, Resend, GitHub secrets) is in [docs/DEPLOY.md](docs/DEPLOY.md).
