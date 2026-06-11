-- ============================================================================
-- Sprint LINE-1 + Slip-QR + File Uploads  (zero added platform cost)
-- ----------------------------------------------------------------------------
-- 1) LINE notifications: notification_log table + line_settings RPCs
--    (each school uses ITS OWN LINE OA channel token stored in
--     schools.line_settings — message quota belongs to the school, not us)
-- 2) Slip QR: payment_slips.qr_ref for free client-side duplicate detection
-- 3) Uploads: bucket → 10MB + PDF; students may upload homework submissions
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- ───────────────────────────── 1) LINE ─────────────────────────────────────

-- 1.1 notification_log (line-notify-sender.html already expects this)
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
-- a legacy notification_log already exists on prod with different columns —
-- add every column we need (no-op when present)
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS channel text DEFAULT 'line';
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS feature text;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS recipient_count int DEFAULT 0;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent';
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS error text;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
CREATE INDEX IF NOT EXISTS notif_log_school_idx ON public.notification_log (school_id, created_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notif_log_staff_read ON public.notification_log;
CREATE POLICY notif_log_staff_read ON public.notification_log
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());
-- inserts come from serverless endpoints using the service key (bypasses RLS)

-- 1.2 read line settings (owner/admin — token is sensitive)
CREATE OR REPLACE FUNCTION public.get_line_settings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF public.current_user_role() NOT IN ('staff','admin','owner','developer') THEN
    RETURN jsonb_build_object('error','คุณไม่มีสิทธิ์ดูการตั้งค่านี้');
  END IF;
  SELECT coalesce(line_settings, '{}'::jsonb) INTO v
  FROM public.schools WHERE id = public.current_school_id();
  RETURN coalesce(v, '{}'::jsonb);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', SQLERRM);
END $$;

-- 1.3 save line settings (merge — absent keys keep old values)
CREATE OR REPLACE FUNCTION public.save_line_settings(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF public.current_user_role() NOT IN ('staff','admin','owner','developer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'คุณไม่มีสิทธิ์แก้ไขการตั้งค่านี้');
  END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียนของคุณ'); END IF;

  UPDATE public.schools
  SET line_settings = coalesce(line_settings, '{}'::jsonb) || coalesce(p, '{}'::jsonb)
  WHERE id = sid;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;

-- 1.4 how many students already have a linked parent LINE
CREATE OR REPLACE FUNCTION public.count_line_linked()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int; v_linked int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE nullif(btrim(coalesce(custom_data->>'parent_line_user_id','')), '') IS NOT NULL)
  INTO v_total, v_linked
  FROM public.students
  WHERE school_id = public.current_school_id()
    AND coalesce(status, 'active') = 'active';
  RETURN jsonb_build_object('total', coalesce(v_total,0), 'linked', coalesce(v_linked,0));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('total', 0, 'linked', 0);
END $$;

GRANT EXECUTE ON FUNCTION public.get_line_settings()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_line_settings(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_line_linked()       TO authenticated;

-- ─────────────────────────── 2) Slip QR ────────────────────────────────────
ALTER TABLE public.payment_slips ADD COLUMN IF NOT EXISTS qr_ref text;
CREATE INDEX IF NOT EXISTS slips_qr_ref_idx ON public.payment_slips (school_id, qr_ref);

-- ─────────────────────────── 3) Uploads ────────────────────────────────────
-- 3.1 bucket: 10MB + allow PDF (was 3MB images-only)
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml',
      'application/pdf'
    ]
WHERE id = 'school-assets';

-- 3.2 students may upload ONLY into their school's homework-submissions folder
DROP POLICY IF EXISTS school_assets_student_submissions ON storage.objects;
CREATE POLICY school_assets_student_submissions ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'school-assets'
    AND (storage.foldername(name))[1] = public.current_school_id()::text
    AND (storage.foldername(name))[2] = 'homework-submissions'
  );

-- Verify:
--   SELECT public.get_line_settings();
--   SELECT public.count_line_linked();
--   SELECT file_size_limit, allowed_mime_types FROM storage.buckets WHERE id='school-assets';
