# Years in Rotation: web app

The React app for the whole site. Cloudflare Pages serves it, with the API ([../api](../api)) as Pages Functions on the same domain.

Install from the repo root (`nvm use && npm install`). Then, here or with `-w @yir/web` from the root:

```bash
npm run dev            # http://localhost:5173, /api and /go proxied to the API's `npm run dev` (port 8788)
npm run typecheck
npm run build          # dist/, what Pages deploys
npm run build:single   # dist-single/index.html, one self-contained file (the demo pages work in it, the live ones need the API)
```

"Years in Rotation" is a working name. Check it on the CIPC trademark register before launch.

## Pages

| Path | Who | Page |
| --- | --- | --- |
| `/` | Buyers | Sales page: hero, how it works, playable sample tape, printed pieces, ink picker and pricing, FAQ |
| `/start` | Buyers | Checkout: who it's for (with birth year), plan and inks, details, then Paystack, or a "reserve a tape" request while checkout is off |
| `/<slug>` | Friends, then guests | The share link: the song-pick form while open, then the finished tape once approved |
| `/<slug>/edit/<id>#<token>` | One friend | Change or delete their own song |
| `/organiser` | Organisers | Magic-link sign-in, then their tapes |
| `/organiser/<id>`, `/order`, `/tape` | Organisers | Dashboard, running order, and a preview of the tape and printed pieces |
| `/admin` | Staff | Tapes (with the print queue), requests, add organiser, organisers. Behind Cloudflare Access. |
| `/demo/start`, `/pick`, `/organiser`, `/order`, `/tape` | Anyone | The same flow on sample data kept in this browser. "Reset demo" on the dashboard starts over. |

Routing is by path ([src/lib/router.ts](src/lib/router.ts)), so share links and QR links are plain URLs and Access can protect `/admin`.
Links to `/api/*` and `/go/*` always go to the server.

The organiser pages (`OrganiserPage`, `CuratePage`, `TapePage`) are the same for the demo and for real tapes. They read `useTape()`:
- `DemoStoreProvider` ([src/lib/demoStore.tsx](src/lib/demoStore.tsx)) fills it from localStorage for `/demo/*`.
- `LiveTapeProvider` ([src/lib/liveTape.tsx](src/lib/liveTape.tsx)) fills it from the API and saves each change. Typing in the running order is saved after a short pause, approvals and reordering straight away. If a save fails, the page shows why and reloads from the server.

Deadlines are worked back from the party date in `@yir/shared` ([timeline.ts](../../packages/shared/src/timeline.ts)), with a weekly Tuesday print run for boxed tapes.
The API runs the same code. Times are always shown and entered in South African time, whatever the visitor's time zone, so the page matches what the server enforces.
Photos are shrunk to a small JPEG in the browser before upload.

## Reusable components (`src/components`)

| Component | What it is |
| --- | --- |
| `Cassette` | The tape as SVG, in the two inks. Handwritten label, side letter, counter, and reels that move tape from left to right as the track number rises. Reels spin while a track is cued. |
| `TapePlayer` | Cassette, sides and transport on the left, the cued liner note on the right. Arrow keys skip. Splits into sides A and B, or A to D past 40 tracks. |
| `LinerNote`, `RotationStrip` | One track's note: photo or initials, song, who picked it, tagline in handwriting, the note, a QR code, and the guest of honour's life drawn to scale with the friendship filled in. |
| `SongPickForm` | The friend's form with a live preview of their card. Used for the demo, the share link and the edit link. |
| `PrintCard` | The printed card at 63 x 88 mm proportions. Type scales with the card. Always uses the light inks, because it's paper. |
| `JCard` | The tracklist insert laid flat, at real J-card proportions (15.9 mm flap, 12.7 mm spine, 63.5 mm front, 101.6 mm tall). |
| `InkPicker` | Chooses the two inks. The site, tape page and print pieces all update live. On a real tape it also saves the choice. |
| `QrCode` | A real, scannable QR code drawn as SVG. On real tapes it encodes `/go/<track id>`. |
| `CloseDateEditor`, `ShareLink` | Organiser widgets for the deadline and copyable links. |
| `Button`, `Section`, `Field`, `StepList`, `PricingCard`, `Faq`, `SiteHeader`, `SiteFooter`, `Logo` | Page building blocks. |

Inks and plans live in `@yir/shared` ([inks.ts](../../packages/shared/src/inks.ts), [plans.ts](../../packages/shared/src/plans.ts)), with the field limits. `InkProvider` writes them to the root element as `--pal-*` variables, and
[src/styles/tokens.css](src/styles/tokens.css) maps those to every surface and text token, with separate dark values.
Each ink pair has a `popText` shade for small text, because bright inks like sunflower don't read as text on paper.
The API validates against the same lists, so a change there applies to both.

[public/_headers](public/_headers) sets the security headers and a Content Security Policy for the static files on Pages.

## Staying clear of Spotify

This grew out of a private birthday playlist styled on Spotify's year-in-review. The product keeps the idea and drops everything that belongs to Spotify:

- No Spotify name, logo, green or Spotify Mix typeface. The fonts are Unbounded, Instrument Sans, Reenie Beanie and IBM Plex Mono, all open-licence Google Fonts.
- No "Wrapped" wording and no story-card look. The design is a cassette J-card in two riso-style inks.
- No Spotify Codes. QR codes are generated here and open the song in whatever app the guest uses (through song.link).
- No audio is copied or hosted. Songs are only linked to their official releases, and services are named only to say where a song can be played.
