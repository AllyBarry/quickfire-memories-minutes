-- Years in Rotation application tables.
-- Times are ISO 8601 strings. Deadlines are worked out in South African time (UTC+02:00, no daylight saving).

-- Someone who runs tapes. Keyed by email so staff can set an organiser up before they ever sign in.
-- A magic-link sign-in proves they own the address.
CREATE TABLE organiser (
  email       TEXT PRIMARY KEY,          -- lower-cased
  name        TEXT NOT NULL,
  phone       TEXT,
  source      TEXT NOT NULL CHECK (source IN ('checkout', 'admin')),
  created_by  TEXT,                      -- staff email when source = 'admin'
  created_at  TEXT NOT NULL
);

CREATE TABLE tape (
  id          TEXT PRIMARY KEY,          -- random, not guessable
  slug        TEXT NOT NULL UNIQUE,      -- share link: minutes.qfm.co.za/<slug>
  honoree     TEXT NOT NULL,
  occasion    TEXT NOT NULL,
  born_year   INTEGER NOT NULL,          -- the rotation strip on each liner note starts here
  party_date  TEXT NOT NULL,             -- YYYY-MM-DD
  close_at    TEXT,                      -- organiser's chosen close; NULL = suggested
  plan_id     TEXT NOT NULL CHECK (plan_id IN ('digital', 'boxed', 'double')),
  ink_id      TEXT NOT NULL,
  invited     INTEGER NOT NULL DEFAULT 20,
  status      TEXT NOT NULL DEFAULT 'collecting'
              CHECK (status IN ('awaiting_payment', 'collecting', 'curating', 'approved', 'printing', 'shipped', 'delivered', 'cancelled')),
  reminder_sent_at TEXT,                 -- "two days left" nudge to the organiser
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX tape_status_idx ON tape (status);
CREATE INDEX tape_party_idx ON tape (party_date);

-- Who may manage a tape. Organisers are matched by verified email.
CREATE TABLE tape_member (
  tape_id     TEXT NOT NULL REFERENCES tape (id) ON DELETE CASCADE,
  email       TEXT NOT NULL REFERENCES organiser (email),
  role        TEXT NOT NULL CHECK (role IN ('owner', 'co_organiser')),
  added_at    TEXT NOT NULL,
  PRIMARY KEY (tape_id, email)
);
CREATE INDEX tape_member_email_idx ON tape_member (email);

-- One friend's track. The id is also the QR code's short link (/go/<id>), so it is long and random.
CREATE TABLE track (
  id              TEXT PRIMARY KEY,
  tape_id         TEXT NOT NULL REFERENCES tape (id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,
  contributor     TEXT NOT NULL,
  tagline         TEXT NOT NULL,         -- how they know the guest of honour
  since           TEXT NOT NULL,         -- YYYY-MM-DD they met
  song            TEXT NOT NULL,
  artist          TEXT NOT NULL,
  link            TEXT,                  -- whatever the friend pasted, from any music app
  song_page_url   TEXT,                  -- resolved song.link page that opens in every app
  message         TEXT NOT NULL,
  photo_key       TEXT,                  -- R2 object key
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'approved', 'hidden')),
  edit_token_hash TEXT NOT NULL,         -- SHA-256 of the friend's private edit token
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX track_tape_idx ON track (tape_id, position);

CREATE TABLE payment (
  id          TEXT PRIMARY KEY,
  tape_id     TEXT NOT NULL REFERENCES tape (id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('paystack', 'manual')),
  reference   TEXT NOT NULL UNIQUE,
  amount_zar  INTEGER NOT NULL,          -- whole rand
  status      TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded', 'comped')),
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX payment_tape_idx ON payment (tape_id);

-- "Reserve a tape" requests while online checkout is switched off.
CREATE TABLE enquiry (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  honoree     TEXT NOT NULL,
  occasion    TEXT NOT NULL,
  party_date  TEXT NOT NULL,
  plan_id     TEXT NOT NULL,
  ink_id      TEXT NOT NULL,
  born_year   INTEGER,
  invited     INTEGER,
  message     TEXT,
  created_at  TEXT NOT NULL,
  handled_at  TEXT,
  handled_by  TEXT
);
CREATE INDEX enquiry_open_idx ON enquiry (handled_at, created_at);

-- Every staff action, every deletion, every payment change.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  at          TEXT NOT NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('staff', 'organiser', 'contributor', 'system')),
  actor       TEXT,
  action      TEXT NOT NULL,
  tape_id     TEXT,
  detail      TEXT                       -- JSON
);
CREATE INDEX audit_tape_idx ON audit_log (tape_id);
CREATE INDEX audit_at_idx ON audit_log (at);
