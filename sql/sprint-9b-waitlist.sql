-- ============================================================================
-- Sprint 9.B: Waitlist + Early Access
-- ============================================================================
-- Purpose: Collect leads before launch (Student/Teacher/Attendance/LINE features ยังไม่พร้อม)
-- Created: 2026-05-26
-- ============================================================================

-- 1. Create waitlist table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  school_name text,
  school_size text CHECK (school_size IN ('small', 'medium', 'large', 'unknown')),
  contact_name text,
  phone text,
  notes text,
  source text DEFAULT 'marketing',  -- marketing | cold-email | referral | facebook | line
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'converted', 'rejected')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  contacted_at timestamptz,
  converted_at timestamptz,
  converted_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL
);

-- Email is required + lowercase normalized
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_unique_idx ON public.waitlist (LOWER(email));
CREATE INDEX IF NOT EXISTS waitlist_created_at_idx ON public.waitlist (created_at DESC);
CREATE INDEX IF NOT EXISTS waitlist_status_idx ON public.waitlist (status);

COMMENT ON TABLE public.waitlist IS 'Sprint 9.B: Early-access waitlist signups before public launch';

-- 2. RLS — only service role + developer can read
-- ============================================================================
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (via API endpoint with service_role, but also keeps direct safe)
DROP POLICY IF EXISTS waitlist_insert_public ON public.waitlist;
CREATE POLICY waitlist_insert_public ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only developer can SELECT/UPDATE/DELETE
DROP POLICY IF EXISTS waitlist_admin_all ON public.waitlist;
CREATE POLICY waitlist_admin_all ON public.waitlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'developer'
    )
  );

-- 3. RPC: join_waitlist (called from public API)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_waitlist(
  p_email text,
  p_school_name text DEFAULT NULL,
  p_school_size text DEFAULT 'unknown',
  p_contact_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_source text DEFAULT 'marketing'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing_id uuid;
  v_normalized_email text;
BEGIN
  -- Validate email format (basic)
  IF p_email IS NULL OR p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_email');
  END IF;

  v_normalized_email := LOWER(TRIM(p_email));

  -- Check if already exists
  SELECT id INTO v_existing_id
  FROM public.waitlist
  WHERE LOWER(email) = v_normalized_email
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'id', v_existing_id);
  END IF;

  -- Insert
  INSERT INTO public.waitlist (
    email, school_name, school_size, contact_name, phone, notes, source
  ) VALUES (
    v_normalized_email,
    NULLIF(TRIM(p_school_name), ''),
    COALESCE(p_school_size, 'unknown'),
    NULLIF(TRIM(p_contact_name), ''),
    NULLIF(TRIM(p_phone), ''),
    NULLIF(TRIM(p_notes), ''),
    COALESCE(p_source, 'marketing')
  )
  RETURNING id INTO v_id;

  -- Log to audit_logs (uses real schema: action + metadata)
  INSERT INTO public.audit_logs (action, metadata)
  VALUES (
    'waitlist.joined',
    jsonb_build_object(
      'email', v_normalized_email,
      'school_name', p_school_name,
      'source', p_source,
      'waitlist_id', v_id
    )
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'id', v_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist TO anon, authenticated;

COMMENT ON FUNCTION public.join_waitlist IS 'Sprint 9.B: Public RPC to add email to waitlist with dedup';

-- 4. RPC: get_waitlist_stats (admin only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_waitlist_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_total int;
  v_pending int;
  v_contacted int;
  v_converted int;
  v_last_7d int;
BEGIN
  -- Only developer
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'developer' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.waitlist;
  SELECT COUNT(*) INTO v_pending FROM public.waitlist WHERE status = 'pending';
  SELECT COUNT(*) INTO v_contacted FROM public.waitlist WHERE status = 'contacted';
  SELECT COUNT(*) INTO v_converted FROM public.waitlist WHERE status = 'converted';
  SELECT COUNT(*) INTO v_last_7d FROM public.waitlist WHERE created_at >= now() - interval '7 days';

  RETURN jsonb_build_object(
    'total', v_total,
    'pending', v_pending,
    'contacted', v_contacted,
    'converted', v_converted,
    'last_7_days', v_last_7d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_stats TO authenticated;

-- 5. Verify
-- ============================================================================
-- SELECT * FROM public.waitlist LIMIT 5;
-- SELECT public.join_waitlist('test@example.com', 'โรงเรียนทดสอบ', 'small');
-- SELECT public.get_waitlist_stats();
