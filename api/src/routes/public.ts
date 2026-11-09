import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv, Env } from "../env";
import { audit, nowIso } from "../lib/audit";
import { checkPhoto, LIVE_STATES, owner, photoKey, servePhoto, tapeView, trackView, type TapeRow, type TrackRow } from "../lib/db";
import { sendEmail } from "../lib/email";
import { randomId, randomToken, safeEqual, sha256Hex } from "../lib/ids";
import { resolveSongPage, songDestination } from "../lib/songlink";
import { isOpen, isPrinted, minPartyDate } from "../lib/timeline";
import { bornYear, email as emailField, Invalid, INKS, intInRange, isoDate, LIMITS, link, longText, oneOf, pastDate, PLAN_TRACKS, PLANS, text } from "../lib/validate";

/** No sign-in: friends (share link + private edit token), party guests (tape page and QR links) and enquiries. */
export const publicRoutes = new Hono<AppEnv>();

async function tapeBySlug(db: D1Database, slug: string) {
  const tape = await db.prepare("SELECT * FROM tape WHERE slug = ? AND status NOT IN ('cancelled', 'awaiting_payment')").bind(slug.toLowerCase()).first<TapeRow>();
  if (!tape) throw new HTTPException(404, { message: "We couldn't find that tape. Check the link." });
  return tape;
}

/** Validate the friend's fields. `current` fills in anything left out of a partial update. */
function trackFields(body: Record<string, unknown>, current?: TrackRow) {
  const pick = <T>(key: string, fn: () => T, fallback: T | undefined) => (body[key] === undefined && current ? (fallback as T) : fn());
  return {
    contributor: pick("contributor", () => text(body.contributor, "contributor", LIMITS.contributor), current?.contributor),
    tagline: pick("tagline", () => text(body.tagline, "tagline", LIMITS.tagline), current?.tagline),
    since: pick("since", () => pastDate(body.since, "since"), current?.since),
    song: pick("song", () => text(body.song, "song", LIMITS.song), current?.song),
    artist: pick("artist", () => text(body.artist, "artist", LIMITS.artist), current?.artist),
    link: pick("link", () => link(body.link, "link"), current?.link ?? null),
    message: pick("message", () => longText(body.message, "message", LIMITS.message), current?.message),
  };
}

/**
 * The share link. Before approval it's the song-pick form (open or closed).
 * Once the organiser approves the running order, it's the tape itself.
 */
publicRoutes.get("/tapes/:slug", async (c) => {
  const tape = await tapeBySlug(c.env.DB, c.req.param("slug"));
  const v = tapeView(tape);
  const live = LIVE_STATES.includes(tape.status);
  const org = await owner(c.env, tape.id);
  let tracks: ReturnType<typeof trackView>[] = [];
  if (live) {
    const { results } = await c.env.DB.prepare("SELECT * FROM track WHERE tape_id = ? AND status != 'hidden' ORDER BY position").bind(tape.id).all<TrackRow>();
    tracks = results.map((t) => trackView(t, c.env, "/api/public/tracks"));
    // guests don't need the raw link the friend pasted, only the QR destination
    tracks = tracks.map((t) => ({ ...t, link: null }));
  }
  return c.json({
    slug: v.slug,
    honoree: v.honoree,
    occasion: v.occasion,
    bornYear: v.bornYear,
    inkId: v.inkId,
    planId: v.planId,
    state: live ? "live" : v.open ? "open" : "closed",
    closeAt: v.closeAt,
    organiserName: org?.name ?? null,
    tracks,
  });
});

/**
 * Add a song. multipart/form-data with `track` (JSON) and an optional `photo` (JPEG or PNG).
 * Returns the track id and a private edit token. The token is shown once and only its hash is stored.
 */
publicRoutes.post("/tapes/:slug/tracks", async (c) => {
  const tape = await tapeBySlug(c.env.DB, c.req.param("slug"));
  if (!isOpen(tape)) throw new HTTPException(409, { message: "Song picks for this tape have closed." });
  const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM track WHERE tape_id = ?").bind(tape.id).first<{ n: number }>();
  const cap = PLAN_TRACKS[tape.plan_id as keyof typeof PLAN_TRACKS] ?? 40;
  if ((count?.n ?? 0) >= cap) throw new HTTPException(409, { message: "This tape is full. Ask the organiser about a bigger plan." });

  const form = await c.req.formData();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(String(form.get("track") ?? ""));
  } catch {
    throw new Invalid("track", "track must be JSON.");
  }
  const f = trackFields(body);
  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const problem = await checkPhoto(photo, LIMITS.photoBytes);
    if (problem) throw new Invalid("photo", problem);
  }

  const id = randomId();
  const token = randomToken();
  const key = hasPhoto ? photoKey(tape.id, id) : null;
  if (key && hasPhoto) await c.env.PHOTOS.put(key, photo.stream(), { httpMetadata: { contentType: photo.type || "image/jpeg" }, customMetadata: { tapeId: tape.id } });
  const songPage = await resolveSongPage(f.link);

  // the new track lands in place by when this friend met the guest of honour
  const after = await c.env.DB.prepare("SELECT MIN(position) AS p FROM track WHERE tape_id = ? AND since > ?").bind(tape.id, f.since).first<{ p: number | null }>();
  const last = await c.env.DB.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS p FROM track WHERE tape_id = ?").bind(tape.id).first<{ p: number }>();
  const position = after?.p ?? last?.p ?? 1;
  const now = nowIso();
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE track SET position = position + 1 WHERE tape_id = ? AND position >= ?").bind(tape.id, position),
      c.env.DB.prepare(
        `INSERT INTO track (id, tape_id, position, contributor, tagline, since, song, artist, link, song_page_url, message, photo_key, status, edit_token_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
      ).bind(id, tape.id, position, f.contributor, f.tagline, f.since, f.song, f.artist, f.link, songPage, f.message, key, await sha256Hex(token), now, now),
    ]);
  } catch (err) {
    if (key) await c.env.PHOTOS.delete(key); // don't leave an orphaned photo
    throw err;
  }
  await audit(c.env, "contributor", f.contributor, "track.create", tape.id, { trackId: id });
  return c.json({ id, editToken: token, editUrl: `${c.env.APP_URL}/${tape.slug}/edit/${id}#${token}` }, 201);
});

/** The friend's own track, by private edit token (X-Edit-Token header). */
async function ownTrack(env: Env, id: string, token: string | undefined) {
  const row = await env.DB.prepare("SELECT * FROM track WHERE id = ?").bind(id).first<TrackRow>();
  // same 404 for a wrong token and a missing track
  if (!row || !token || !safeEqual(await sha256Hex(token), row.edit_token_hash)) throw new HTTPException(404, { message: "Song not found." });
  return row;
}

async function openTapeFor(env: Env, row: TrackRow) {
  const tape = await env.DB.prepare("SELECT * FROM tape WHERE id = ?").bind(row.tape_id).first<TapeRow>();
  if (!tape || !isOpen(tape)) throw new HTTPException(409, { message: "This tape has closed, so songs can't be changed. Ask the organiser." });
  return tape;
}

publicRoutes.get("/tracks/:id", async (c) => {
  const row = await ownTrack(c.env, c.req.param("id"), c.req.header("X-Edit-Token"));
  const tape = await c.env.DB.prepare("SELECT * FROM tape WHERE id = ?").bind(row.tape_id).first<TapeRow>();
  const v = trackView(row, c.env, "/api/public/tracks");
  return c.json({ ...v, photo: null, hasPhoto: row.photo_key !== null, tape: tape ? { slug: tape.slug, honoree: tape.honoree, bornYear: tape.born_year, open: isOpen(tape) } : null });
});

/** Friends can fix their own song while the tape is still open. Any change sends it back for review. */
publicRoutes.patch("/tracks/:id", async (c) => {
  const row = await ownTrack(c.env, c.req.param("id"), c.req.header("X-Edit-Token"));
  await openTapeFor(c.env, row);
  const f = trackFields(await c.req.json<Record<string, unknown>>(), row);
  const songPage = f.link === row.link ? row.song_page_url : await resolveSongPage(f.link);
  await c.env.DB.prepare(
    "UPDATE track SET contributor = ?, tagline = ?, since = ?, song = ?, artist = ?, link = ?, song_page_url = ?, message = ?, status = 'new', updated_at = ? WHERE id = ?",
  )
    .bind(f.contributor, f.tagline, f.since, f.song, f.artist, f.link, songPage, f.message, nowIso(), row.id)
    .run();
  await audit(c.env, "contributor", f.contributor, "track.update", row.tape_id, { trackId: row.id });
  return c.json({ ok: true });
});

/** Replace the photo: the raw image as the request body. */
publicRoutes.put("/tracks/:id/photo", async (c) => {
  const row = await ownTrack(c.env, c.req.param("id"), c.req.header("X-Edit-Token"));
  await openTapeFor(c.env, row);
  const type = (c.req.header("Content-Type") ?? "").split(";")[0];
  const file = new File([await c.req.arrayBuffer()], "photo", { type });
  const problem = (await checkPhoto(file, LIMITS.photoBytes)) ?? (file.size === 0 ? "The photo is empty." : null);
  if (problem) throw new Invalid("photo", problem);
  const key = photoKey(row.tape_id, row.id);
  await c.env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: type || "image/jpeg" }, customMetadata: { tapeId: row.tape_id } });
  await c.env.DB.prepare("UPDATE track SET photo_key = ?, status = 'new', updated_at = ? WHERE id = ?").bind(key, nowIso(), row.id).run();
  return c.json({ ok: true });
});

publicRoutes.delete("/tracks/:id/photo", async (c) => {
  const row = await ownTrack(c.env, c.req.param("id"), c.req.header("X-Edit-Token"));
  if (row.photo_key) await c.env.PHOTOS.delete(row.photo_key);
  await c.env.DB.prepare("UPDATE track SET photo_key = NULL, updated_at = ? WHERE id = ?").bind(nowIso(), row.id).run();
  return c.json({ ok: true });
});

/** A friend can always delete their own song and photo (privacy right), even after the tape closes. */
publicRoutes.delete("/tracks/:id", async (c) => {
  const row = await ownTrack(c.env, c.req.param("id"), c.req.header("X-Edit-Token"));
  if (row.photo_key) await c.env.PHOTOS.delete(row.photo_key);
  await c.env.DB.prepare("DELETE FROM track WHERE id = ?").bind(row.id).run();
  await audit(c.env, "contributor", row.contributor, "track.delete_own", row.tape_id, { trackId: row.id });
  return c.json({ ok: true });
});

/** A photo on a live tape. Hidden tracks and tapes that aren't approved yet stay private. */
publicRoutes.get("/tracks/:id/photo", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT tr.photo_key, t.status AS tape_status FROM track tr JOIN tape t ON t.id = tr.tape_id WHERE tr.id = ? AND tr.status != 'hidden'",
  )
    .bind(c.req.param("id"))
    .first<{ photo_key: string | null; tape_status: string }>();
  if (!row?.photo_key || !LIVE_STATES.includes(row.tape_status)) throw new HTTPException(404, { message: "No photo." });
  return servePhoto(c.env, row.photo_key);
});

/** "Reserve a tape" while online checkout is switched off. Staff hear about it by email. */
publicRoutes.post("/enquiries", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const planId = oneOf(body.planId, "planId", PLANS);
  const e = {
    id: randomId(),
    name: text(body.name, "name", LIMITS.name),
    email: emailField(body.email),
    honoree: text(body.honoree, "honoree", LIMITS.honoree),
    occasion: text(body.occasion, "occasion", LIMITS.occasion),
    partyDate: isoDate(body.partyDate, "partyDate"),
    planId,
    inkId: oneOf(body.inkId ?? INKS[0], "inkId", INKS),
    bornYear: body.bornYear === undefined || body.bornYear === "" ? null : bornYear(body.bornYear),
    invited: intInRange(body.invited, "invited", 1, 80, 20),
    message: longText(body.message, "message", 500, { required: false }) || null,
  };
  if (e.partyDate < minPartyDate(isPrinted(planId))) throw new Invalid("partyDate", "That party is too soon for this plan.");
  await c.env.DB.prepare(
    `INSERT INTO enquiry (id, name, email, honoree, occasion, party_date, plan_id, ink_id, born_year, invited, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(e.id, e.name, e.email, e.honoree, e.occasion, e.partyDate, e.planId, e.inkId, e.bornYear, e.invited, e.message, nowIso())
    .run();
  try {
    await sendEmail(c.env, {
      to: c.env.STAFF_EMAIL,
      subject: `Tape request: ${e.honoree} ${e.occasion} (${e.planId})`,
      text: `${e.name} <${e.email}> wants a ${e.planId} tape for ${e.honoree}, who ${e.occasion}.\nParty: ${e.partyDate}. About ${e.invited} friends.\n\n${e.message ?? ""}\n\nSet it up in the admin: ${c.env.APP_URL}/admin`,
    });
  } catch (err) {
    console.error("enquiry email failed", err); // the enquiry is saved, staff still see it in the admin
  }
  return c.json({ ok: true }, 201);
});

/** QR links on the printed cards. Server-side, so a dead song link can be fixed after printing. */
export const goRoutes = new Hono<AppEnv>();
goRoutes.get("/go/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT tr.song_page_url, tr.link, tr.song, tr.artist, tr.status, t.slug, t.status AS tape_status FROM track tr JOIN tape t ON t.id = tr.tape_id WHERE tr.id = ?",
  )
    .bind(c.req.param("id"))
    .first<{ song_page_url: string | null; link: string | null; song: string; artist: string; status: string; slug: string; tape_status: string }>();
  if (!row) return c.redirect(c.env.APP_URL, 302);
  if (row.status === "hidden" || !LIVE_STATES.includes(row.tape_status)) return c.redirect(`${c.env.APP_URL}/${row.slug}`, 302);
  return c.redirect(songDestination(row), 302);
});
