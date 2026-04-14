CREATE TABLE IF NOT EXISTS project_analytics (
  project_id TEXT NOT NULL,
  date TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, date, provider, model)
);

CREATE INDEX IF NOT EXISTS idx_project_analytics_project
  ON project_analytics (project_id);
