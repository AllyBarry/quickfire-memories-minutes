import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sendSignInLink } from "../auth";
import type { AppEnv } from "../env";
import { requireStaff } from "../lib/access";
import { audit, nowIso } from "../lib/audit";
import { getTape, servePhoto, tapeCounts, tapeView, trackView, uniqueSlug, type TapeRow, type TrackRow } from "../lib/db";
import { randomId } from "../lib/ids";
import { isPrinted, minPartyDate } from "../lib/timeline";
import { bornYear, email as emailField, Invalid, INKS, intInRange, isoDate, LIMITS, oneOf, PLAN_PRICE_ZAR, PLANS, text } from "../lib/validate";

/** Staff only (Cloudflare Access). Every write is audited with the staff member's email. */
export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("*", requireStaff);

const STATUSES = ["awaiting_payment", "collecting", "curating", "approved", "printing", "shipped", "delivered", "cancelled"] as const;

adminRoutes.get("/whoami", (c) => c.json({ email: c.get("staffEmail") }));

adminRoutes.get("/tapes", async (c) => {
  const status = c.req.query("status");
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  const where: string[] = [];
  const args: unknown[] = [];
  if (status) {
    where.push("t.status = ?");
    args.push(oneOf(status, "status", STATUSES));
  }
  if (q) {
    where.push("(t.id LIKE ? OR t.slug LIKE ? OR lower(t.honoree) LIKE ? OR m.email LIKE ? OR lower(o.name) LIKE ?)");
    const like = `%${q}%`;
    args.push(like, like, like, like, like);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, o.name AS owner_name, m.email AS owner_email,
            (SELECT COUNT(*) FROM track tr WHERE tr.tape_id = t.id) AS tracks,
            (SELECT COUNT(*) FROM track tr WHERE tr.tape_id = t.id AND tr.status = 'hidden') AS hidden,
            (SELECT status FROM payment p WHERE p.tape_id = t.id ORDER BY p.created_at DESC LIMIT 1) AS payment_status,
            (SELECT COALESCE(SUM(amount_zar), 0) FROM payment p WHERE p.tape_id = t.id AND p.status = 'paid') AS paid_zar
     FROM tape t
     LEFT JOIN tape_member m ON m.tape_id = t.id AND m.role = 'owner'
     LEFT JOIN organiser o ON o.email = m.email
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY t.created_at DESC LIMIT 300`,
  )
    .bind(...args)
    .all<TapeRow & { owner_name: string | null; owner_email: string | null; tracks: number; hidden: number; payment_status: string | null; paid_zar: number }>();
  return c.json(
    results.map((t) => ({
      ...tapeView(t),
      owner: { name: t.owner_name, email: t.owner_email },
      tracks: t.tracks,
      hidden: t.hidden,
      paymentStatus: t.payment_status,
      paidZar: t.paid_zar,
    })),
  );
});

adminRoutes.get("/tapes/:id", async (c) => {
  const tape = await getTape(c.env, c.req.param("id"));
  if (!tape) throw new HTTPException(404, { message: "Tape not found." });
  const db = c.env.DB;
  const [members, payments, tracks, log] = await Promise.all([
    db.prepare("SELECT m.email, m.role, o.name, o.phone FROM tape_member m JOIN organiser o ON o.email = m.email WHERE m.tape_id = ?").bind(tape.id).all(),
    db.prepare("SELECT provider, reference, amount_zar, status, note, created_at FROM payment WHERE tape_id = ? ORDER BY created_at DESC").bind(tape.id).all(),
    db.prepare("SELECT * FROM track WHERE tape_id = ? ORDER BY position").bind(tape.id).all<TrackRow>(),
    db.prepare("SELECT at, actor_type, actor, action, detail FROM audit_log WHERE tape_id = ? ORDER BY id DESC LIMIT 100").bind(tape.id).all(),
  ]);
  return c.json({
    ...tapeView(tape),
    counts: await tapeCounts(c.env, tape.id),
    members: members.results,
    payments: payments.results,
    tracks: tracks.results.map((t) => trackView(t, c.env, `/api/admin/tracks`)),
    audit: log.results,
    shareUrl: `${c.env.APP_URL}/${tape.slug}`,
  });
});

/** Staff move a tape through production, or change its deadline for an organiser. */
adminRoutes.patch("/tapes/:id", async (c) => {
  const staff = c.get("staffEmail")!;
  const tape = await getTape(c.env, c.req.param("id"));
  if (!tape) throw new HTTPException(404, { message: "Tape not found." });
  const body = await c.req.json<Record<string, unknown>>();
  const sets: string[] = [];
  const args: unknown[] = [];
  if (body.status !== undefined) {
    sets.push("status = ?");
    args.push(oneOf(body.status, "status", STATUSES));
  }
  if (body.closeAt !== undefined) {
    if (body.closeAt === null) sets.push("close_at = NULL");
    else {
      // staff may set any future time, e.g. a deadline extension agreed with the printer
      const v = new Date(text(body.closeAt, "closeAt", 40));
      if (Number.isNaN(v.getTime())) throw new Invalid("closeAt", "Pick a valid date and time.");
      sets.push("close_at = ?");
      args.push(v.toISOString());
    }
  }
  if (!sets.length) throw new Invalid("body", "Nothing to change.");
  sets.push("updated_at = ?");
  args.push(nowIso(), tape.id);
  await c.env.DB.prepare(`UPDATE tape SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
  await audit(c.env, "staff", staff, "tape.admin_update", tape.id, body);
  return c.json(tapeView((await getTape(c.env, tape.id))!));
});

adminRoutes.get("/tracks/:id/photo", async (c) => {
  const row = await c.env.DB.prepare("SELECT photo_key FROM track WHERE id = ?").bind(c.req.param("id")).first<{ photo_key: string | null }>();
  if (!row?.photo_key) throw new HTTPException(404, { message: "No photo." });
  return servePhoto(c.env, row.photo_key);
});

adminRoutes.get("/organisers", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT o.email, o.name, o.phone, o.source, o.created_at,
            COUNT(m.tape_id) AS tapes,
            (SELECT COALESCE(SUM(p.amount_zar), 0) FROM payment p JOIN tape_member mm ON mm.tape_id = p.tape_id
              WHERE mm.email = o.email AND mm.role = 'owner' AND p.status = 'paid') AS paid_zar,
            (SELECT MAX(s."updatedAt") FROM "user" u JOIN "session" s ON s."userId" = u.id WHERE lower(u.email) = o.email) AS last_seen
     FROM organiser o LEFT JOIN tape_member m ON m.email = o.email
     GROUP BY o.email ORDER BY o.created_at DESC LIMIT 500`,
  ).all();
  return c.json(results);
});

/**
 * Sign up an organiser with their first tape by hand (while online checkout is off, or for an EFT order),
 * and optionally email them a sign-in link to their dashboard.
 */
adminRoutes.post("/organisers", async (c) => {
  const staff = c.get("staffEmail")!;
  const body = await c.req.json<Record<string, any>>();
  const email = emailField(body.email);
  const name = text(body.name, "name", LIMITS.name);
  const phone = text(body.phone, "phone", 30, { required: false }) || null;
  const t = body.tape ?? {};
  const honoree = text(t.honoree, "tape.honoree", LIMITS.honoree);
  const occasion = text(t.occasion, "tape.occasion", LIMITS.occasion);
  const born = bornYear(t.bornYear, "tape.bornYear");
  const planId = oneOf(t.planId, "tape.planId", PLANS);
  const inkId = oneOf(t.inkId ?? INKS[0], "tape.inkId", INKS);
  const partyDate = isoDate(t.partyDate, "tape.partyDate");
  // staff may override the lead-time rule (e.g. a rush order agreed with the printer)
  if (partyDate < minPartyDate(isPrinted(planId)) && body.allowShortNotice !== true) {
    throw new Invalid("tape.partyDate", "That party is too soon for this plan. Tick \"short notice\" to override.");
  }
  const invited = intInRange(t.invited, "tape.invited", 1, 80, 20);
  const p = body.payment ?? {};
  const paymentStatus = oneOf(p.status ?? "comped", "payment.status", ["paid", "comped"] as const);
  const amount = paymentStatus === "paid" ? intInRange(p.amountZar, "payment.amountZar", 0, 100000, PLAN_PRICE_ZAR[planId]) : 0;
  const note = text(p.note, "payment.note", 200, { required: false }) || null;

  const tapeId = randomId();
  const slug = await uniqueSlug(c.env, honoree, occasion);
  const now = nowIso();
  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO organiser (email, name, phone, source, created_by, created_at) VALUES (?, ?, ?, 'admin', ?, ?)
       ON CONFLICT (email) DO UPDATE SET name = excluded.name, phone = COALESCE(excluded.phone, organiser.phone)`,
    ).bind(email, name, phone, staff, now),
    c.env.DB.prepare(
      `INSERT INTO tape (id, slug, honoree, occasion, born_year, party_date, plan_id, ink_id, invited, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'collecting', ?, ?)`,
    ).bind(tapeId, slug, honoree, occasion, born, partyDate, planId, inkId, invited, now, now),
    c.env.DB.prepare("INSERT INTO tape_member (tape_id, email, role, added_at) VALUES (?, ?, 'owner', ?)").bind(tapeId, email, now),
    c.env.DB.prepare(
      `INSERT INTO payment (id, tape_id, provider, reference, amount_zar, status, note, created_at, updated_at)
       VALUES (?, ?, 'manual', ?, ?, ?, ?, ?, ?)`,
    ).bind(randomId(), tapeId, `manual-${tapeId}`, amount, paymentStatus, note, now, now),
  ];
  if (typeof body.enquiryId === "string") {
    stmts.push(c.env.DB.prepare("UPDATE enquiry SET handled_at = ?, handled_by = ? WHERE id = ? AND handled_at IS NULL").bind(now, staff, body.enquiryId));
  }
  await c.env.DB.batch(stmts);
  await audit(c.env, "staff", staff, "organiser.create_manual", tapeId, { email, planId, paymentStatus, amount });

  let linkSent = false;
  if (body.sendLink !== false) {
    await sendSignInLink(c.env, email, name, `/organiser/${tapeId}`);
    await audit(c.env, "staff", staff, "organiser.send_link", tapeId, { email });
    linkSent = true;
  }
  return c.json({ organiser: { email, name }, tape: tapeView((await getTape(c.env, tapeId))!), shareUrl: `${c.env.APP_URL}/${slug}`, linkSent }, 201);
});

/** Email an organiser a fresh sign-in link (e.g. "I lost the email"). */
adminRoutes.post("/organisers/:email/send-link", async (c) => {
  const staff = c.get("staffEmail")!;
  const email = emailField(decodeURIComponent(c.req.param("email")));
  const body = await c.req.json<{ tapeId?: string }>().catch(() => ({}) as { tapeId?: string });
  const org = await c.env.DB.prepare("SELECT name FROM organiser WHERE email = ?").bind(email).first<{ name: string }>();
  if (!org) throw new HTTPException(404, { message: "No organiser with that email." });
  let path = "/organiser";
  if (body.tapeId) {
    const member = await c.env.DB.prepare("SELECT 1 FROM tape_member WHERE tape_id = ? AND email = ?").bind(body.tapeId, email).first();
    if (!member) throw new Invalid("tapeId", "That organiser isn't on that tape.");
    path = `/organiser/${body.tapeId}`;
  }
  await sendSignInLink(c.env, email, org.name, path);
  await audit(c.env, "staff", staff, "organiser.send_link", body.tapeId ?? null, { email });
  return c.json({ ok: true });
});

/** Privacy removal on request: deletes the track and its photo, and records why. */
adminRoutes.delete("/tracks/:id", async (c) => {
  const staff = c.get("staffEmail")!;
  const { reason } = await c.req.json<{ reason?: string }>().catch(() => ({ reason: undefined }));
  const why = text(reason, "reason", 200);
  const row = await c.env.DB.prepare("SELECT id, tape_id, photo_key, contributor FROM track WHERE id = ?").bind(c.req.param("id")).first<{
    id: string;
    tape_id: string;
    photo_key: string | null;
    contributor: string;
  }>();
  if (!row) throw new HTTPException(404, { message: "Song not found." });
  if (row.photo_key) await c.env.PHOTOS.delete(row.photo_key);
  await c.env.DB.prepare("DELETE FROM track WHERE id = ?").bind(row.id).run();
  await audit(c.env, "staff", staff, "track.delete_privacy", row.tape_id, { trackId: row.id, reason: why });
  return c.json({ ok: true });
});

adminRoutes.get("/enquiries", async (c) => {
  const open = c.req.query("open") !== "false";
  const { results } = await c.env.DB.prepare(`SELECT * FROM enquiry ${open ? "WHERE handled_at IS NULL" : ""} ORDER BY created_at DESC LIMIT 200`).all();
  return c.json(results);
});

adminRoutes.post("/enquiries/:id/handled", async (c) => {
  const staff = c.get("staffEmail")!;
  const res = await c.env.DB.prepare("UPDATE enquiry SET handled_at = ?, handled_by = ? WHERE id = ? AND handled_at IS NULL").bind(nowIso(), staff, c.req.param("id")).run();
  if (!res.meta.changes) throw new HTTPException(404, { message: "No open request with that id." });
  await audit(c.env, "staff", staff, "enquiry.handled", null, { enquiryId: c.req.param("id") });
  return c.json({ ok: true });
});

adminRoutes.get("/audit", async (c) => {
  const tapeId = c.req.query("tapeId");
  const stmt = tapeId
    ? c.env.DB.prepare("SELECT * FROM audit_log WHERE tape_id = ? ORDER BY id DESC LIMIT 200").bind(tapeId)
    : c.env.DB.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200");
  return c.json((await stmt.all()).results);
});
