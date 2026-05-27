-- ============================================================================
-- Sprint 11.5: Custom Fields for Teachers + Subjects helpers
-- ============================================================================
-- Mirrors student_field_definitions pattern.
-- Created: 2026-05-27
-- ============================================================================

-- 1. teacher_field_definitions table (per school)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teacher_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  field_key text NOT NULL,
  label_th  text NOT NULL,
  label_en  text,

  field_type text NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime',
    'select', 'multi_select', 'checkbox', 'phone', 'email', 'url'
  )),
  required boolean DEFAULT false,
  placeholder text,
  help_text text,
  options jsonb,
  default_value text,
  validation_regex text,
  min_value numeric,
  max_value numeric,
  max_length int,

  sort_order int DEFAULT 100,
  section text DEFAULT 'custom',
  is_active boolean DEFAULT true,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  UNIQUE (school_id, field_key)
);

CREATE INDEX IF NOT EXISTS tfd_school_active_idx
  ON public.teacher_field_definitions (school_id, is_active, sort_order);

COMMENT ON TABLE public.teacher_field_definitions IS
  'Sprint 11.5: Per-school custom field definitions for teacher records';


-- 2. Trigger for updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tfd_set_updated_at') THEN
    CREATE TRIGGER tfd_set_updated_at
      BEFORE UPDATE ON public.teacher_field_definitions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 3. RLS
-- ============================================================================
ALTER TABLE public.teacher_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tfd_select_same_school ON public.teacher_field_definitions;
CREATE POLICY tfd_select_same_school ON public.teacher_field_definitions
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS tfd_modify_owner ON public.teacher_field_definitions;
CREATE POLICY tfd_modify_owner ON public.teacher_field_definitions
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_owner_or_developer())
  WITH CHECK (school_id = public.current_school_id() AND public.is_owner_or_developer());


-- 4. RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_teacher_field_definitions(p_include_inactive boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.label_th) INTO v_rows
  FROM (
    SELECT * FROM public.teacher_field_definitions
    WHERE school_id = v_school_id
      AND (p_include_inactive OR is_active = true)
    ORDER BY sort_order, label_th
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teacher_field_definitions TO authenticated;


CREATE OR REPLACE FUNCTION public.upsert_teacher_field_definition(
  p_id uuid DEFAULT NULL,
  p_field_key text DEFAULT NULL,
  p_label_th text DEFAULT NULL,
  p_label_en text DEFAULT NULL,
  p_field_type text DEFAULT 'text',
  p_required boolean DEFAULT false,
  p_placeholder text DEFAULT NULL,
  p_help_text text DEFAULT NULL,
  p_options jsonb DEFAULT NULL,
  p_default_value text DEFAULT NULL,
  p_section text DEFAULT 'custom',
  p_sort_order int DEFAULT 100,
  p_is_active boolean DEFAULT true,
  p_max_length int DEFAULT NULL,
  p_min_value numeric DEFAULT NULL,
  p_max_value numeric DEFAULT NULL,
  p_validation_regex text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_school');
  END IF;

  IF p_field_key IS NULL OR p_field_key !~ '^[a-z][a-z0-9_]{0,49}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_field_key');
  END IF;

  IF p_label_th IS NULL OR TRIM(p_label_th) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'label_th_required');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.teacher_field_definitions (
      school_id, field_key, label_th, label_en, field_type, required, placeholder, help_text,
      options, default_value, section, sort_order, is_active,
      max_length, min_value, max_value, validation_regex, created_by
    ) VALUES (
      v_school_id, p_field_key, p_label_th, p_label_en, p_field_type, p_required, p_placeholder, p_help_text,
      p_options, p_default_value, p_section, p_sort_order, p_is_active,
      p_max_length, p_min_value, p_max_value, p_validation_regex, v_user_id
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.teacher_field_definitions SET
      field_key = p_field_key, label_th = p_label_th, label_en = p_label_en,
      field_type = p_field_type, required = p_required, placeholder = p_placeholder,
      help_text = p_help_text, options = p_options, default_value = p_default_value,
      section = p_section, sort_order = p_sort_order, is_active = p_is_active,
      max_length = p_max_length, min_value = p_min_value, max_value = p_max_value,
      validation_regex = p_validation_regex
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_field_key');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_teacher_field_definition TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_teacher_field_definition(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.teacher_field_definitions
  WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_teacher_field_definition TO authenticated;


-- 5. Subjects management RPCs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_subject(
  p_id uuid DEFAULT NULL,
  p_code text DEFAULT NULL,
  p_name_th text DEFAULT NULL,
  p_name_en text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_department text DEFAULT NULL,
  p_credit_hours numeric DEFAULT NULL,
  p_is_active boolean DEFAULT true,
  p_sort_order int DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_school');
  END IF;

  IF p_code IS NULL OR p_name_th IS NULL OR TRIM(p_code) = '' OR TRIM(p_name_th) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'code_and_name_required');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.subjects (
      school_id, code, name_th, name_en, description, department, credit_hours, is_active, sort_order
    ) VALUES (
      v_school_id, p_code, p_name_th, p_name_en, p_description, p_department, p_credit_hours, p_is_active, p_sort_order
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.subjects SET
      code = p_code, name_th = p_name_th, name_en = p_name_en,
      description = p_description, department = p_department,
      credit_hours = p_credit_hours, is_active = p_is_active, sort_order = p_sort_order
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_code');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_subject TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_subject(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.subjects WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_subject TO authenticated;


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_teacher_field_definitions();
