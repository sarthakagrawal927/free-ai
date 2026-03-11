CREATE INDEX IF NOT EXISTS idx_gateway_requests_received_at
  ON gateway_requests (received_at);
