PRAGMA foreign_keys = OFF;

CREATE TABLE gateway_requests_new (
  request_id TEXT PRIMARY KEY,
  received_at TEXT NOT NULL,
  endpoint TEXT NOT NULL CHECK (endpoint IN ('chat.completions', 'responses', 'embeddings')),
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

PRAGMA foreign_keys = ON;
