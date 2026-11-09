/** Paystack: hosted checkout + signed webhooks. No card data ever reaches these Functions. */
import { safeEqual } from "./ids";

/** Paystack signs the raw webhook body with HMAC-SHA512 using your secret key (header x-paystack-signature). */
export async function verifyPaystackSignature(rawBody: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(hex, signature.toLowerCase());
}

/** Start a hosted Paystack payment. Amount in rand. Paystack wants the lowest unit (cents). */
export async function initialisePayment(secret: string, opts: { email: string; amountZar: number; reference: string; callbackUrl: string; tapeId: string }) {
  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountZar * 100,
      currency: "ZAR",
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: { tape_id: opts.tapeId },
    }),
  });
  const body = (await res.json()) as { status: boolean; message: string; data?: { authorization_url: string } };
  if (!res.ok || !body.status || !body.data) throw new Error(`Paystack initialise failed: ${body.message}`);
  return body.data.authorization_url;
}
