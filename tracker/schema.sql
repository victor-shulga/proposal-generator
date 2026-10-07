CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  label TEXT,
  url TEXT,
  crm_company_id TEXT,
  created_ts INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipients (
  proposal_id TEXT NOT NULL,
  token TEXT NOT NULL,
  name TEXT NOT NULL,
  created_ts INTEGER NOT NULL,
  PRIMARY KEY (proposal_id, token)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id TEXT NOT NULL,
  recipient TEXT NOT NULL DEFAULT '',
  visitor TEXT NOT NULL,
  session TEXT NOT NULL,
  type TEXT NOT NULL,          -- open | slide | cta | close
  slide INTEGER,
  label TEXT,                  -- data-track name of the slide or button
  ms INTEGER NOT NULL DEFAULT 0,
  country TEXT,
  ua TEXT,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS events_pr ON events (proposal_id, recipient, ts);

CREATE TABLE IF NOT EXISTS alerts (
  proposal_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_prk ON alerts (proposal_id, recipient, kind, ts);

-- added 2026-10-07; on an existing DB run: ALTER TABLE proposals ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
