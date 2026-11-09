import type { Env } from "../env";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Last few emails in this isolate, for local development only (GET /api/dev/emails). */
export const devOutbox: (Email & { at: string })[] = [];

/** Send through Resend in production. In development, log it and keep it in the dev outbox. */
export async function sendEmail(env: Env, email: Email) {
  if (env.EMAIL_MODE !== "resend") {
    devOutbox.unshift({ ...email, at: new Date().toISOString() });
    devOutbox.length = Math.min(devOutbox.length, 30);
    console.log(`[email:log] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
  });
  if (!res.ok) throw new Error(`Resend rejected the email: ${res.status} ${await res.text()}`);
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function signInEmail(url: string, opts: { name?: string; honoree?: string }) {
  const hello = opts.name ? `Hi ${opts.name},` : "Hi,";
  const what = opts.honoree ? `your dashboard for ${opts.honoree}'s tape` : "your Years in Rotation dashboard";
  return {
    subject: opts.honoree ? `Your link to ${opts.honoree}'s tape` : "Your Years in Rotation sign-in link",
    text: `${hello}\n\nUse this link to open ${what}. It works once and expires in 15 minutes.\n\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    html: `<p>${esc(hello)}</p><p>Use this link to open ${esc(what)}. It works once and expires in 15 minutes.</p><p><a href="${esc(url)}">Open my dashboard</a></p><p style="color:#666">If you didn't ask for this, you can ignore this email.</p>`,
  };
}
