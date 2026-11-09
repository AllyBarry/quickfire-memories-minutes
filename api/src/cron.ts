import type { Env } from "./env";
import { audit, nowIso } from "./lib/audit";
import { deleteTapePhotos, owner, type TapeRow } from "./lib/db";
import { sendEmail } from "./lib/email";
import { closeDate, isPrinted } from "./lib/timeline";

const RETENTION_YEARS = 5;

/**
 * Daily at 08:00 SAST, called by the GitHub Actions schedule (.github/workflows/daily.yml),
 * because Cloudflare Pages has no cron triggers. Each step is independent, and each is safe to run twice.
 */
export async function runDaily(env: Env, now = Date.now()) {
  const results: Record<string, number | string> = {};
  for (const [name, job] of Object.entries({ autoClose, reminders, retention })) {
    try {
      results[name] = await job(env, now);
    } catch (err) {
      console.error(`daily ${name} failed`, err);
      results[name] = `failed: ${String(err)}`;
    }
  }
  console.log("daily", JSON.stringify(results));
  return results;
}

/** Tapes past their close time move to curating, and the organiser hears about it. */
async function autoClose(env: Env, now: number) {
  const { results } = await env.DB.prepare("SELECT * FROM tape WHERE status = 'collecting'").all<TapeRow>();
  let n = 0;
  for (const t of results) {
    if (closeDate(t.party_date, isPrinted(t.plan_id), t.close_at).getTime() > now) continue;
    await env.DB.prepare("UPDATE tape SET status = 'curating', updated_at = ? WHERE id = ? AND status = 'collecting'").bind(nowIso(), t.id).run();
    await audit(env, "system", "daily", "tape.auto_close", t.id);
    const o = await owner(env, t.id);
    if (o) {
      await sendEmail(env, {
        to: o.email,
        subject: `Song picks for ${t.honoree}'s tape have closed`,
        text: `Hi ${o.name},\n\nSong picks have closed. Open the running order to check and approve each track:\n\n${env.APP_URL}/organiser/${t.id}/order\n`,
      });
    }
    n++;
  }
  return n;
}

/** One "two days left" nudge per tape, with the share link to post in the group chat again. */
async function reminders(env: Env, now: number) {
  const { results } = await env.DB.prepare("SELECT * FROM tape WHERE status = 'collecting' AND reminder_sent_at IS NULL").all<TapeRow>();
  let n = 0;
  for (const t of results) {
    const left = closeDate(t.party_date, isPrinted(t.plan_id), t.close_at).getTime() - now;
    if (left <= 0 || left > 2 * 864e5) continue;
    const o = await owner(env, t.id);
    if (o) {
      const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM track WHERE tape_id = ?").bind(t.id).first<{ n: number }>();
      await sendEmail(env, {
        to: o.email,
        subject: `Two days left for ${t.honoree}'s tape`,
        text: `Hi ${o.name},\n\n${count?.n ?? 0} of about ${t.invited} friends have picked a song. Picks close in two days.\nShare the link again to catch the stragglers:\n\n${env.APP_URL}/${t.slug}\n`,
      });
    }
    await env.DB.prepare("UPDATE tape SET reminder_sent_at = ? WHERE id = ?").bind(nowIso(), t.id).run();
    n++;
  }
  return n;
}

/** Delete tapes (and their photos) once the retention period after the party has passed. */
async function retention(env: Env, now: number) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
  const { results } = await env.DB.prepare("SELECT id FROM tape WHERE party_date < ?").bind(cutoff.toISOString().slice(0, 10)).all<{ id: string }>();
  for (const { id } of results) {
    await deleteTapePhotos(env, id);
    await env.DB.prepare("DELETE FROM tape WHERE id = ?").bind(id).run(); // cascades to members, tracks, payments
    await audit(env, "system", "daily", "tape.retention_delete", id, { years: RETENTION_YEARS });
  }
  return results.length;
}
