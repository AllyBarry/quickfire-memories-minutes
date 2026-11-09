/**
 * The clickable demo (/demo/* on sample data) is for local development and the one-file demo build
 * (`npm run build:single`). The production build that Pages deploys leaves it out: no routes, no links,
 * and Vite drops the demo-only code from the bundle because MODE is replaced at build time.
 */
export const SHOW_DEMO = import.meta.env.MODE !== "production";
