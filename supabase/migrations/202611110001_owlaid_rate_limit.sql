-- OwlAid AI usage quota. Apply manually in Supabase SQL Editor after reviewing.
-- Isolated and non-destructive: adds one table and one SECURITY DEFINER RPC for per-user AI rate limiting.
begin;

CREATE TABLE IF NOT EXISTS public.owlaid_usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  minute_window timestamptz NOT NULL DEFAULT pg_catalog.now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0 AND minute_count <= 10),
  day_window date NOT NULL DEFAULT (pg_catalog.timezone('utc', pg_catalog.now())::date),
  day_count integer NOT NULL DEFAULT 0 CHECK (day_count >= 0 AND day_count <= 80)
);

ALTER TABLE public.owlaid_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.owlaid_usage FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.owlaid_take_quota(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  is_allowed boolean;
  now_ts timestamptz := pg_catalog.now();
  now_utc date := pg_catalog.timezone('utc', now_ts)::date;
BEGIN
  IF p_user_id IS NULL OR NOT private.is_approved_user(p_user_id) THEN
    RETURN false;
  END IF;

  INSERT INTO public.owlaid_usage (user_id, minute_window, minute_count, day_window, day_count)
  VALUES (p_user_id, now_ts, 1, now_utc, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    minute_count = CASE
      WHEN public.owlaid_usage.minute_window <= now_ts - interval '1 minute' THEN 1
      ELSE public.owlaid_usage.minute_count + 1 END,
    minute_window = CASE
      WHEN public.owlaid_usage.minute_window <= now_ts - interval '1 minute' THEN now_ts
      ELSE public.owlaid_usage.minute_window END,
    day_count = CASE
      WHEN public.owlaid_usage.day_window <> now_utc THEN 1
      ELSE public.owlaid_usage.day_count + 1 END,
    day_window = now_utc
  WHERE (public.owlaid_usage.minute_window <= now_ts - interval '1 minute' OR public.owlaid_usage.minute_count < 10)
    AND (public.owlaid_usage.day_window <> now_utc OR public.owlaid_usage.day_count < 80)
  RETURNING true INTO is_allowed;

  RETURN COALESCE(is_allowed, false);
END;
$$;

REVOKE ALL ON FUNCTION public.owlaid_take_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owlaid_take_quota(uuid) TO service_role;

commit;
