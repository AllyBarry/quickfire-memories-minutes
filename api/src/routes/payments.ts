import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sendSignInLink } from "../auth";
import type { AppEnv } from "../env";
import { audit, nowIso } from "../lib/audit";
import { owner, uniqueSlug } from "../lib/db";
import { randomId } from "../lib/ids";
import { initialisePayment, verifyPaystackSignature } from "../lib/paystack";
import { isPrinted, minPartyDate } from "../lib/timeline";
import { bornYear, email as emailField, Invalid, INKS, intInRange, isoDate, LIMITS, oneOf, PLAN_PRICE_ZAR, PLANS, text } from "../lib/validate";

export const paymentRoutes = new Hono<AppEnv>();

/** Whether the web app should offer online payment, or the "reserve a tape" form. */
paymentRoutes.get("/checkout", (c) => c.json({ enabled: c.env.CHECKOUT_ENABLED === "true" && Boolean(c.env.PAYSTACK_SECRET_KEY) }));

/**
 * Online checkout. Switched off (CHECKOUT_ENABLED=false) until Paystack is set up: the web app then sends
 * a "reserve a tape" request instead, and staff set the organiser up in the admin.
 */
paymentRoutes.post("/checkout", async (c) => {
  if (c.env.CHECKOUT_ENABLED !== "true" || !c.env.PAYSTACK_SECRET_KEY) {
    return c.json({ error: "coming_soon", message: "Online payment is coming soon. Send a request and we'll set your tape up for you." }, 503);
  }
  const body = await c.req.json<Record<string, any>>();
  const email = emailField(body.email);
  const name = text(body.name, "name", LIMITS.name);
  const planId = oneOf(body.planId, "planId", PLANS);
  const inkId = oneOf(body.inkId ?? INKS[0], "inkId", INKS);
  const honoree = text(body.honoree, "honoree", LIMITS.honoree);
  const occasion = text(body.occasion, "occasion", LIMITS.occasion);
  const born = bornYear(body.bornYear);
  const partyDate = isoDate(body.partyDate, "partyDate");
  if (partyDate < minPartyDate(isPrinted(planId))) throw new Invalid("partyDate", "That party is too soon for this plan.");
  const invited = intInRange(body.invited, "invited", 1, 80, 20);

  const tapeId = randomId();
  const reference = `yir-${tapeId}`;
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO organiser (email, name, source, created_at) VALUES (?, ?, 'checkout', ?) ON CONFLICT (email) DO UPDATE SET name = excluded.name").bind(email, name, now),
    c.env.DB.prepare(
      `INSERT INTO tape (id, slug, honoree, occasion, born_year, party_date, plan_id, ink_id, invited, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_payment', ?, ?)`,
    ).bind(tapeId, await uniqueSlug(c.env, honoree, occasion), honoree, occasion, born, partyDate, planId, inkId, invited, now, now),
    c.env.DB.prepare("INSERT INTO tape_member (tape_id, email, role, added_at) VALUES (?, ?, 'owner', ?)").bind(tapeId, email, now),
    c.env.DB.prepare("INSERT INTO payment (id, tape_id, provider, reference, amount_zar, status, created_at, updated_at) VALUES (?, ?, 'paystack', ?, ?, 'pending', ?, ?)").bind(
      randomId(),
      tapeId,
      reference,
      PLAN_PRICE_ZAR[planId],
      now,
      now,
    ),
  ]);
  const url = await initialisePayment(c.env.PAYSTACK_SECRET_KEY, {
    email,
    amountZar: PLAN_PRICE_ZAR[planId],
    reference,
    callbackUrl: `${c.env.APP_URL}/checkout/complete`,
    tapeId,
  });
  return c.json({ tapeId, paymentUrl: url }, 201);
});

/** Paystack webhook. The only thing that marks a tape paid. Idempotent: repeats are ignored. */
paymentRoutes.post("/webhooks/paystack", async (c) => {
  const secret = c.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new HTTPException(503, { message: "Payments are not configured." });
  const raw = await c.req.text();
  if (!(await verifyPaystackSignature(raw, c.req.header("x-paystack-signature"), secret))) throw new HTTPException(401, { message: "Bad signature." });
  const event = JSON.parse(raw) as { event: string; data: { reference: string; amount: number; currency: string } };
  if (event.event !== "charge.success") return c.json({ ok: true, ignored: event.event });

  const payment = await c.env.DB.prepare("SELECT id, tape_id, amount_zar, status FROM payment WHERE reference = ?").bind(event.data.reference).first<{
    id: string;
    tape_id: string;
    amount_zar: number;
    status: string;
  }>();
  if (!payment) return c.json({ ok: true, ignored: "unknown reference" });
  if (payment.status === "paid") return c.json({ ok: true, duplicate: true });
  if (event.data.currency !== "ZAR" || event.data.amount !== payment.amount_zar * 100) {
    await audit(c.env, "system", "paystack", "payment.amount_mismatch", payment.tape_id, event.data);
    throw new HTTPException(400, { message: "Amount mismatch." });
  }
  const now = nowIso();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE payment SET status = 'paid', updated_at = ? WHERE id = ?").bind(now, payment.id),
    c.env.DB.prepare("UPDATE tape SET status = 'collecting', updated_at = ? WHERE id = ? AND status = 'awaiting_payment'").bind(now, payment.tape_id),
  ]);
  await audit(c.env, "system", "paystack", "payment.paid", payment.tape_id, { reference: event.data.reference });
  const o = await owner(c.env, payment.tape_id);
  if (o) await sendSignInLink(c.env, o.email, o.name, `/organiser/${payment.tape_id}`);
  return c.json({ ok: true });
});
