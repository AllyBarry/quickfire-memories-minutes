import { HTTPException } from "hono/http-exception";
import type { Env } from "../env";
import { randomId, slugFor } from "./ids";
import { closeDate, defaultClose, isPrinted, latestClose, printRun } from "@yir/shared";

/** Friends can add or change songs only while the tape is collecting and before its close time. */
export function isOpen(tape: { party_date: string; plan_id: string; close_at: string | null; status: string }, now = Date.now()) {
  return tape.status === "collecting" && closeDate(tape.party_date, isPrinted(tape.plan_id), tape.close_at).getTime() > now;
}

export interface TapeRow {
  id: string;
  slug: string;
  honoree: string;
  occasion: string;
  born_year: number;
  party_date: string;
  close_at: string | null;
  plan_id: string;
  ink_id: string;
  invited: number;
  status: string;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrackRow {
  id: string;
  tape_id: string;
  position: number;
  contributor: string;
  tagline: string;
  since: string;
  song: string;
  artist: string;
  link: string | null;
  song_page_url: string | null;
  message: string;
  photo_key: string | null;
  status: "new" | "approved" | "hidden";
  edit_token_hash: string;
  created_at: string;
  updated_at: string;
}

/** Statuses after the organiser approved the running order: the tape page is live and QR codes work. */
export const LIVE_STATES = ["approved", "printing", "shipped", "delivered"];

/** Tape as the API returns it: dates worked out, nothing internal. */
export function tapeView(t: TapeRow) {
  const printed = isPrinted(t.plan_id);
  return {
    id: t.id,
    slug: t.slug,
    honoree: t.honoree,
    occasion: t.occasion,
    bornYear: t.born_year,
    partyDate: t.party_date,
    planId: t.plan_id,
    inkId: t.ink_id,
    invited: t.invited,
    status: t.status,
    open: isOpen(t),
    closeAt: closeDate(t.party_date, printed, t.close_at).toISOString(),
    closeIsCustom: t.close_at !== null,
    suggestedCloseAt: defaultClose(t.party_date, printed).toISOString(),
    latestCloseAt: latestClose(t.party_date, printed).toISOString(),
    printRun: printed ? printRun(t.party_date).toISOString().slice(0, 10) : null,
    createdAt: t.created_at,
  };
}

/**
 * Track as organisers and staff see it (never the edit token hash).
 * `photoBase` is the route that serves the photo to this viewer, e.g. "/api/tapes/<id>/tracks".
 */
export function trackView(t: TrackRow, env: Env, photoBase: string) {
  return {
    id: t.id,
    position: t.position,
    contributor: t.contributor,
    tagline: t.tagline,
    since: t.since,
    song: t.song,
    artist: t.artist,
    link: t.link,
    songPageUrl: t.song_page_url,
    message: t.message,
    photo: t.photo_key ? `${photoBase}/${t.id}/photo` : null,
    qr: `${env.APP_URL}/go/${t.id}`,
    status: t.status,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

export async function getTape(env: Env, id: string) {
  return env.DB.prepare("SELECT * FROM tape WHERE id = ?").bind(id).first<TapeRow>();
}

/** The tape, if this organiser is a member. 404 (not 403) otherwise, so ids can't be probed. */
export async function tapeForMember(env: Env, tapeId: string, email: string) {
  const tape = await env.DB.prepare("SELECT t.* FROM tape t JOIN tape_member m ON m.tape_id = t.id WHERE t.id = ? AND m.email = ?")
    .bind(tapeId, email)
    .first<TapeRow>();
  if (!tape) throw new HTTPException(404, { message: "Tape not found." });
  return tape;
}

export async function memberRole(env: Env, tapeId: string, email: string) {
  const row = await env.DB.prepare("SELECT role FROM tape_member WHERE tape_id = ? AND email = ?").bind(tapeId, email).first<{ role: string }>();
  return row?.role ?? null;
}

export async function owner(env: Env, tapeId: string) {
  return env.DB.prepare("SELECT o.email, o.name FROM tape_member m JOIN organiser o ON o.email = m.email WHERE m.tape_id = ? AND m.role = 'owner'")
    .bind(tapeId)
    .first<{ email: string; name: string }>();
}

/** A share-link slug that isn't taken yet: nandi30, nandi30b, nandi30c... then a random tail. */
export async function uniqueSlug(env: Env, honoree: string, occasion: string) {
  const base = slugFor(honoree, occasion);
  for (const suffix of ["", "b", "c", "d", "e"]) {
    const taken = await env.DB.prepare("SELECT 1 FROM tape WHERE slug = ?").bind(base + suffix).first();
    if (!taken) return base + suffix;
  }
  return `${base}-${randomId(4)}`;
}

export async function tapeCounts(env: Env, tapeId: string) {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
            SUM(CASE WHEN status = 'hidden' THEN 1 ELSE 0 END) AS hidden
     FROM track WHERE tape_id = ?`,
  )
    .bind(tapeId)
    .first<{ total: number; approved: number | null; hidden: number | null }>();
  return { total: row?.total ?? 0, approved: row?.approved ?? 0, hidden: row?.hidden ?? 0 };
}

export const photoKey = (tapeId: string, trackId: string) => `photos/${tapeId}/${trackId}.jpg`;

/** Check an uploaded photo really is a JPEG or PNG by its first bytes, not just its declared type. */
export async function checkPhoto(file: File, maxBytes: number) {
  if (file.size === 0) return null;
  if (file.size > maxBytes) return "That photo is too large. Try a smaller one.";
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const jpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const png = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return jpeg || png ? null : "The photo must be a JPEG or PNG.";
}

export async function servePhoto(env: Env, key: string) {
  const object = await env.PHOTOS.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=3600");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}

/** Delete every photo stored for a tape. */
export async function deleteTapePhotos(env: Env, tapeId: string) {
  let cursor: string | undefined;
  do {
    const page = await env.PHOTOS.list({ prefix: `photos/${tapeId}/`, cursor });
    if (page.objects.length) await env.PHOTOS.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
