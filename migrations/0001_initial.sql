PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  owner_email TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS key_requests (
  request_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  use_case TEXT NOT NULL,
  intended_use TEXT NOT NULL CHECK (intended_use IN ('personal', 'internal', 'production')),
  expected_daily_requests INTEGER CHECK (
    expected_daily_requests IS NULL OR (expected_daily_requests BETWEEN 1 AND 200000)
  ),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'approved', 'rejected')),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  source_ip_hash TEXT,
  user_agent_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_key_requests_status_requested_at
  ON key_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_key_requests_email
  ON key_requests(email);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  key_suffix TEXT NOT NULL,
  label TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  request_id TEXT REFERENCES key_requests(request_id) ON DELETE SET NULL,
  access_tier TEXT NOT NULL DEFAULT 'standard' CHECK (access_tier IN ('standard', 'max')),
  scopes_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_by TEXT NOT NULL DEFAULT 'operator',
  issued_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_status
  ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_project
  ON api_keys(project_id);

CREATE TABLE IF NOT EXISTS gateway_requests (
  request_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('chat.completions', 'responses')),
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  reasoning_effort TEXT NOT NULL CHECK (reasoning_effort IN ('auto', 'low', 'medium', 'high')),
  stream INTEGER NOT NULL CHECK (stream IN (0, 1)),
  prompt_chars INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok', 'error')),
  chosen_provider TEXT,
  chosen_model TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  error_type TEXT,
  latency_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_gateway_requests_project_time
  ON gateway_requests(project_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_gateway_requests_provider_time
  ON gateway_requests(chosen_provider, received_at DESC);

CREATE TABLE IF NOT EXISTS project_daily_usage (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  ok_requests INTEGER NOT NULL DEFAULT 0,
  error_requests INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, usage_date)
);
