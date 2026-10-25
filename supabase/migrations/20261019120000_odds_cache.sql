-- Create odds cache table for multi-provider failover strategy
CREATE TABLE IF NOT EXISTS odds_cache (
  id BIGSERIAL PRIMARY KEY,
  match_id TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl INTEGER NOT NULL, -- Time to live in seconds
  expires_at TIMESTAMPTZ NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on match_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_odds_cache_match_id ON odds_cache(match_id);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_odds_cache_expires_at ON odds_cache(expires_at);

-- Create index on is_live for live vs prematch queries
CREATE INDEX IF NOT EXISTS idx_odds_cache_is_live ON odds_cache(is_live);

-- Enable RLS
ALTER TABLE odds_cache ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage cache
CREATE POLICY "Service role full access to odds_cache"
  ON odds_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_odds_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER odds_cache_updated_at_trigger
  BEFORE UPDATE ON odds_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_odds_cache_updated_at();

-- Create function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_odds_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM odds_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
