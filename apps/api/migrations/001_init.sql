-- Oroud offers aggregator: initial schema (spec section 4).
-- Money is JOD numeric(12,3). Times are timestamptz (stored UTC, shown in Asia/Amman).

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- Users ---------------------------------------------------------------------

CREATE TABLE users (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone            text UNIQUE,
  email            citext UNIQUE,
  display_name     text,
  locale           text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  area             text,
  location_consent boolean NOT NULL DEFAULT false,
  location         geography(Point, 4326),
  alerts_per_day   smallint NOT NULL DEFAULT 3 CHECK (alerts_per_day BETWEEN 0 AND 10),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      citext NOT NULL UNIQUE,
  role       text NOT NULL CHECK (role IN ('admin', 'reviewer', 'support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Catalogue -----------------------------------------------------------------

CREATE TABLE categories (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug      text NOT NULL UNIQUE,
  name_en   text NOT NULL,
  name_ar   text NOT NULL,
  parent_id bigint REFERENCES categories(id)
);

-- Shops ---------------------------------------------------------------------

CREATE TABLE shops (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_en                  text,
  name_ar                  text,
  slug                     text NOT NULL UNIQUE,
  category_ids             bigint[] NOT NULL DEFAULT '{}',
  phone                    text,
  whatsapp_number          text,
  ig_username              text UNIQUE,
  ig_account_type          text NOT NULL DEFAULT 'unknown'
                             CHECK (ig_account_type IN ('business', 'creator', 'personal', 'unknown')),
  ig_ownership_verified_at timestamptz,
  fb_page_url              text,
  tiktok_username          text,
  bio_page_slug            text UNIQUE,
  keyword                  text NOT NULL DEFAULT 'عروض',
  auto_reply_enabled       boolean NOT NULL DEFAULT true,
  status                   text NOT NULL DEFAULT 'unclaimed'
                             CHECK (status IN ('unclaimed', 'claimed', 'verified', 'suspended', 'removed')),
  plan                     text NOT NULL DEFAULT 'free',
  messaging_opt_out        boolean NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CHECK (name_en IS NOT NULL OR name_ar IS NOT NULL)
);

CREATE TABLE shop_branches (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id       bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          text,
  area          text,
  geo           geography(Point, 4326),
  geo_verified  boolean NOT NULL DEFAULT false,
  address       text,
  opening_hours jsonb,
  is_primary    boolean NOT NULL DEFAULT false
);
CREATE INDEX shop_branches_geo_idx ON shop_branches USING gist (geo);
CREATE UNIQUE INDEX shop_branches_one_primary ON shop_branches (shop_id) WHERE is_primary;

CREATE TABLE shop_members (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id         bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id         bigint REFERENCES users(id),
  whatsapp_number text,
  role            text NOT NULL CHECK (role IN ('owner', 'staff')),
  CHECK (user_id IS NOT NULL OR whatsapp_number IS NOT NULL)
);
CREATE UNIQUE INDEX shop_members_whatsapp_idx ON shop_members (whatsapp_number);

CREATE TABLE ig_connections (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id          bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  ig_user_id       text NOT NULL,
  fb_page_id       text,
  access_token_enc bytea NOT NULL, -- encrypted at rest (NFR-04)
  scopes           text[] NOT NULL DEFAULT '{}',
  connected_at     timestamptz NOT NULL DEFAULT now(),
  token_expires_at timestamptz,
  last_media_id    text,
  last_polled_at   timestamptz,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked'))
);
CREATE UNIQUE INDEX ig_connections_active_idx ON ig_connections (shop_id) WHERE status = 'active';

CREATE TABLE ownership_checks (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id     bigint NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  method      text NOT NULL CHECK (method IN ('bio_code', 'dm_code')),
  code        char(6) NOT NULL,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz
);

CREATE TABLE curated_accounts (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ig_username    text NOT NULL UNIQUE,
  shop_id        bigint REFERENCES shops(id),
  active         boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  last_media_id  text,
  last_error     text
);

-- Intake --------------------------------------------------------------------

CREATE TABLE sources (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type        text NOT NULL CHECK (type IN ('whatsapp', 'link_share', 'ig_discovery', 'ig_connected',
                                            'ig_mention', 'admin')),
  external_id text, -- IG media ID or WA message ID
  permalink   text,
  raw_text    text,
  media_keys  text[] NOT NULL DEFAULT '{}', -- only images shops send on WhatsApp
  received_at timestamptz NOT NULL DEFAULT now(),
  sender_ref  text,
  shop_id     bigint REFERENCES shops(id)
);
CREATE UNIQUE INDEX sources_external_idx ON sources (type, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX sources_permalink_idx ON sources (permalink) WHERE permalink IS NOT NULL;

CREATE TABLE extractions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id      bigint NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  model          text NOT NULL,
  prompt_version text NOT NULL,
  output         jsonb NOT NULL,
  confidence     jsonb NOT NULL,
  is_offer       boolean NOT NULL,
  input_tokens   integer,
  output_tokens  integer,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Offers --------------------------------------------------------------------

CREATE TABLE offers (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id         bigint NOT NULL REFERENCES shops(id),
  branch_id       bigint REFERENCES shop_branches(id),
  source_id       bigint REFERENCES sources(id),
  extraction_id   bigint REFERENCES extractions(id),
  title_en        text,
  title_ar        text,
  description     text,
  category_id     bigint REFERENCES categories(id),
  price           numeric(12, 3),
  was_price       numeric(12, 3),
  discount_pct    smallint CHECK (discount_pct BETWEEN 0 AND 100),
  currency        char(3) NOT NULL DEFAULT 'JOD',
  starts_at       timestamptz,
  ends_at         timestamptz,
  end_date_basis  text NOT NULL DEFAULT 'none'
                    CHECK (end_date_basis IN ('stated', 'inferred', 'shop_added', 'none')),
  end_confirmed_at timestamptz, -- resets the 7-day no-end-date rule (FR-LC-02)
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'in_review', 'live', 'ending_soon', 'ended', 'hidden', 'rejected')),
  posted_at       timestamptz,
  published_at    timestamptz,
  embed_permalink text,
  boost_until     timestamptz,
  report_count    integer NOT NULL DEFAULT 0,
  search_text     text NOT NULL DEFAULT '', -- normalised Arabic + English for search
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (title_en IS NOT NULL OR title_ar IS NOT NULL)
);
CREATE INDEX offers_visible_idx ON offers (status, published_at DESC) WHERE status IN ('live', 'ending_soon');
CREATE INDEX offers_ends_at_idx ON offers (ends_at) WHERE status IN ('live', 'ending_soon');
CREATE INDEX offers_shop_idx ON offers (shop_id, created_at DESC);
CREATE INDEX offers_search_trgm_idx ON offers USING gin (search_text gin_trgm_ops);

-- Buyer activity ------------------------------------------------------------

CREATE TABLE saves (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id   bigint NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, offer_id)
);

CREATE TABLE follows (
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('shop', 'category', 'area')),
  target_id   text NOT NULL, -- shop id, category id, or area name
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE reports (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id   bigint NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  user_id    bigint REFERENCES users(id),
  reason     text NOT NULL CHECK (reason IN ('ended', 'wrong_price', 'not_offer', 'inappropriate')),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Reports from the same user count once (FR-LC-03).
CREATE UNIQUE INDEX reports_one_per_user_idx ON reports (offer_id, user_id, reason);

CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id   bigint REFERENCES offers(id) ON DELETE SET NULL,
  shop_id    bigint REFERENCES shops(id) ON DELETE SET NULL,
  user_id    bigint REFERENCES users(id) ON DELETE SET NULL,
  type       text NOT NULL,
  props      jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_shop_time_idx ON events (shop_id, created_at);

-- Payments ------------------------------------------------------------------

CREATE TABLE boosts (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  offer_id          bigint NOT NULL REFERENCES offers(id),
  shop_id           bigint NOT NULL REFERENCES shops(id),
  starts_at         timestamptz,
  ends_at           timestamptz,
  amount            numeric(12, 3) NOT NULL,
  stripe_payment_id text UNIQUE,
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'active', 'ended', 'refunded', 'failed'))
);

-- Growth loops --------------------------------------------------------------

CREATE TABLE comment_replies (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shop_id          bigint NOT NULL REFERENCES shops(id),
  ig_media_id      text NOT NULL,
  ig_comment_id    text NOT NULL UNIQUE, -- one reply per comment (FR-GR-03)
  commenter_ig_id  text NOT NULL,
  offer_id         bigint REFERENCES offers(id),
  sent_at          timestamptz,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  error            text
);
-- One private reply per user per post (FR-GR-03).
CREATE UNIQUE INDEX comment_replies_user_post_idx ON comment_replies (ig_media_id, commenter_ig_id);

CREATE TABLE daily_posts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date          date NOT NULL UNIQUE,
  offer_ids     bigint[] NOT NULL,
  ig_media_id   text,
  collaborators bigint[] NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'invited', 'published', 'failed'))
);

CREATE TABLE seo_pages (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  path         text NOT NULL UNIQUE,
  locale       text NOT NULL CHECK (locale IN ('ar', 'en')),
  category_id  bigint REFERENCES categories(id),
  area         text,
  title        text NOT NULL,
  offer_ids    bigint[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- Settings and audit --------------------------------------------------------

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor     text NOT NULL, -- 'system', 'shop:<id>', 'admin:<id>', 'job:<name>'
  action    text NOT NULL,
  entity    text NOT NULL,
  entity_id text NOT NULL,
  before    jsonb,
  after     jsonb,
  at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id, at);

-- Seed data -----------------------------------------------------------------

INSERT INTO categories (slug, name_en, name_ar) VALUES
  ('fashion', 'Fashion', 'أزياء'),
  ('shoes', 'Shoes', 'أحذية'),
  ('beauty', 'Beauty', 'تجميل'),
  ('electronics', 'Electronics', 'إلكترونيات'),
  ('home', 'Home', 'المنزل'),
  ('groceries', 'Groceries', 'بقالة'),
  ('restaurants', 'Restaurants', 'مطاعم'),
  ('cafes', 'Cafés', 'مقاهي'),
  ('health', 'Health', 'صحة'),
  ('kids', 'Kids', 'أطفال'),
  ('sports', 'Sports', 'رياضة'),
  ('services', 'Services', 'خدمات'),
  ('other', 'Other', 'أخرى');

INSERT INTO settings (key, value) VALUES
  ('ai_thresholds', '{"is_offer": 0.9, "price_or_discount": 0.8}'),
  ('freshness', '{"no_end_date_ask_day": 5, "no_end_date_hide_day": 7, "report_hide_count": 3}'),
  ('alerts', '{"max_per_day": 3}'),
  ('ranking_weights', '{"freshness": 1, "end_date_certainty": 0.5, "distance": 1, "discount": 0.7, "interest": 0.8, "boost": 1, "reports": 1}'),
  ('boost_prices', '{"3_days": null, "7_days": null}');
