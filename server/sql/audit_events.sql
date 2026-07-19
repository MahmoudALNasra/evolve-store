-- Durable activity / audit log (server-side inserts only via Service Role Key).
-- Run in the Supabase SQL Editor, or: npm run setup:audit
-- Do not add public/authenticated RLS policies.

CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  actor_email TEXT,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  before_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  request_method TEXT,
  request_path TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON public.audit_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id
  ON public.audit_events (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_action
  ON public.audit_events (action);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON public.audit_events (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor_type
  ON public.audit_events (actor_type);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
