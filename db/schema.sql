-- Costa Blanca Connect — Full Database Schema
-- Run this against your Neon database to initialise all tables.

-- ─── Core auth & users ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username             VARCHAR(20)  UNIQUE NOT NULL,
  email                VARCHAR(255) UNIQUE,
  password_hash        TEXT         NOT NULL,
  role                 VARCHAR(20)  NOT NULL DEFAULT 'neighbor'
                         CHECK (role IN ('neighbor','business','hoa','admin','realtor')),
  name                 VARCHAR(255) NOT NULL,
  full_name            VARCHAR(255),
  initials             VARCHAR(2),
  avatar_hex           VARCHAR(7)   DEFAULT '#0077B6',
  avatar_url           TEXT,
  banner_url           TEXT,
  address              VARCHAR(500),
  bio                  TEXT         DEFAULT '',
  verified             BOOLEAN      DEFAULT FALSE,
  points               INTEGER      DEFAULT 0,
  years_in_neighborhood INTEGER     DEFAULT 0,
  is_owner             BOOLEAN      DEFAULT FALSE,
  managed_account      BOOLEAN      DEFAULT FALSE,
  -- business_id FK added after businesses table is created (below)
  business_id          UUID,
  contact_email        VARCHAR(255),
  contact_phone        VARCHAR(50),
  created_at           TIMESTAMPTZ  DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Posts ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                     VARCHAR(30)  NOT NULL DEFAULT 'general',
  section                  VARCHAR(30)  NOT NULL DEFAULT 'feed',
  content                  TEXT         NOT NULL,
  author_id                UUID         NOT NULL REFERENCES users(id),
  image_url                TEXT,
  location                 TEXT,
  -- safety post fields
  alert_type               VARCHAR(100),
  severity                 VARCHAR(20)  CHECK (severity IN ('low','medium','high','resolved')),
  is_official              BOOLEAN      DEFAULT FALSE,
  forwarded_to_decameron   BOOLEAN      DEFAULT FALSE,
  resolved_by_user_id      UUID         REFERENCES users(id),
  resolved_at              TIMESTAMPTZ,
  -- marketplace fields
  price                    DECIMAL(10,2),
  condition                VARCHAR(100),
  category                 VARCHAR(100),
  -- business post fields
  is_business_post         BOOLEAN      DEFAULT FALSE,
  business_id              UUID,
  -- hoa post fields
  is_hoa_post              BOOLEAN      DEFAULT FALSE,
  -- promotion fields
  offer_title              VARCHAR(255),
  offer_expiry             VARCHAR(255),
  -- poll (options stored as [{id,text}] — votes counted from poll_votes table)
  poll_options             JSONB,
  is_pinned                BOOLEAN      DEFAULT FALSE,
  created_at               TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_reactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL
                  CHECK (reaction_type IN ('like','insightful','agree','haha','wow','sad')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  option_id  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id)  ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Events ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  description  TEXT         DEFAULT '',
  host_id      UUID         NOT NULL REFERENCES users(id),
  location     VARCHAR(500),
  event_date   DATE         NOT NULL,
  event_time   VARCHAR(20),
  end_time     VARCHAR(20),
  category     VARCHAR(100) DEFAULT 'Community',
  is_hoa_event BOOLEAN      DEFAULT FALSE,
  image_url    TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     VARCHAR(10) NOT NULL CHECK (status IN ('going','maybe','cant_go')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, user_id)
);

-- ─── Businesses ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS businesses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  category            VARCHAR(100),
  description         TEXT         DEFAULT '',
  address             VARCHAR(500),
  phone               VARCHAR(50),
  hours               VARCHAR(255),
  website             VARCHAR(500),
  photos              JSONB        DEFAULT '[]',
  tags                JSONB        DEFAULT '[]',
  rating              DECIMAL(2,1) DEFAULT 0,
  review_count        INTEGER      DEFAULT 0,
  recommended_by      INTEGER      DEFAULT 0,
  claimed             BOOLEAN      DEFAULT FALSE,
  -- FK to users added after users table (circular); set below
  claimed_by_user_id  UUID,
  fave_threshold      INTEGER      DEFAULT 30,
  fave_years          JSONB        DEFAULT '[]',
  created_at          TIMESTAMPTZ  DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- Resolve circular FK
ALTER TABLE users      ADD CONSTRAINT fk_users_business      FOREIGN KEY (business_id)         REFERENCES businesses(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD CONSTRAINT fk_businesses_claimer  FOREIGN KEY (claimed_by_user_id)   REFERENCES users(id)      ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS business_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_id        UUID NOT NULL REFERENCES users(id),
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text             TEXT    NOT NULL,
  owner_reply_text TEXT,
  owner_reply_date TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_faves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID    NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID    NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (business_id, user_id, year)
);

-- ─── Marketplace ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  price       DECIMAL(10,2) DEFAULT 0,
  is_free     BOOLEAN      DEFAULT FALSE,
  condition   VARCHAR(100),
  category    VARCHAR(100),
  seller_id   UUID         NOT NULL REFERENCES users(id),
  description TEXT         DEFAULT '',
  image_url   TEXT,
  color       VARCHAR(7),
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── Real estate ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS real_estate_listings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              VARCHAR(20) NOT NULL CHECK (type IN ('for_sale','for_rent')),
  title             VARCHAR(255) NOT NULL,
  price             DECIMAL(12,2) NOT NULL,
  price_unit        VARCHAR(20),
  bedrooms          INTEGER      DEFAULT 0,
  bathrooms         INTEGER      DEFAULT 0,
  sqft              INTEGER      DEFAULT 0,
  description       TEXT         DEFAULT '',
  location          VARCHAR(500),
  image_url         TEXT,
  features          JSONB        DEFAULT '[]',
  agent_name        VARCHAR(255),
  agent_phone       VARCHAR(50),
  agent_email       VARCHAR(255),
  posted_by_user_id UUID         REFERENCES users(id),
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── Groups ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS groups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                VARCHAR(255) NOT NULL,
  description         TEXT         DEFAULT '',
  icon                VARCHAR(10)  DEFAULT '👥',
  category            VARCHAR(100) DEFAULT 'Community',
  privacy             VARCHAR(10)  NOT NULL DEFAULT 'public'
                        CHECK (privacy IN ('public','private')),
  cover_photo         TEXT,
  created_by_user_id  UUID         NOT NULL REFERENCES users(id),
  last_activity_at    TIMESTAMPTZ  DEFAULT NOW(),
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID    NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID    NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  is_admin   BOOLEAN DEFAULT FALSE,
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_join_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','approved','denied')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  pdf_url    TEXT,
  pdf_name   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  message    TEXT        NOT NULL,
  read       BOOLEAN     DEFAULT FALSE,
  avatar_hex VARCHAR(7),
  initials   VARCHAR(2),
  related_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Reports ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type           VARCHAR(20) NOT NULL
                          CHECK (target_type IN ('post','business','group','member')),
  target_id             TEXT        NOT NULL,
  target_label          TEXT,
  reason                TEXT        NOT NULL,
  note                  TEXT        DEFAULT '',
  reported_by_user_id   UUID        NOT NULL REFERENCES users(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','resolved','dismissed')),
  resolved_by_user_id   UUID        REFERENCES users(id),
  resolved_at           TIMESTAMPTZ,
  forwarded_to_decameron BOOLEAN    DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Moderation ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banned_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  username          VARCHAR(20),
  email             VARCHAR(255),
  name              VARCHAR(255),
  address           VARCHAR(500),
  avatar_hex        VARCHAR(7),
  initials          VARCHAR(2),
  original_role     VARCHAR(20),
  reason            TEXT,
  banned_by_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  banned_at         TIMESTAMPTZ DEFAULT NOW(),
  lifted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type          VARCHAR(50)  DEFAULT 'general',
  severity            VARCHAR(20)  DEFAULT 'medium',
  title               VARCHAR(255) NOT NULL,
  message             TEXT         NOT NULL,
  post_to_feed        BOOLEAN      DEFAULT FALSE,
  email_hoa           BOOLEAN      DEFAULT FALSE,
  sent_to             JSONB        DEFAULT '[]',
  email_status        VARCHAR(20)  DEFAULT 'not_sent',
  email_error         TEXT,
  created_by_user_id  UUID         REFERENCES users(id),
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── Registration & claims ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS access_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_villa   TEXT NOT NULL,
  status       VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new','dismissed')),
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pending_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username            VARCHAR(20) UNIQUE NOT NULL,
  email               VARCHAR(255),
  password_hash       TEXT        NOT NULL,
  role                VARCHAR(20) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  full_name           VARCHAR(255),
  address             VARCHAR(500),
  business_name       VARCHAR(255),
  business_category   VARCHAR(100),
  bio                 TEXT        DEFAULT '',
  avatar_hex          VARCHAR(7),
  initials            VARCHAR(2),
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected')),
  submitted_at        TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by_user_id UUID        REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS business_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID        NOT NULL REFERENCES businesses(id),
  claimant_name       VARCHAR(255) NOT NULL,
  email               VARCHAR(255) NOT NULL,
  phone               VARCHAR(50),
  role_at_business    VARCHAR(100) DEFAULT 'Owner',
  message             TEXT         DEFAULT '',
  status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','denied')),
  submitted_at        TIMESTAMPTZ  DEFAULT NOW(),
  reviewed_by_user_id UUID         REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  generated_username  VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_url        TEXT        NOT NULL,
  document_type       VARCHAR(50) NOT NULL DEFAULT 'other',
  note                TEXT        DEFAULT '',
  status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','denied')),
  reviewed_by_user_id UUID        REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Admin tools ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sponsored_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name       VARCHAR(255) NOT NULL,
  business_user_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  avatar_hex          VARCHAR(7),
  initials            VARCHAR(2),
  content             TEXT         NOT NULL,
  link_url            TEXT,
  link_label          VARCHAR(100) DEFAULT 'Learn More',
  image_url           TEXT,
  active              BOOLEAN      DEFAULT TRUE,
  created_by_user_id  UUID         NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hoa_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  name              VARCHAR(255),
  added_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Key/value store for app-level config (gmail creds, decameron email, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log for the gamification points system
CREATE TABLE IF NOT EXISTS points_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        VARCHAR(50) NOT NULL,
  points_earned INTEGER     NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Performance indexes ──────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sessions_token         ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires       ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_section          ON posts(section, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author           ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post    ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user    ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post          ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group    ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user     ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_posts_group      ON group_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event      ON event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_business_faves_biz     ON business_faves(business_id, year);
CREATE INDEX IF NOT EXISTS idx_prt_token              ON password_reset_tokens(token);
