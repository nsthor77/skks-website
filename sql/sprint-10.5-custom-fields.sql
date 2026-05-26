-- ============================================================================
-- Sprint 10.5: Custom Fields for Students (per school)
-- ============================================================================
-- Each school can define their own additional fields beyond the baseline.
-- Examples: Passport No, Sport Type, Dietary Restrictions, etc.
--
-- Data stored in students.custom_data (jsonb)
-- Field definitions in student_field_definitions table
-- Created: 2026-05-26
-- ============================================================================

-- 1. Add custom_data column to students
-- ============================================================================
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS students_custom_data_idx
  ON public.students USING gin (custom_data);


-- 2. Create student_field_definitions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  -- Identification
  field_key text NOT NULL,                  -- 'passport_number' (machine-readable, used in custom_data)
  label_th  text NOT NULL,                  -- 'เลขที่ Passport'
  label_en  text,                           -- 'Passport Number'

  -- Field configuration
  field_type text NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime',
    'select', 'multi_select', 'checkbox', 'phone', 'email', 'url'
  )),
  required boolean DEFAULT false,
  placeholder text,
  help_text text,                           -- ข้อความช่วยอธิบาย field
  options jsonb,                            -- For select/multi_select: [{value:"halal",label_th:"ฮาลาล",label_en:"Halal"}]
  default_value text,
  validation_regex text,                    -- Optional regex pattern
  min_value numeric,                        -- For number fields
  max_value numeric,
  max_length int,                           -- For text/textarea

  -- Display
  sort_order int DEFAULT 100,
  section text DEFAULT 'custom',            -- Group fields: 'custom', 'medical', 'documents', etc.
  is_active boolean DEFAULT true,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Unique key per school
  UNIQUE (school_id, field_key)
);

CREATE INDEX IF NOT EXISTS sfd_school_active_idx
  ON public.student_field_definitions (school_id, is_active, sort_order);

COMMENT ON TABLE public.student_field_definitions IS
  'Sprint 10.5: Per-school custom field definitions for student records';


-- 3. Trigger for updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sfd_set_updated_at') THEN
    CREATE TRIGGER sfd_set_updated_at
      BEFORE UPDATE ON public.student_field_definitions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 4. RLS — only same school's staff can manage
-- ============================================================================
ALTER TABLE public.student_field_definitions ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user of the same school
DROP POLICY IF EXISTS sfd_select_same_school ON public.student_field_definitions;
CREATE POLICY sfd_select_same_school ON public.student_field_definitions
  FOR SELECT
  TO authenticated
  USING (school_id = public.current_school_id());

-- INSERT/UPDATE/DELETE: only owner/developer of same school
DROP POLICY IF EXISTS sfd_modify_owner ON public.student_field_definitions;
CREATE POLICY sfd_modify_owner ON public.student_field_definitions
  FOR ALL
  TO authenticated
  USING (
    school_id = public.current_school_id()
    AND public.is_owner_or_developer()
  )
  WITH CHECK (
    school_id = public.current_school_id()
    AND public.is_owner_or_developer()
  );


-- 5. RPC: get_student_field_definitions
-- Returns active fields for current school, sorted
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_student_field_definitions(p_include_inactive boolean DEFAULT false)
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
  IF v_school_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.label_th)
  INTO v_rows
  FROM (
    SELECT *
    FROM public.student_field_definitions
    WHERE school_id = v_school_id
      AND (p_include_inactive OR is_active = true)
    ORDER BY sort_order, label_th
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_field_definitions TO authenticated;


-- 6. RPC: upsert_student_field_definition
-- Create or update a field definition (owner/developer only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_student_field_definition(
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

  -- Validate field_key (machine-readable)
  IF p_field_key IS NULL OR p_field_key !~ '^[a-z][a-z0-9_]{0,49}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_field_key',
      'detail', 'field_key must be lowercase, start with letter, only a-z 0-9 _, max 50 chars');
  END IF;

  IF p_label_th IS NULL OR TRIM(p_label_th) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'label_th_required');
  END IF;

  IF p_id IS NULL THEN
    -- INSERT
    INSERT INTO public.student_field_definitions (
      school_id, field_key, label_th, label_en, field_type, required, placeholder, help_text,
      options, default_value, section, sort_order, is_active,
      max_length, min_value, max_value, validation_regex, created_by
    ) VALUES (
      v_school_id, p_field_key, p_label_th, p_label_en, p_field_type, p_required, p_placeholder, p_help_text,
      p_options, p_default_value, p_section, p_sort_order, p_is_active,
      p_max_length, p_min_value, p_max_value, p_validation_regex, v_user_id
    )
    RETURNING id INTO v_id;
  ELSE
    -- UPDATE (only same school)
    UPDATE public.student_field_definitions SET
      field_key = p_field_key,
      label_th = p_label_th,
      label_en = p_label_en,
      field_type = p_field_type,
      required = p_required,
      placeholder = p_placeholder,
      help_text = p_help_text,
      options = p_options,
      default_value = p_default_value,
      section = p_section,
      sort_order = p_sort_order,
      is_active = p_is_active,
      max_length = p_max_length,
      min_value = p_min_value,
      max_value = p_max_value,
      validation_regex = p_validation_regex
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'duplicate_field_key',
      'detail', 'field_key already exists for this school');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_student_field_definition TO authenticated;


-- 7. RPC: delete_student_field_definition
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_student_field_definition(p_id uuid)
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

  DELETE FROM public.student_field_definitions
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_field_definition TO authenticated;


-- 8. Sample fields for SKKS (optional — example seed)
-- Uncomment + edit if you want pre-populated fields for SKKS:
-- ============================================================================
-- INSERT INTO public.student_field_definitions
-- (school_id, field_key, label_th, label_en, field_type, required, sort_order, section)
-- VALUES
-- ('b410af1d-ea8b-43b9-9ca8-26c4b4b46e3b', 'religion', 'ศาสนา', 'Religion', 'select', false, 10, 'custom'),
-- ('b410af1d-ea8b-43b9-9ca8-26c4b4b46e3b', 'pickup_person', 'ผู้รับ-ส่ง', 'Pickup Person', 'text', false, 20, 'custom')
-- ON CONFLICT (school_id, field_key) DO NOTHING;


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_student_field_definitions();
-- SELECT * FROM public.student_field_definitions LIMIT 5;
