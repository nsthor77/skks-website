-- ============================================================================
-- Sprint 11: Teacher Management + Subjects
-- ============================================================================
-- Multi-tenant via school_id. RLS policies inherited from existing pattern.
-- Created: 2026-05-27
-- ============================================================================

-- 1. Create teachers table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Identification
  employee_id text,                         -- รหัสพนักงาน เช่น 'EMP-001'
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'resigned', 'on_leave')),

  -- Names (Thai + English)
  first_name_th text,
  last_name_th  text,
  first_name_en text,
  last_name_en  text,
  nickname      text,
  title_th      text,                       -- 'ครู', 'อาจารย์', 'ดร.', 'นาย', 'นาง', 'นางสาว'
  title_en      text,                       -- 'Teacher', 'Mr.', 'Mrs.', 'Dr.'

  -- Personal info
  birth_date    date,
  gender        text CHECK (gender IS NULL OR gender IN ('male','female','other')),
  nationality   text DEFAULT 'Thai',
  national_id   text,
  phone         text,
  email         text,
  address       text,
  photo_url     text,

  -- Employment
  hire_date     date,
  resignation_date date,
  position      text,                       -- 'principal', 'vice_principal', 'homeroom_teacher', 'subject_teacher', 'assistant', 'admin'
  department    text,                       -- 'Mathematics', 'Languages', 'Science', 'Arts', 'Sports', 'Admin'
  salary_band   text,                       -- internal grading (optional)

  -- Qualifications
  highest_education text,                   -- 'Bachelor', 'Master', 'PhD', etc.
  major             text,                   -- e.g. 'Mathematics Education'
  university        text,
  teacher_license   text,                   -- ใบประกอบวิชาชีพครู (Thailand)

  -- Specialization
  subjects_taught text[],                   -- Quick array of subject names (also linked via teacher_subjects)
  grade_levels    text[],                   -- e.g. ['Grade 1','Grade 2','EP/1A']
  is_homeroom     boolean DEFAULT false,
  homeroom_class  text,                     -- e.g. 'EP/3A'

  -- Emergency
  emergency_name  text,
  emergency_phone text,
  emergency_relation text,

  -- Notes
  bio        text,                          -- ประวัติย่อ
  notes      text,
  custom_data jsonb DEFAULT '{}'::jsonb,    -- For per-school custom fields

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Unique per school
  UNIQUE (school_id, employee_id)
);

-- Defensive: ensure all columns exist (in case legacy teachers table predates this)
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS employee_id text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS first_name_th text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS last_name_th text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS first_name_en text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS last_name_en text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS title_th text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS title_en text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS birth_date date;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS nationality text DEFAULT 'Thai';
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS national_id text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS hire_date date;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS resignation_date date;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS salary_band text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS highest_education text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS major text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS university text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS teacher_license text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS subjects_taught text[];
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS grade_levels text[];
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS is_homeroom boolean DEFAULT false;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS homeroom_class text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS emergency_name text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS emergency_phone text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS emergency_relation text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS teachers_school_idx          ON public.teachers (school_id);
CREATE INDEX IF NOT EXISTS teachers_school_status_idx   ON public.teachers (school_id, status);
CREATE INDEX IF NOT EXISTS teachers_school_position_idx ON public.teachers (school_id, position);
CREATE INDEX IF NOT EXISTS teachers_first_name_th_idx   ON public.teachers (school_id, first_name_th);
CREATE INDEX IF NOT EXISTS teachers_homeroom_idx        ON public.teachers (school_id, homeroom_class) WHERE is_homeroom = true;
CREATE INDEX IF NOT EXISTS teachers_custom_data_idx     ON public.teachers USING gin (custom_data);

COMMENT ON TABLE public.teachers IS 'Sprint 11: Teacher records, multi-tenant';


-- 2. Create or extend subjects table (per school)
-- ============================================================================
-- If subjects table already exists from legacy schema, we just ADD missing columns.
CREATE TABLE IF NOT EXISTS public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  code text,
  name_th text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive: ensure all columns exist (works for legacy + new)
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS school_id    uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS code         text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS name_th      text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS name_en      text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS description  text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS department   text;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS credit_hours numeric(4,1);
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS is_active    boolean DEFAULT true;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS sort_order   int DEFAULT 100;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS created_at   timestamptz DEFAULT now();
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

-- Unique constraint (school_id, code) — drop old then add new safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE table_name = 'subjects' AND constraint_name = 'subjects_school_id_code_key') THEN
    -- already exists, skip
    NULL;
  ELSE
    BEGIN
      ALTER TABLE public.subjects ADD CONSTRAINT subjects_school_id_code_key UNIQUE (school_id, code);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- ignore if conflict
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS subjects_school_active_idx ON public.subjects (school_id, is_active, sort_order);

COMMENT ON TABLE public.subjects IS 'Sprint 11: Subjects taught at school (may also be used by legacy modules)';


-- 3. teacher_subjects (many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  grade_level text,                         -- which grade level (optional)
  academic_year text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (teacher_id, subject_id, grade_level, academic_year)
);

CREATE INDEX IF NOT EXISTS ts_school_idx  ON public.teacher_subjects (school_id);
CREATE INDEX IF NOT EXISTS ts_teacher_idx ON public.teacher_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS ts_subject_idx ON public.teacher_subjects (subject_id);


-- 4. Triggers for updated_at
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'teachers_set_updated_at') THEN
    CREATE TRIGGER teachers_set_updated_at
      BEFORE UPDATE ON public.teachers
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subjects_set_updated_at') THEN
    CREATE TRIGGER subjects_set_updated_at
      BEFORE UPDATE ON public.subjects
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 5. RLS — same-school staff can read; owner/dev can modify
-- ============================================================================
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

-- teachers
DROP POLICY IF EXISTS teachers_select_same_school ON public.teachers;
CREATE POLICY teachers_select_same_school ON public.teachers
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS teachers_modify_staff ON public.teachers;
CREATE POLICY teachers_modify_staff ON public.teachers
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- subjects
DROP POLICY IF EXISTS subjects_select_same_school ON public.subjects;
CREATE POLICY subjects_select_same_school ON public.subjects
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS subjects_modify_owner ON public.subjects;
CREATE POLICY subjects_modify_owner ON public.subjects
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_owner_or_developer())
  WITH CHECK (school_id = public.current_school_id() AND public.is_owner_or_developer());

-- teacher_subjects
DROP POLICY IF EXISTS ts_select_same_school ON public.teacher_subjects;
CREATE POLICY ts_select_same_school ON public.teacher_subjects
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS ts_modify_staff ON public.teacher_subjects;
CREATE POLICY ts_modify_staff ON public.teacher_subjects
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());


-- 6. RPC: get_teachers_paginated
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_teachers_paginated(
  p_search text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_department text DEFAULT NULL,
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
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.teachers t
  WHERE t.school_id = v_school_id
    AND (p_status IS NULL OR t.status = p_status)
    AND (p_position IS NULL OR t.position = p_position)
    AND (p_department IS NULL OR t.department ILIKE '%' || p_department || '%')
    AND (p_search IS NULL OR p_search = '' OR (
      COALESCE(t.first_name_th,'') || ' ' ||
      COALESCE(t.last_name_th,'') || ' ' ||
      COALESCE(t.first_name_en,'') || ' ' ||
      COALESCE(t.last_name_en,'') || ' ' ||
      COALESCE(t.nickname,'') || ' ' ||
      COALESCE(t.employee_id,'') || ' ' ||
      COALESCE(t.email,'')
    ) ILIKE '%' || p_search || '%');

  SELECT jsonb_agg(row_to_json(x)) INTO v_rows
  FROM (
    SELECT t.*
    FROM public.teachers t
    WHERE t.school_id = v_school_id
      AND (p_status IS NULL OR t.status = p_status)
      AND (p_position IS NULL OR t.position = p_position)
      AND (p_department IS NULL OR t.department ILIKE '%' || p_department || '%')
      AND (p_search IS NULL OR p_search = '' OR (
        COALESCE(t.first_name_th,'') || ' ' ||
        COALESCE(t.last_name_th,'') || ' ' ||
        COALESCE(t.first_name_en,'') || ' ' ||
        COALESCE(t.last_name_en,'') || ' ' ||
        COALESCE(t.nickname,'') || ' ' ||
        COALESCE(t.employee_id,'') || ' ' ||
        COALESCE(t.email,'')
      ) ILIKE '%' || p_search || '%')
    ORDER BY t.department NULLS LAST, t.last_name_th NULLS LAST, t.first_name_th NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) x;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset,
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teachers_paginated TO authenticated;


-- 7. RPC: get_teachers_stats
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_teachers_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_total int;
  v_active int;
  v_on_leave int;
  v_homeroom int;
  v_male int;
  v_female int;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  SELECT COUNT(*) INTO v_total      FROM public.teachers WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_active     FROM public.teachers WHERE school_id = v_school_id AND status = 'active';
  SELECT COUNT(*) INTO v_on_leave   FROM public.teachers WHERE school_id = v_school_id AND status = 'on_leave';
  SELECT COUNT(*) INTO v_homeroom   FROM public.teachers WHERE school_id = v_school_id AND is_homeroom = true AND status = 'active';
  SELECT COUNT(*) INTO v_male       FROM public.teachers WHERE school_id = v_school_id AND gender = 'male' AND status = 'active';
  SELECT COUNT(*) INTO v_female     FROM public.teachers WHERE school_id = v_school_id AND gender = 'female' AND status = 'active';

  RETURN jsonb_build_object(
    'total', v_total,
    'active', v_active,
    'on_leave', v_on_leave,
    'homeroom', v_homeroom,
    'male', v_male,
    'female', v_female
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teachers_stats TO authenticated;


-- 8. RPC: bulk_insert_teachers (CSV import)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_insert_teachers(p_rows jsonb)
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
  v_user_id := auth.uid();
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role NOT IN ('staff','owner','developer') THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN
    RETURN jsonb_build_object('error', 'no_school');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_idx := v_idx + 1;
    BEGIN
      INSERT INTO public.teachers (
        school_id, created_by, updated_by, status,
        employee_id, title_th, title_en,
        first_name_th, last_name_th, first_name_en, last_name_en, nickname,
        birth_date, gender, nationality,
        phone, email, address,
        hire_date, position, department,
        highest_education, major, university, teacher_license,
        homeroom_class, is_homeroom,
        emergency_name, emergency_phone, emergency_relation,
        bio, notes
      ) VALUES (
        v_school_id, v_user_id, v_user_id, COALESCE(v_row->>'status', 'active'),
        v_row->>'employee_id', v_row->>'title_th', v_row->>'title_en',
        v_row->>'first_name_th', v_row->>'last_name_th', v_row->>'first_name_en', v_row->>'last_name_en', v_row->>'nickname',
        (v_row->>'birth_date')::date, v_row->>'gender', COALESCE(v_row->>'nationality','Thai'),
        v_row->>'phone', v_row->>'email', v_row->>'address',
        (v_row->>'hire_date')::date, v_row->>'position', v_row->>'department',
        v_row->>'highest_education', v_row->>'major', v_row->>'university', v_row->>'teacher_license',
        v_row->>'homeroom_class', COALESCE((v_row->>'is_homeroom')::boolean, false),
        v_row->>'emergency_name', v_row->>'emergency_phone', v_row->>'emergency_relation',
        v_row->>'bio', v_row->>'notes'
      );
      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'duplicate employee_id');
      WHEN OTHERS THEN
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', SQLERRM);
    END;
  END LOOP;

  INSERT INTO public.audit_logs (action, metadata)
  VALUES ('teachers.bulk_insert', jsonb_build_object(
    'school_id', v_school_id, 'inserted', v_inserted, 'skipped', v_skipped
  ));

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped', v_skipped,
    'errors', v_errors
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_insert_teachers TO authenticated;


-- 9. Seed default subjects (Thai schools commonly use these)
-- ============================================================================
-- Will run only if school has 0 subjects.
-- Uncomment / customize per school if needed.
-- INSERT INTO public.subjects (school_id, code, name_th, name_en, department, sort_order)
-- SELECT '<your-school-id>', code, name_th, name_en, dept, sort_order
-- FROM (VALUES
--   ('TH',   'ภาษาไทย',     'Thai Language',     'Languages',  10),
--   ('ENG',  'ภาษาอังกฤษ',   'English',           'Languages',  20),
--   ('MATH', 'คณิตศาสตร์',   'Mathematics',       'Mathematics',30),
--   ('SCI',  'วิทยาศาสตร์',  'Science',           'Science',    40),
--   ('SOC',  'สังคมศึกษา',   'Social Studies',    'Social',     50),
--   ('ART',  'ศิลปะ',        'Art',               'Arts',       60),
--   ('MUS',  'ดนตรี',        'Music',             'Arts',       70),
--   ('PE',   'พลศึกษา',      'Physical Education','Sports',     80),
--   ('CMP',  'คอมพิวเตอร์',  'Computer',          'Technology', 90)
-- ) AS t(code, name_th, name_en, dept, sort_order)
-- WHERE NOT EXISTS (SELECT 1 FROM public.subjects WHERE school_id = '<your-school-id>');


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_teachers_stats();
-- SELECT public.get_teachers_paginated(NULL, NULL, NULL, NULL, 10, 0);
-- SELECT * FROM public.subjects LIMIT 10;
