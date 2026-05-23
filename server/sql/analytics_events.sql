-- First-party analytics events (server-side inserts only via Service Role Key).
-- Run in the Supabase SQL Editor. Do not add public/authenticated RLS policies.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id
  ON public.analytics_events (visitor_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id
  ON public.analytics_events (session_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
  ON public.analytics_events (event_name);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);

-- RLS on with no policies: blocks anon/authenticated API access; service role bypasses RLS.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
