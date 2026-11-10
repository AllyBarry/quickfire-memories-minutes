-- Prices staff can change in the admin (Pricing tab), with an optional sale.
-- The website shows these, and checkout charges the price showing at the time.
CREATE TABLE plan_price (
  plan_id         TEXT PRIMARY KEY CHECK (plan_id IN ('digital', 'boxed', 'double')),
  price_zar       INTEGER NOT NULL CHECK (price_zar > 0),
  sale_price_zar  INTEGER CHECK (sale_price_zar IS NULL OR sale_price_zar > 0),
  sale_label      TEXT,
  sale_ends_at    TEXT,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT
);

INSERT INTO plan_price (plan_id, price_zar, updated_at) VALUES
  ('digital', 349, '2026-11-10T00:00:00.000Z'),
  ('boxed', 899, '2026-11-10T00:00:00.000Z'),
  ('double', 1299, '2026-11-10T00:00:00.000Z');
