# Roadmap

What the product needs next. The web app, API, deploy pipeline and daily jobs are built (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## Before launch

1. **Name check.** Search "Years in Rotation" on the CIPC trademark register. The site runs on `minutes.qfm.co.za`.
2. **One-time setup** in [DEPLOY.md](DEPLOY.md): D1, R2, the Pages project and domain, Access, Resend and the GitHub secrets. Then run the first-deploy test.
3. **Privacy notice and terms.** Cover photos of people other than the friend who uploads them, how long tapes stay online (5 years), and how to ask for removal.
4. **Rate limits.** Add a Cloudflare rate-limiting rule on `POST /api/public/*`, so the song-pick and request forms can't be flooded. Sign-in is already rate limited by Better Auth.

## Print

1. Generate print-ready PDFs when a boxed tape is approved: cards 9 up on A4 with crop marks and bleed, and the J-card with fold marks. Cloudflare Browser Rendering can print the existing card components.
2. Add a "download print files" button to the admin's print queue (the "Print queue" filter on the Tapes tab).
3. Get a proof of all four ink pairs from the printer and adjust `web/src/data/inks.ts` to match.
4. Choose the box supplier and confirm how many cards a standard box holds. The Double album box holds twice as many.
5. Ask for the delivery address after approval, and add courier tracking to the "shipped" stage.

## Later

1. **Online checkout:** switch on Paystack (see "Turning on online checkout" in [DEPLOY.md](DEPLOY.md)).
2. **Song search:** let friends search for a song by name instead of pasting a link, and check the title and artist against the result.
3. **A download of everything** for the organiser: notes, photos and the song links, as a zip.
4. **Co-organisers in the UI.** The API already supports them (`POST /api/tapes/:id/members`).
