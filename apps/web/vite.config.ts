import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run dev` proxies the API to `wrangler pages dev` (apps/api, port 8788), so the app and API share one origin like in production.
// `npm run build:single` inlines everything into one HTML file for sharing the demo.
export default defineConfig(({ mode }) => ({
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  build: { outDir: mode === "single" ? "dist-single" : "dist" },
  server: {
    proxy: {
      "/api": { target: "http://localhost:8788" },
      "/go": { target: "http://localhost:8788" },
    },
  },
}));
