-- ============================================================================
-- Sprint 10: Student Management — Add missing columns + indexes + RPCs
-- ============================================================================
-- Adds Thai/English name columns, parent contacts, photo, etc. to students.
-- Idempotent: safe to run multiple times.
-- Created: 2026-05-26
-- ============================================================================

-- 1. Add columns (IF NOT EXISTS makes it idempotent)
-- ============================================================================

-- Names (Thai + English)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS first_name_th text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_name_th  text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS first_name_en text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_name_en  text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nickname      text;

-- Personal info
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS birth_date    date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender        text CHECK (gender IS NULL OR gender IN ('male','female','other'));
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nationality   text DEFAULT 'Thai';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS religion      text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS blood_type    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS national_id   text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address       text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url     text;

-- Academic info
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS graduation_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS academic_year  text;

-- Parent / Guardian (#1)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent1_name     text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent1_phone    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent1_email    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent1_relation text; -- 'father', 'mother', 'guardian', etc.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent1_occupation text;

-- Parent / Guardian (#2)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent2_name     text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent2_phone    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent2_email    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent2_relation text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent2_occupation text;

-- Emergency contact
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS emergency_name     text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS emergency_phone    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS emergency_relation text;

-- Medical / Notes
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS allergies         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS medical_conditions text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS medications       text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS notes             text;

-- Metadata
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- 2. Indexes for filtering / search
-- ============================================================================
CREATE INDEX IF NOT EXISTS students_school_status_idx ON public.students (school_id, status);
CREATE INDEX IF NOT EXISTS students_school_grade_idx  ON public.students (school_id, grade);
CREATE INDEX IF NOT EXISTS students_school_classroom_idx ON public.students (school_id, classroom);
CREATE INDEX IF NOT EXISTS students_school_created_idx ON public.students (school_id, created_at DESC);

-- Simple B-tree indexes for name search (ILIKE 'prefix%' uses these)
CREATE INDEX IF NOT EXISTS students_first_name_th_idx ON public.students (school_id, first_name_th);
CREATE INDEX IF NOT EXISTS students_last_name_th_idx  ON public.students (school_id, last_name_th);
CREATE INDEX IF NOT EXISTS students_student_number_idx ON public.students (school_id, student_number);

-- Note: For LIKE '%middle%' searches on very large tables, you can later add pg_trgm:
--   CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
--   then add GIN trigram index. Skipped here because pg_trgm may not be enabled.


-- 3. Auto-update trigger for updated_at (if not already exists)
-- ============================================================================
-- Check if trigger exists, create if not
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'students_set_updated_at'
  ) THEN
    CREATE TRIGGER students_set_updated_at
      BEFORE UPDATE ON public.students
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 4. RPC: get_students_paginated — server-side pagination + search
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_students_paginated(
  p_search text DEFAULT NULL,
  p_program text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_rows jsonb;
BEGIN
  -- Get current user's school
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  -- Count total matching
  SELECT COUNT(*) INTO v_total
  FROM public.students s
  WHERE s.school_id = v_school_id
    AND (p_status IS NULL OR s.status = p_status)
    AND (p_program IS NULL OR s.program = p_program)
    AND (p_grade IS NULL OR s.grade ILIKE '%' || p_grade || '%')
    AND (p_classroom IS NULL OR s.classroom ILIKE '%' || p_classroom || '%')
    AND (p_search IS NULL OR p_search = '' OR (
      COALESCE(s.first_name_th,'') || ' ' ||
      COALESCE(s.last_name_th,'') || ' ' ||
      COALESCE(s.first_name_en,'') || ' ' ||
      COALESCE(s.last_name_en,'') || ' ' ||
      COALESCE(s.nickname,'') || ' ' ||
      COALESCE(s.student_number,'')
    ) ILIKE '%' || p_search || '%');

  -- Fetch page
  SELECT jsonb_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT s.*
    FROM public.students s
    WHERE s.school_id = v_school_id
      AND (p_status IS NULL OR s.status = p_status)
      AND (p_program IS NULL OR s.program = p_program)
      AND (p_grade IS NULL OR s.grade ILIKE '%' || p_grade || '%')
      AND (p_classroom IS NULL OR s.classroom ILIKE '%' || p_classroom || '%')
      AND (p_search IS NULL OR p_search = '' OR (
        COALESCE(s.first_name_th,'') || ' ' ||
        COALESCE(s.last_name_th,'') || ' ' ||
        COALESCE(s.first_name_en,'') || ' ' ||
        COALESCE(s.last_name_en,'') || ' ' ||
        COALESCE(s.nickname,'') || ' ' ||
        COALESCE(s.student_number,'')
      ) ILIKE '%' || p_search || '%')
    ORDER BY s.classroom NULLS LAST, s.student_number NULLS LAST, s.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_students_paginated TO authenticated;


-- 5. RPC: bulk_insert_students — used by CSV import
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_insert_students(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_role text;
  v_row jsonb;
  v_inserted int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_idx int := 0;
BEGIN
  -- Verify caller is staff or higher
  v_user_id := auth.uid();
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role NOT IN ('staff','owner','developer') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  -- Loop through input rows
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      INSERT INTO public.students (
        school_id, created_by, updated_by, status,
        student_number,
        first_name_th, last_name_th, first_name_en, last_name_en, nickname,
        birth_date, gender, nationality,
        phone, email, address,
        program, grade, classroom, enrollment_date, academic_year,
        parent1_name, parent1_phone, parent1_email, parent1_relation,
        parent2_name, parent2_phone, parent2_email, parent2_relation,
        emergency_name, emergency_phone, emergency_relation,
        allergies, medical_conditions, notes
      ) VALUES (
        v_school_id, v_user_id, v_user_id, COALESCE(v_row->>'status', 'active'),
        v_row->>'student_number',
        v_row->>'first_name_th', v_row->>'last_name_th', v_row->>'first_name_en', v_row->>'last_name_en', v_row->>'nickname',
        (v_row->>'birth_date')::date, v_row->>'gender', COALESCE(v_row->>'nationality','Thai'),
        v_row->>'phone', v_row->>'email', v_row->>'address',
        v_row->>'program', v_row->>'grade', v_row->>'classroom',
        (v_row->>'enrollment_date')::date, v_row->>'academic_year',
        v_row->>'parent1_name', v_row->>'parent1_phone', v_row->>'parent1_email', v_row->>'parent1_relation',
        v_row->>'parent2_name', v_row->>'parent2_phone', v_row->>'parent2_email', v_row->>'parent2_relation',
        v_row->>'emergency_name', v_row->>'emergency_phone', v_row->>'emergency_relation',
        v_row->>'allergies', v_row->>'medical_conditions', v_row->>'notes'
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'duplicate student_number', 'student_number', v_row->>'student_number');
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', SQLERRM);
    END;
  END LOOP;

  -- Log to audit
  INSERT INTO public.audit_logs (action, metadata)
  VALUES ('students.bulk_insert', jsonb_build_object(
    'school_id', v_school_id,
    'inserted', v_inserted,
    'skipped', v_skipped
  ));

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_insert_students TO authenticated;


-- 6. RPC: get_students_stats — header counts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_students_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_active int;
  v_inactive int;
  v_graduated int;
  v_male int;
  v_female int;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  SELECT COUNT(*) INTO v_total FROM public.students WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_active FROM public.students WHERE school_id = v_school_id AND status = 'active';
  SELECT COUNT(*) INTO v_inactive FROM public.students WHERE school_id = v_school_id AND status = 'inactive';
  SELECT COUNT(*) INTO v_graduated FROM public.students WHERE school_id = v_school_id AND status = 'graduated';
  SELECT COUNT(*) INTO v_male FROM public.students WHERE school_id = v_school_id AND gender = 'male' AND status = 'active';
  SELECT COUNT(*) INTO v_female FROM public.students WHERE school_id = v_school_id AND gender = 'female' AND status = 'active';

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'inactive', v_inactive,
    'graduated', v_graduated,
    'male', v_male,
    'female', v_female
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_students_stats TO authenticated;


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_students_stats();
-- SELECT public.get_students_paginated(NULL, NULL, NULL, NULL, NULL, 10, 0);
