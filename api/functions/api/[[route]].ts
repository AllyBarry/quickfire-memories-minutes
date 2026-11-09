// Cloudflare Pages Function for every /api/* request. The routes live in ../../src.
import { handle } from "hono/cloudflare-pages";
import app from "../../src/app";

export const onRequest = handle(app);
