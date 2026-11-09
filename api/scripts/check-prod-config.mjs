// Fails the deploy if wrangler.jsonc still has placeholder production values.
// Usage: node scripts/check-prod-config.mjs
import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
// strip whole-line // comments, then trailing commas
const json = raw.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
const config = JSON.parse(json);
const prod = config.env?.production;
if (!prod) {
  console.error("wrangler.jsonc has no env.production block.");
  process.exit(1);
}

const problems = [];
for (const [where, dbs] of [
  ["d1_databases", config.d1_databases],
  ["env.production.d1_databases", prod.d1_databases],
]) {
  for (const db of dbs ?? []) {
    if (/^0{8}-/.test(db.database_id)) problems.push(`${where}.${db.binding}.database_id is the placeholder. Run: npx wrangler d1 create ${db.database_name}`);
  }
}
for (const [k, v] of Object.entries(prod.vars ?? {})) {
  if (typeof v === "string" && v.includes("REPLACE")) problems.push(`env.production.vars.${k} is still "${v}"`);
}
if (problems.length) {
  console.error("Production config isn't ready:\n- " + problems.join("\n- ") + "\nSee docs/DEPLOY.md.");
  process.exit(1);
}
console.log("Production config looks complete.");
