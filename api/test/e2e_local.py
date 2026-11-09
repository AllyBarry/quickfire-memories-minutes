"""End-to-end check against `wrangler pages dev` (local D1 + R2, real Better Auth, dev email outbox).

Run from api/:
  npm run db:migrate:local
  npx wrangler pages dev ../web/dist --port 8788 --binding APP_URL=http://localhost:8788 --binding BETTER_AUTH_URL=http://localhost:8788
  python3 test/e2e_local.py
Needs ADMIN_DEV_EMAIL and CRON_SECRET in .dev.vars. Uses only the standard library.
"""
import datetime
import json
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE = "http://localhost:8788"
RUN = uuid.uuid4().hex[:6]
passed = 0

# a 1x1 PNG
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360f8cf00000301010018dd8db00000000049454e44ae426082"
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


opener = urllib.request.build_opener(NoRedirect)


def call(method, path, body=None, headers=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Origin": BASE}
    if data is not None:
        h["Content-Type"] = ctype
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        res = opener.open(req)
    except urllib.error.HTTPError as e:
        res = e
    payload = res.read()
    try:
        parsed = json.loads(payload) if payload else None
    except ValueError:
        parsed = payload
    return res.status, parsed, res.headers


def multipart(fields, files):
    boundary = "----yir" + uuid.uuid4().hex
    out = b""
    for k, v in fields.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    for k, (name, ctype, content) in files.items():
        out += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return out, f"multipart/form-data; boundary={boundary}"


def check(name, cond, detail=""):
    global passed
    if not cond:
        print(f"FAIL  {name}  {detail}")
        sys.exit(1)
    passed += 1
    print(f"ok    {name}")


def latest_link(email):
    _, outbox, _ = call("GET", "/api/dev/emails")
    for m in outbox:
        if m["to"] == email:
            found = re.search(r"https?://\S+", m["text"])
            if found:
                return found.group(0), m
    return None, None


def sign_in(email):
    """Follow the emailed magic link and return the session cookie."""
    link, _ = latest_link(email)
    if not link:
        return None
    status, _, headers = call("GET", link.replace(BASE, ""))
    cookies = [c.split(";")[0] for c in headers.get_all("Set-Cookie") or []]
    return "; ".join(cookies) if status in (200, 302) and cookies else None


def cron_secret():
    for line in (Path(__file__).parent.parent / ".dev.vars").read_text().splitlines():
        if line.startswith("CRON_SECRET="):
            return line.split("=", 1)[1].strip()
    return ""


party = (datetime.date.today() + datetime.timedelta(days=45)).isoformat()
owner_email = f"organiser-{RUN}@example.com"
other_email = f"other-{RUN}@example.com"

# --- site and health
s, b, _ = call("GET", "/api/health")
check("health", s == 200 and b["ok"], b)
s, b, _ = call("GET", "/nandi30")
check("share links fall back to the web app", s == 200 and b"<div id=\"root\">" in b, s)

# --- checkout is off, so friends of the store send a request
s, b, _ = call("GET", "/api/checkout")
check("checkout reports switched off", s == 200 and b["enabled"] is False, b)
s, b, _ = call("POST", "/api/checkout", {"email": "x@example.com"})
check("checkout says coming soon", s == 503 and b["error"] == "coming_soon", b)
s, b, _ = call("POST", "/api/public/enquiries", {"name": "Thandi", "email": f"thandi-{RUN}@example.com", "honoree": "Sipho", "occasion": "turns 40", "partyDate": party, "planId": "boxed", "inkId": "forest-tangerine", "bornYear": 1986, "invited": 25})
check("tape request is saved", s == 201, b)
s, b, _ = call("POST", "/api/public/enquiries", {"name": "Thandi", "email": "nope", "honoree": "Sipho", "occasion": "turns 40", "partyDate": party, "planId": "boxed"})
check("tape request checks the email", s == 400 and b["field"] == "email", b)

# --- staff set up an organiser
s, b, _ = call("GET", "/api/admin/whoami")
check("admin works locally as the dev staff email", s == 200 and b["email"] == "staff@example.com", b)
s, enq, _ = call("GET", "/api/admin/enquiries")
mine = [e for e in enq if e["email"] == f"thandi-{RUN}@example.com"]
check("admin sees the request", len(mine) == 1, enq)
s, b, _ = call(
    "POST",
    "/api/admin/organisers",
    {"name": "Kabelo", "email": owner_email, "tape": {"honoree": "Nandi", "occasion": "turns 30", "bornYear": 1996, "partyDate": party, "planId": "boxed", "inkId": "night-neon", "invited": 12}, "payment": {"status": "paid", "note": "EFT"}, "enquiryId": mine[0]["id"]},
)
check("admin creates organiser and tape", s == 201 and b["linkSent"], b)
tape_id = b["tape"]["id"]
slug = b["tape"]["slug"]
s, enq, _ = call("GET", "/api/admin/enquiries")
check("setting up a request marks it handled", all(e["id"] != mine[0]["id"] for e in enq), enq)
call("POST", "/api/admin/organisers", {"name": "Other", "email": other_email, "tape": {"honoree": "Pieter", "occasion": "turns 40", "bornYear": 1986, "partyDate": party, "planId": "digital"}})
s, b, _ = call("POST", "/api/admin/organisers", {"name": "X", "email": "x@example.com", "tape": {"honoree": "X", "occasion": "turns 30", "bornYear": 1996, "partyDate": datetime.date.today().isoformat(), "planId": "boxed"}})
check("admin refuses a party inside the lead time", s == 400 and b["field"] == "tape.partyDate", b)

# --- organiser signs in
cookie = sign_in(owner_email)
check("magic link signs the organiser in", cookie is not None)
auth = {"Cookie": cookie}
s, b, _ = call("GET", "/api/me", headers=auth)
check("organiser sees their tape", s == 200 and [t["id"] for t in b["tapes"]] == [tape_id], b)
s, b, _ = call("GET", "/api/me")
check("no session, no dashboard", s == 401, b)
other = {"Cookie": sign_in(other_email)}
s, b, _ = call("GET", f"/api/tapes/{tape_id}", headers=other)
check("another organiser can't open the tape", s == 404, b)
s, b, _ = call("POST", "/api/auth/sign-in/magic-link", {"email": f"stranger-{RUN}@example.com", "callbackURL": BASE + "/organiser"})
link, _ = latest_link(f"stranger-{RUN}@example.com")
check("strangers get the same answer and no email", s == 200 and link is None, b)

# --- friends pick songs
s, b, _ = call("GET", f"/api/public/tapes/{slug}")
check("share link shows an open tape", s == 200 and b["state"] == "open" and b["organiserName"] == "Kabelo", b)
track = {"contributor": "Megan Fourie", "tagline": "Road-trip DJ", "since": "2015-07-24", "song": "Midnight City", "artist": "M83", "link": "https://example.com/track/1", "message": "Somewhere past Colesberg at 2 a.m. with the windows down."}
raw, ctype = multipart({"track": json.dumps(track)}, {"photo": ("p.png", "image/png", PNG)})
s, megan, _ = call("POST", f"/api/public/tapes/{slug}/tracks", raw=raw, ctype=ctype)
check("friend adds a song with a photo", s == 201 and megan["editToken"] and f"/{slug}/edit/" in megan["editUrl"], megan)
early = dict(track, contributor="Lerato Mokoena", tagline="Grade 1 desk mate", since="2002-01-16", song="Weekend Special", artist="Brenda Fassie", link="")
raw, ctype = multipart({"track": json.dumps(early)}, {})
s, lerato, _ = call("POST", f"/api/public/tapes/{slug}/tracks", raw=raw, ctype=ctype)
check("second friend adds a song without a photo", s == 201, lerato)
raw, ctype = multipart({"track": json.dumps(dict(track, since="2999-01-01"))}, {})
s, b, _ = call("POST", f"/api/public/tapes/{slug}/tracks", raw=raw, ctype=ctype)
check("a meeting date in the future is refused", s == 400 and b["field"] == "since", b)
raw, ctype = multipart({"track": json.dumps(track)}, {"photo": ("p.png", "image/png", b"not an image at all")})
s, b, _ = call("POST", f"/api/public/tapes/{slug}/tracks", raw=raw, ctype=ctype)
check("a file that isn't a photo is refused", s == 400 and b["field"] == "photo", b)
s, b, _ = call("GET", f"/api/tapes/{tape_id}/tracks", headers=auth)
check("tracks line up by when friends met", [t["id"] for t in b] == [lerato["id"], megan["id"]], [t["since"] for t in b])

# --- a friend edits their own song
tok = {"X-Edit-Token": megan["editToken"]}
s, b, _ = call("GET", f"/api/public/tracks/{megan['id']}", headers=tok)
check("friend opens their own song", s == 200 and b["hasPhoto"] and b["tape"]["open"], b)
s, b, _ = call("GET", f"/api/public/tracks/{megan['id']}", headers={"X-Edit-Token": "wrong"})
check("a wrong edit token looks like a missing song", s == 404, b)
s, b, _ = call("PATCH", f"/api/public/tracks/{megan['id']}", {"message": "Somewhere past Colesberg, windows down, this song on repeat."}, headers=tok)
check("friend changes their note", s == 200, b)
s, b, _ = call("PUT", f"/api/public/tracks/{megan['id']}/photo", raw=PNG, ctype="image/png", headers=tok)
check("friend replaces their photo", s == 200, b)
s, b, _ = call("GET", f"/api/public/tracks/{megan['id']}/photo")
check("photos stay private before approval", s == 404, b)
s, b, _ = call("GET", f"/api/tapes/{tape_id}/tracks/{megan['id']}/photo", headers=auth)
check("organiser can see the photo", s == 200 and b == PNG, s)

# --- organiser closes, curates and approves
s, b, _ = call("PATCH", f"/api/tapes/{tape_id}", {"closeAt": "2000-01-01T00:00:00Z"}, headers=auth)
check("a close time in the past is refused", s == 400 and b["field"] == "closeAt", b)
s, b, _ = call("PATCH", f"/api/tapes/{tape_id}", {"inkId": "oxblood-sky", "invited": 15}, headers=auth)
check("organiser changes inks and invite count", s == 200 and b["inkId"] == "oxblood-sky" and b["invited"] == 15, b)
s, b, _ = call("PATCH", f"/api/tapes/{tape_id}", {"closeAt": "now"}, headers=auth)
check("organiser closes picks now", s == 200 and b["status"] == "curating" and not b["open"], b)
s, b, _ = call("GET", f"/api/public/tapes/{slug}")
check("share link shows closed", b["state"] == "closed", b)
raw, ctype = multipart({"track": json.dumps(track)}, {})
s, b, _ = call("POST", f"/api/public/tapes/{slug}/tracks", raw=raw, ctype=ctype)
check("no new songs after close", s == 409, b)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/approve", headers=auth)
check("can't approve before every track is approved", s == 409, b)
for t in (megan, lerato):
    call("PATCH", f"/api/tapes/{tape_id}/tracks/{t['id']}", {"status": "approved"}, headers=auth)
s, b, _ = call("PATCH", f"/api/tapes/{tape_id}/tracks/{megan['id']}", {"song": "Midnight City (Live)"}, headers=auth)
check("editing an approved track sends it back for review", s == 200 and b["status"] == "new", b)
call("PATCH", f"/api/tapes/{tape_id}/tracks/{megan['id']}", {"status": "approved"}, headers=auth)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/tracks/order", {"ids": [lerato["id"]]}, headers=auth)
check("a running order must list every track", s == 400, b)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/tracks/order", {"ids": [megan["id"], lerato["id"]]}, headers=auth)
check("organiser reorders the tape", s == 200, b)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/approve", headers=auth)
check("organiser approves the running order", s == 200, b)

# --- the tape is live
s, b, _ = call("GET", f"/api/public/tapes/{slug}")
check("share link is now the tape, in the organiser's order", b["state"] == "live" and [t["id"] for t in b["tracks"]] == [megan["id"], lerato["id"]], b)
check("guests don't see the raw links friends pasted", all(t["link"] is None for t in b["tracks"]), b["tracks"])
s, b, _ = call("GET", f"/api/public/tracks/{megan['id']}/photo")
check("photo is public once the tape is live", s == 200 and b == PNG, s)
s, _, h = call("GET", f"/go/{megan['id']}")
check("QR link redirects to the friend's song link", s == 302 and h["Location"] == "https://example.com/track/1", h.get("Location"))
s, _, h = call("GET", f"/go/{lerato['id']}")
check("QR link without a song link falls back to a search", s == 302 and "Brenda" in h["Location"], h.get("Location"))
s, _, h = call("GET", "/go/doesnotexist")
check("unknown QR link goes home", s == 302, h.get("Location"))

# --- reopen, hide one, approve again
s, b, _ = call("POST", f"/api/tapes/{tape_id}/reopen", headers=auth)
check("organiser reopens the running order", s == 200, b)
call("PATCH", f"/api/tapes/{tape_id}/tracks/{lerato['id']}", {"status": "hidden"}, headers=auth)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/approve", headers=auth)
check("approve again with one track hidden", s == 200, b)
s, b, _ = call("GET", f"/api/public/tapes/{slug}")
check("hidden tracks stay off the tape", [t["id"] for t in b["tracks"]] == [megan["id"]], b)
s, _, h = call("GET", f"/go/{lerato['id']}")
check("a hidden track's QR goes to the tape instead", s == 302 and h["Location"].endswith(f"/{slug}"), h.get("Location"))

# --- privacy
s, b, _ = call("DELETE", f"/api/public/tracks/{lerato['id']}", headers={"X-Edit-Token": lerato["editToken"]})
check("a friend can delete their song after close", s == 200, b)
s, b, _ = call("DELETE", f"/api/admin/tracks/{megan['id']}", {})
check("privacy removal needs a reason", s == 400, b)
s, b, _ = call("DELETE", f"/api/admin/tracks/{megan['id']}", {"reason": "Asked by email"})
check("staff remove a song on request", s == 200, b)
s, b, _ = call("GET", f"/api/admin/tapes/{tape_id}")
actions = [a["action"] for a in b["audit"]]
check("everything is in the audit log", b["counts"]["total"] == 0 and "track.delete_privacy" in actions and "tape.approve" in actions and "organiser.create_manual" in actions, actions)

# --- admin moves the box through production
s, b, _ = call("PATCH", f"/api/admin/tapes/{tape_id}", {"status": "printing"})
check("staff move the tape to printing", s == 200 and b["status"] == "printing", b)
s, b, _ = call("POST", f"/api/tapes/{tape_id}/reopen", headers=auth)
check("organiser can't reopen once printing", s == 409, b)
s, b, _ = call("GET", "/api/admin/tapes?q=nandi")
check("admin search finds the tape", any(t["id"] == tape_id for t in b), b)
s, b, _ = call("GET", "/api/admin/organisers")
check("admin lists organisers", any(o["email"] == owner_email and o["tapes"] == 1 for o in b), b)

# --- daily job and payments
s, b, _ = call("POST", "/api/cron")
check("daily job refuses a missing token", s == 401, b)
s, b, _ = call("POST", "/api/cron", headers={"Authorization": f"Bearer {cron_secret()}"})
check("daily job runs with the token", s == 200 and "autoClose" in b and "retention" in b, b)
s, b, _ = call("POST", "/api/webhooks/paystack", {"event": "charge.success"})
check("Paystack webhook is off without a key", s == 503, b)

# --- sign out
s, b, _ = call("POST", "/api/auth/sign-out", {}, headers=auth)
s, b, _ = call("GET", "/api/me", headers=auth)
check("signed out", s == 401, b)

print(f"\n{passed} checks passed")
