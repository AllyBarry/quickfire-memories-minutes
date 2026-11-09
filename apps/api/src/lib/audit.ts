import type { Env } from "../env";

export type ActorType = "staff" | "organiser" | "contributor" | "system";

/** Append to the audit log. Never throws into the request: a failed audit write is logged instead. */
export async function audit(env: Env, actorType: ActorType, actor: string | null, action: string, tapeId: string | null, detail?: unknown) {
  try {
    await env.DB.prepare("INSERT INTO audit_log (at, actor_type, actor, action, tape_id, detail) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(new Date().toISOString(), actorType, actor, action, tapeId, detail === undefined ? null : JSON.stringify(detail))
      .run();
  } catch (err) {
    console.error("audit write failed", action, err);
  }
}

export const nowIso = () => new Date().toISOString();
