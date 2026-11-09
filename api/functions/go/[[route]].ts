// Cloudflare Pages Function for the QR links printed on each card: /go/<track id>.
import { handle } from "hono/cloudflare-pages";
import app from "../../src/app";

export const onRequest = handle(app);
