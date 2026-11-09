import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sendSignInLink } from "../auth";
import type { AppEnv } from "../env";
import { requireOrganiser } from "../lib/access";
import { audit, nowIso } from "../lib/audit";
import { memberRole, owner, servePhoto, tapeCounts, tapeForMember, tapeView, trackView, type TrackRow } from "../lib/db";
import { resolveSongPage } from "../lib/songlink";
import { checkCloseAt, INK_IDS, isPrinted, LIMITS } from "@yir/shared";
import { email as emailField, Invalid, intInRange, link, longText, oneOf, pastDate, text } from "../lib/validate";

/** Signed-in organisers. Every tape route checks membership by verified email. */
export const organiserRoutes = new Hono<AppEnv>();
organiserRoutes.use("/me", requireOrganiser);
organiserRoutes.use("/tapes/*", requireOrganiser);

const EDITABLE = ["collecting", "curating"];

organiserRoutes.get("/me", async (c) => {
  const email = c.get("organiserEmail")!;
  const org = await c.env.DB.prepare("SELECT name, email FROM organiser WHERE email = ?").bind(email).first<{ name: string; email: string }>();
  const { results } = await c.env.DB.prepare("SELECT t.*, m.role FROM tape t JOIN tape_member m ON m.tape_id = t.id WHERE m.email = ? AND t.status != 'cancelled' ORDER BY t.party_date")
    .bind(email)
    .all<Parameters<typeof tapeView>[0] & { role: string }>();
  return c.json({ email, name: org?.name ?? null, tapes: results.map((t) => ({ ...tapeView(t), role: t.role })) });
});

organiserRoutes.get("/tapes/:id", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  const { results: members } = await c.env.DB.prepare("SELECT m.email, m.role, o.name FROM tape_member m JOIN organiser o ON o.email = m.email WHERE m.tape_id = ?").bind(tape.id).all();
  const org = await owner(c.env, tape.id);
  return c.json({
    ...tapeView(tape),
    counts: await tapeCounts(c.env, tape.id),
    members,
    you: email,
    organiserName: org?.name ?? null,
    organiserEmail: org?.email ?? null,
    reminderSentAt: tape.reminder_sent_at,
    shareUrl: `${c.env.APP_URL}/${tape.slug}`,
  });
});

/**
 * Change the song-pick deadline, inks or invite count.
 * closeAt: an ISO time, null to go back to the suggested time, or "now" to close immediately.
 */
organiserRoutes.patch("/tapes/:id", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  const body = await c.req.json<Record<string, unknown>>();
  const sets: string[] = [];
  const args: unknown[] = [];
  const changes: Record<string, unknown> = {};

  if ("closeAt" in body) {
    if (!EDITABLE.includes(tape.status)) throw new HTTPException(409, { message: "The running order is approved, so the deadline can't change." });
    if (body.closeAt === "now") {
      sets.push("close_at = ?", "status = 'curating'");
      args.push(nowIso());
    } else if (body.closeAt === null) {
      sets.push("close_at = NULL", "status = 'collecting'");
    } else {
      const value = text(body.closeAt, "closeAt", 40);
      const problem = checkCloseAt(value, tape.party_date, isPrinted(tape.plan_id));
      if (problem) throw new Invalid("closeAt", problem);
      sets.push("close_at = ?", "status = 'collecting'");
      args.push(new Date(value).toISOString());
    }
    changes.closeAt = body.closeAt;
  }
  if ("inkId" in body) {
    if (!EDITABLE.includes(tape.status)) throw new HTTPException(409, { message: "The tape is approved, so the inks can't change." });
    sets.push("ink_id = ?");
    args.push(oneOf(body.inkId, "inkId", INK_IDS));
    changes.inkId = body.inkId;
  }
  if ("invited" in body) {
    sets.push("invited = ?");
    args.push(intInRange(body.invited, "invited", 1, 80, tape.invited));
    changes.invited = body.invited;
  }
  if (sets.length === 0) throw new Invalid("body", "Nothing to change.");
  sets.push("updated_at = ?");
  args.push(nowIso(), tape.id);
  await c.env.DB.prepare(`UPDATE tape SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
  await audit(c.env, "organiser", email, "tape.update", tape.id, changes);
  return c.json(tapeView(await tapeForMember(c.env, tape.id, email)));
});

organiserRoutes.get("/tapes/:id/tracks", async (c) => {
  const tape = await tapeForMember(c.env, c.req.param("id"), c.get("organiserEmail")!);
  const { results } = await c.env.DB.prepare("SELECT * FROM track WHERE tape_id = ? ORDER BY position").bind(tape.id).all<TrackRow>();
  return c.json(results.map((t) => trackView(t, c.env, `/api/tapes/${tape.id}/tracks`)));
});

/** Running order: fix text, approve, hide. Editing text sends an approved track back to "new". */
organiserRoutes.patch("/tapes/:id/tracks/:tid", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  if (!EDITABLE.includes(tape.status)) throw new HTTPException(409, { message: "The running order is approved. Reopen it first." });
  const row = await c.env.DB.prepare("SELECT * FROM track WHERE id = ? AND tape_id = ?").bind(c.req.param("tid"), tape.id).first<TrackRow>();
  if (!row) throw new HTTPException(404, { message: "Song not found." });
  const body = await c.req.json<Record<string, unknown>>();
  const next = {
    contributor: body.contributor === undefined ? row.contributor : text(body.contributor, "contributor", LIMITS.contributor),
    tagline: body.tagline === undefined ? row.tagline : text(body.tagline, "tagline", LIMITS.tagline),
    since: body.since === undefined ? row.since : pastDate(body.since, "since"),
    song: body.song === undefined ? row.song : text(body.song, "song", LIMITS.song),
    artist: body.artist === undefined ? row.artist : text(body.artist, "artist", LIMITS.artist),
    link: body.link === undefined ? row.link : link(body.link, "link"),
    message: body.message === undefined ? row.message : longText(body.message, "message", LIMITS.message),
  };
  const textChanged = (Object.keys(next) as (keyof typeof next)[]).some((k) => next[k] !== row[k]);
  let status = body.status === undefined ? row.status : oneOf(body.status, "status", ["new", "approved", "hidden"] as const);
  if (textChanged && body.status === undefined && status === "approved") status = "new";
  const songPage = next.link === row.link ? row.song_page_url : await resolveSongPage(next.link);
  await c.env.DB.prepare(
    "UPDATE track SET contributor = ?, tagline = ?, since = ?, song = ?, artist = ?, link = ?, song_page_url = ?, message = ?, status = ?, updated_at = ? WHERE id = ?",
  )
    .bind(next.contributor, next.tagline, next.since, next.song, next.artist, next.link, songPage, next.message, status, nowIso(), row.id)
    .run();
  await audit(c.env, "organiser", email, "track.curate", tape.id, { trackId: row.id, status, textChanged });
  return c.json({ ok: true, status });
});

/** Set the running order: the full list of track ids, first to last. */
organiserRoutes.post("/tapes/:id/tracks/order", async (c) => {
  const tape = await tapeForMember(c.env, c.req.param("id"), c.get("organiserEmail")!);
  if (!EDITABLE.includes(tape.status)) throw new HTTPException(409, { message: "The running order is approved. Reopen it first." });
  const { ids } = await c.req.json<{ ids: unknown }>();
  const { results } = await c.env.DB.prepare("SELECT id FROM track WHERE tape_id = ?").bind(tape.id).all<{ id: string }>();
  const existing = new Set(results.map((r) => r.id));
  if (!Array.isArray(ids) || ids.length !== existing.size || new Set(ids).size !== ids.length || !ids.every((x) => typeof x === "string" && existing.has(x))) {
    throw new Invalid("ids", "Send every track id on this tape exactly once.");
  }
  const now = nowIso();
  await c.env.DB.batch(ids.map((id, i) => c.env.DB.prepare("UPDATE track SET position = ?, updated_at = ? WHERE id = ?").bind(i + 1, now, id)));
  return c.json({ ok: true });
});

organiserRoutes.get("/tapes/:id/tracks/:tid/photo", async (c) => {
  const tape = await tapeForMember(c.env, c.req.param("id"), c.get("organiserEmail")!);
  const row = await c.env.DB.prepare("SELECT photo_key FROM track WHERE id = ? AND tape_id = ?").bind(c.req.param("tid"), tape.id).first<{ photo_key: string | null }>();
  if (!row?.photo_key) throw new HTTPException(404, { message: "No photo." });
  return servePhoto(c.env, row.photo_key);
});

/** Approve the running order once every visible track is approved. The tape page goes live and boxes join the print run. */
organiserRoutes.post("/tapes/:id/approve", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  if (!EDITABLE.includes(tape.status)) throw new HTTPException(409, { message: "This tape is already approved." });
  const counts = await tapeCounts(c.env, tape.id);
  const visible = counts.total - counts.hidden;
  if (visible === 0) throw new HTTPException(409, { message: "There are no songs to approve yet." });
  if (counts.approved < visible) throw new HTTPException(409, { message: `Approve the remaining ${visible - counts.approved} tracks first.` });
  const now = nowIso();
  await c.env.DB.prepare("UPDATE tape SET status = 'approved', close_at = COALESCE(close_at, ?), updated_at = ? WHERE id = ?").bind(now, now, tape.id).run();
  await audit(c.env, "organiser", email, "tape.approve", tape.id, { tracks: visible });
  return c.json({ ok: true });
});

/** Take an approved tape back to the running order, as long as it hasn't gone to the printer. */
organiserRoutes.post("/tapes/:id/reopen", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  if (tape.status !== "approved") throw new HTTPException(409, { message: tape.status === "printing" || tape.status === "shipped" || tape.status === "delivered" ? "The box has gone to print, so the running order can't change. Contact us." : "Only an approved tape can be reopened." });
  await c.env.DB.prepare("UPDATE tape SET status = 'curating', updated_at = ? WHERE id = ?").bind(nowIso(), tape.id).run();
  await audit(c.env, "organiser", email, "tape.reopen", tape.id);
  return c.json({ ok: true });
});

/** Owners can add a co-organiser, who gets a sign-in link. */
organiserRoutes.post("/tapes/:id/members", async (c) => {
  const email = c.get("organiserEmail")!;
  const tape = await tapeForMember(c.env, c.req.param("id"), email);
  if ((await memberRole(c.env, tape.id, email)) !== "owner") throw new HTTPException(403, { message: "Only the tape's owner can add organisers." });
  const body = await c.req.json<Record<string, unknown>>();
  const newEmail = emailField(body.email);
  const name = text(body.name, "name", LIMITS.name);
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO organiser (email, name, source, created_by, created_at) VALUES (?, ?, 'checkout', ?, ?) ON CONFLICT (email) DO NOTHING").bind(newEmail, name, email, now),
    c.env.DB.prepare("INSERT INTO tape_member (tape_id, email, role, added_at) VALUES (?, ?, 'co_organiser', ?) ON CONFLICT DO NOTHING").bind(tape.id, newEmail, now),
  ]);
  await sendSignInLink(c.env, newEmail, name, `/organiser/${tape.id}`);
  await audit(c.env, "organiser", email, "tape.add_member", tape.id, { email: newEmail });
  return c.json({ ok: true }, 201);
});
