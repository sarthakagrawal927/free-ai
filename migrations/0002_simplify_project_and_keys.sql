PRAGMA foreign_keys = OFF;

CREATE TABLE key_requests_new (
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
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_notes TEXT,
  source_ip_hash TEXT,
  user_agent_hash TEXT
);

INSERT INTO key_requests_new (
  request_id,
  name,
  email,
  company,
  use_case,
  intended_use,
  expected_daily_requests,
  status,
  requested_at,
  reviewed_at,
  reviewed_by,
  review_notes,
  source_ip_hash,
  user_agent_hash
)
SELECT
  request_id,
  name,
  email,
  company,
  use_case,
  intended_use,
  expected_daily_requests,
  status,
  requested_at,
  reviewed_at,
  reviewed_by,
  review_notes,
  source_ip_hash,
  user_agent_hash
FROM key_requests;

DROP TABLE key_requests;
ALTER TABLE key_requests_new RENAME TO key_requests;

CREATE INDEX idx_key_requests_status_requested_at
  ON key_requests(status, requested_at DESC);
CREATE INDEX idx_key_requests_email
  ON key_requests(email);

CREATE TABLE api_keys_new (
  key_hash TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  issued_at TEXT NOT NULL,
  last_used_at TEXT
);

INSERT INTO api_keys_new (
  key_hash,
  status,
  issued_at,
  last_used_at
)
SELECT
  key_hash,
  CASE WHEN status = 'revoked' THEN 'revoked' ELSE 'active' END,
  COALESCE(issued_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at
FROM api_keys;

DROP TABLE api_keys;
ALTER TABLE api_keys_new RENAME TO api_keys;

CREATE INDEX idx_api_keys_status
  ON api_keys(status);

CREATE TABLE gateway_requests_new (
  request_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('chat.completions', 'responses')),
  project_id TEXT,
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

INSERT INTO gateway_requests_new (
  request_id,
  received_at,
  endpoint,
  project_id,
  reasoning_effort,
  stream,
  prompt_chars,
  message_count,
  status_code,
  outcome,
  chosen_provider,
  chosen_model,
  attempts,
  error_type,
  latency_ms
)
SELECT
  request_id,
  received_at,
  endpoint,
  project_id,
  reasoning_effort,
  stream,
  prompt_chars,
  message_count,
  status_code,
  outcome,
  chosen_provider,
  chosen_model,
  attempts,
  error_type,
  latency_ms
FROM gateway_requests;

DROP TABLE gateway_requests;
ALTER TABLE gateway_requests_new RENAME TO gateway_requests;

CREATE INDEX idx_gateway_requests_project_time
  ON gateway_requests(project_id, received_at DESC);
CREATE INDEX idx_gateway_requests_provider_time
  ON gateway_requests(chosen_provider, received_at DESC);

CREATE TABLE project_daily_usage_new (
  project_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  total_requests INTEGER NOT NULL DEFAULT 0,
  ok_requests INTEGER NOT NULL DEFAULT 0,
  error_requests INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, usage_date)
);

INSERT INTO project_daily_usage_new (
  project_id,
  usage_date,
  total_requests,
  ok_requests,
  error_requests,
  total_attempts,
  updated_at
)
SELECT
  project_id,
  usage_date,
  total_requests,
  ok_requests,
  error_requests,
  total_attempts,
  updated_at
FROM project_daily_usage;

DROP TABLE project_daily_usage;
ALTER TABLE project_daily_usage_new RENAME TO project_daily_usage;

DROP TABLE IF EXISTS projects;

PRAGMA foreign_keys = ON;
