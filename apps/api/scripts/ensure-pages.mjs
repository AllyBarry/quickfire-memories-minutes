// Makes sure the Cloudflare Pages project, its custom domain and the domain's DNS record exist.
// Safe to run on every deploy: anything already in place is left alone.
//
// Pages keeps these outside wrangler.jsonc (a Worker would attach its domain from `routes`), so the deploy
// workflow runs this before `wrangler pages deploy`.
//
// Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, PAGES_PROJECT, SITE_URL.
// Token needs: Account / Cloudflare Pages / Edit, Zone / Zone / Read and Zone / DNS / Edit on the site's zone.

const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, PAGES_PROJECT: project, SITE_URL: siteUrl } = process.env;
for (const [k, v] of Object.entries({ CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account, PAGES_PROJECT: project, SITE_URL: siteUrl })) {
  if (!v) fail(`${k} is not set.`);
}
const domain = new URL(siteUrl).hostname;
// CF_API_BASE is only for testing against a mock.
const apiBase = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function cf(method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok && data.success !== false, result: data.result, errors: data.errors ?? [] };
}
const why = (r) => r.errors.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${r.status}`;

// 1. The project
const base = `/accounts/${account}/pages/projects`;
let p = await cf("GET", `${base}/${project}`);
if (p.status === 404) {
  p = await cf("POST", base, { name: project, production_branch: "main" });
  if (!p.ok) fail(`Couldn't create the Pages project ${project}: ${why(p)}`);
  console.log(`Created the Pages project ${project}.`);
} else if (!p.ok) {
  fail(`Couldn't read the Pages project ${project}: ${why(p)}`);
} else {
  console.log(`Pages project ${project} exists.`);
}
const target = p.result?.subdomain ?? `${project}.pages.dev`;

if (domain.endsWith(".pages.dev")) {
  console.log(`SITE_URL is the pages.dev address, so there's no custom domain to attach.`);
  process.exit(0);
}

// 2. The custom domain on the project
const domains = await cf("GET", `${base}/${project}/domains`);
if (!domains.ok) fail(`Couldn't list the project's domains: ${why(domains)}`);
const attached = domains.result.find((d) => d.name === domain);
if (attached) {
  console.log(`${domain} is attached (status: ${attached.status}).`);
} else {
  const add = await cf("POST", `${base}/${project}/domains`, { name: domain });
  if (!add.ok) fail(`Couldn't attach ${domain}: ${why(add)}`);
  console.log(`Attached ${domain}. Cloudflare issues its certificate in the next few minutes.`);
}

// 3. The DNS record. The zone is the longest suffix of the domain found in the account (qfm.co.za for minutes.qfm.co.za).
const labels = domain.split(".");
let zone;
for (let i = 0; i < labels.length - 1 && !zone; i++) {
  const z = await cf("GET", `/zones?name=${labels.slice(i).join(".")}&account.id=${account}`);
  if (!z.ok) fail(`Couldn't look up the zone for ${domain}: ${why(z)}. Does the token have Zone Read?`);
  zone = z.result[0];
}
if (!zone) fail(`No Cloudflare zone in this account covers ${domain}. Add the DNS record (CNAME ${domain} to ${target}) wherever its DNS lives.`);

const records = await cf("GET", `/zones/${zone.id}/dns_records?name=${domain}`);
if (!records.ok) fail(`Couldn't read DNS records in ${zone.name}: ${why(records)}. Does the token have DNS Edit on ${zone.name}?`);
const existing = records.result;
if (existing.some((r) => r.type === "CNAME" && r.content === target)) {
  console.log(`DNS: ${domain} already points to ${target}.`);
} else if (existing.length) {
  // Never overwrite a record someone else made.
  fail(`DNS: ${domain} already has a record (${existing[0].type} ${existing[0].content}). Change it to CNAME ${target} by hand if that's intended.`);
} else {
  const add = await cf("POST", `/zones/${zone.id}/dns_records`, {
    type: "CNAME",
    name: domain,
    content: target,
    proxied: true,
    comment: `Cloudflare Pages: ${project}`,
  });
  if (!add.ok) fail(`Couldn't add the DNS record for ${domain}: ${why(add)}`);
  console.log(`DNS: added CNAME ${domain} to ${target} (proxied).`);
}
