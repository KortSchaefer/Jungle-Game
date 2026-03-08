CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leaderboard_stats (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  prestige_count INTEGER NOT NULL DEFAULT 0,
  pip BIGINT NOT NULL DEFAULT 0,
  total_bananas_earned NUMERIC(40, 0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  client_version TEXT NOT NULL DEFAULT 'unknown',
  last_session_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submission_log (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted BOOLEAN NOT NULL,
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_sort
  ON leaderboard_stats (prestige_count DESC, pip DESC, total_bananas_earned DESC, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_submission_log_player_time
  ON submission_log (player_id, received_at DESC);
