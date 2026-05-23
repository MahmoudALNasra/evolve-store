-- Add UTM attribution columns to analytics_events (run once in Supabase SQL Editor).

ALTER TABLE public.analytics_events
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_events_utm_source
  ON public.analytics_events (utm_source)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_utm_campaign
  ON public.analytics_events (utm_campaign)
  WHERE utm_campaign IS NOT NULL;
