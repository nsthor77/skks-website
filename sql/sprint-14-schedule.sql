-- ============================================================================
-- Sprint 14: Class Schedule (Timetable)
-- ============================================================================
-- class_periods (per-school time period config)
-- schedule_slots (actual cell: classroom × day × period → subject + teacher + room)
-- RPCs: upsert_period, get_periods, upsert_slot, delete_slot, get_class_timetable,
--       get_teacher_timetable, get_my_timetable, check_slot_conflict
-- Defensive: works with legacy schema
-- Created: 2026-05-28
-- ============================================================================

-- 1. class_periods — per-school period definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.class_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  period_number int NOT NULL,        -- 1, 2, 3, ... (also includes "break"/"lunch" via is_break)
  label text,                        -- e.g. "Period 1", "Recess", "Lunch", "Homeroom"
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_break boolean DEFAULT false,    -- true = recess/lunch (not assignable)
  sort_order int DEFAULT 0,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Defensive ADD COLUMN (in case any legacy version exists)
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS period_number int;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS end_time time;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS is_break boolean DEFAULT false;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.class_periods ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.class_periods
      ADD CONSTRAINT class_periods_unique UNIQUE (school_id, period_number);
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS cp_school_idx ON public.class_periods (school_id, sort_order);

COMMENT ON TABLE public.class_periods IS 'Sprint 14: Per-school period definitions (cabbage 1 = 08:00-08:50 etc.)';


-- 2. schedule_slots — actual timetable cells
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,

  academic_year text NOT NULL,       -- '2569'
  term text NOT NULL,                -- '1', '2', '3', 'summer'
  classroom text NOT NULL,           -- 'EP/3A'
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Mon, 7=Sun
  period_number int NOT NULL,        -- references class_periods.period_number

  subject_code text,                 -- denormalized for fast filtering
  subject_name text,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  teacher_name text,                 -- denormalized for display
  room text,                         -- physical room e.g. 'Lab 1', 'อาคาร 3 ห้อง 301'
  notes text,
  color text,                        -- subject card color override (hex)

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Defensive ADD COLUMN
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS term text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS day_of_week int;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS period_number int;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS subject_code text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS subject_name text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS teacher_name text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- One subject per (classroom × day × period) within (year + term)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.schedule_slots
      ADD CONSTRAINT schedule_slots_class_unique UNIQUE (school_id, academic_year, term, classroom, day_of_week, period_number);
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN NULL;
  END;
END$$;

CREATE INDEX IF NOT EXISTS ss_school_year_term_idx ON public.schedule_slots (school_id, academic_year, term);
CREATE INDEX IF NOT EXISTS ss_classroom_idx ON public.schedule_slots (school_id, classroom, academic_year, term);
CREATE INDEX IF NOT EXISTS ss_teacher_idx ON public.schedule_slots (school_id, teacher_id, academic_year, term);
CREATE INDEX IF NOT EXISTS ss_day_period_idx ON public.schedule_slots (school_id, day_of_week, period_number, academic_year, term);

COMMENT ON TABLE public.schedule_slots IS 'Sprint 14: Class timetable cells (one per class+day+period)';


-- 3. Triggers
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cp_set_updated_at') THEN
    CREATE TRIGGER cp_set_updated_at BEFORE UPDATE ON public.class_periods
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ss_set_updated_at') THEN
    CREATE TRIGGER ss_set_updated_at BEFORE UPDATE ON public.schedule_slots
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;


-- 4. RLS
-- ============================================================================
ALTER TABLE public.class_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

-- class_periods: read all in school, modify owner only
DROP POLICY IF EXISTS cp_select_same_school ON public.class_periods;
CREATE POLICY cp_select_same_school ON public.class_periods
  FOR SELECT TO authenticated USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS cp_modify_owner ON public.class_periods;
CREATE POLICY cp_modify_owner ON public.class_periods
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_owner_or_developer())
  WITH CHECK (school_id = public.current_school_id() AND public.is_owner_or_developer());

-- schedule_slots: read all in school (so students can see their class), modify staff+
DROP POLICY IF EXISTS ss_select_same_school ON public.schedule_slots;
CREATE POLICY ss_select_same_school ON public.schedule_slots
  FOR SELECT TO authenticated USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS ss_modify_staff ON public.schedule_slots;
CREATE POLICY ss_modify_staff ON public.schedule_slots
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());


-- 5. RPC: upsert_period (owner only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_period(
  p_id uuid DEFAULT NULL,
  p_period_number int DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_is_break boolean DEFAULT false,
  p_sort_order int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  IF p_period_number IS NULL OR p_start_time IS NULL OR p_end_time IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_fields');
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.class_periods (school_id, period_number, label, start_time, end_time, is_break, sort_order)
    VALUES (v_school_id, p_period_number, p_label, p_start_time, p_end_time, p_is_break, p_sort_order)
    ON CONFLICT (school_id, period_number) DO UPDATE SET
      label = EXCLUDED.label,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      is_break = EXCLUDED.is_break,
      sort_order = EXCLUDED.sort_order,
      updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.class_periods SET
      period_number = p_period_number,
      label = p_label,
      start_time = p_start_time,
      end_time = p_end_time,
      is_break = p_is_break,
      sort_order = p_sort_order
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_period TO authenticated;


-- 6. RPC: delete_period
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_period(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_count int;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  DELETE FROM public.class_periods WHERE id = p_id AND school_id = v_school_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', v_count > 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_period TO authenticated;


-- 7. RPC: get_periods
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_periods()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.period_number) INTO v_rows
  FROM (
    SELECT * FROM public.class_periods
    WHERE school_id = v_school_id
    ORDER BY sort_order, period_number
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_periods TO authenticated;


-- 8. RPC: check_slot_conflict — preview conflicts before saving
-- ============================================================================
-- Returns array of conflicting slots (teacher double-booked, room double-booked)
CREATE OR REPLACE FUNCTION public.check_slot_conflict(
  p_academic_year text,
  p_term text,
  p_day_of_week int,
  p_period_number int,
  p_teacher_id uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_exclude_slot_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_conflicts jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('conflicts', '[]'::jsonb); END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_conflicts
  FROM (
    SELECT id, classroom, subject_code, subject_name, teacher_id, teacher_name, room,
           CASE
             WHEN p_teacher_id IS NOT NULL AND teacher_id = p_teacher_id THEN 'teacher'
             WHEN p_room IS NOT NULL AND room = p_room THEN 'room'
             ELSE 'unknown'
           END AS conflict_type
    FROM public.schedule_slots
    WHERE school_id = v_school_id
      AND academic_year = p_academic_year
      AND term = p_term
      AND day_of_week = p_day_of_week
      AND period_number = p_period_number
      AND (p_exclude_slot_id IS NULL OR id != p_exclude_slot_id)
      AND (
        (p_teacher_id IS NOT NULL AND teacher_id = p_teacher_id)
        OR (p_room IS NOT NULL AND p_room != '' AND room = p_room)
      )
  ) t;

  RETURN jsonb_build_object('conflicts', COALESCE(v_conflicts, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_slot_conflict TO authenticated;


-- 9. RPC: upsert_schedule_slot
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_schedule_slot(
  p_id uuid DEFAULT NULL,
  p_academic_year text DEFAULT NULL,
  p_term text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_day_of_week int DEFAULT NULL,
  p_period_number int DEFAULT NULL,
  p_subject_code text DEFAULT NULL,
  p_subject_name text DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_teacher_id uuid DEFAULT NULL,
  p_teacher_name text DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_allow_conflict boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_id uuid;
  v_conflict jsonb;
  v_conflicts_arr jsonb;
BEGIN
  v_user_id := auth.uid();
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  IF p_academic_year IS NULL OR p_term IS NULL OR p_classroom IS NULL
     OR p_day_of_week IS NULL OR p_period_number IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'missing_required_fields');
  END IF;

  -- Conflict check (unless caller opts out)
  IF NOT p_allow_conflict AND (p_teacher_id IS NOT NULL OR (p_room IS NOT NULL AND p_room != '')) THEN
    v_conflict := public.check_slot_conflict(
      p_academic_year, p_term, p_day_of_week, p_period_number,
      p_teacher_id, p_room, p_id
    );
    v_conflicts_arr := v_conflict->'conflicts';
    IF jsonb_array_length(v_conflicts_arr) > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'conflict', 'conflicts', v_conflicts_arr);
    END IF;
  END IF;

  -- Lookup teacher_name from teachers table if not provided
  IF p_teacher_id IS NOT NULL AND (p_teacher_name IS NULL OR p_teacher_name = '') THEN
    SELECT COALESCE(NULLIF(TRIM(first_name_th || ' ' || COALESCE(last_name_th, '')), ''),
                    NULLIF(TRIM(first_name_en || ' ' || COALESCE(last_name_en, '')), ''))
    INTO p_teacher_name
    FROM public.teachers WHERE id = p_teacher_id AND school_id = v_school_id;
  END IF;

  -- Lookup subject_name from subjects if not provided
  IF p_subject_id IS NOT NULL AND (p_subject_name IS NULL OR p_subject_name = '') THEN
    BEGIN
      SELECT COALESCE(name_th, name_en, name) INTO p_subject_name
      FROM public.subjects WHERE id = p_subject_id;
    EXCEPTION WHEN OTHERS THEN
      -- legacy subjects table may not have name_th — fallback below
      NULL;
    END;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.schedule_slots (
      school_id, academic_year, term, classroom, day_of_week, period_number,
      subject_code, subject_name, subject_id, teacher_id, teacher_name,
      room, notes, color, created_by
    ) VALUES (
      v_school_id, p_academic_year, p_term, p_classroom, p_day_of_week, p_period_number,
      p_subject_code, p_subject_name, p_subject_id, p_teacher_id, p_teacher_name,
      p_room, p_notes, p_color, v_user_id
    )
    ON CONFLICT (school_id, academic_year, term, classroom, day_of_week, period_number) DO UPDATE SET
      subject_code  = EXCLUDED.subject_code,
      subject_name  = EXCLUDED.subject_name,
      subject_id    = EXCLUDED.subject_id,
      teacher_id    = EXCLUDED.teacher_id,
      teacher_name  = EXCLUDED.teacher_name,
      room          = EXCLUDED.room,
      notes         = EXCLUDED.notes,
      color         = EXCLUDED.color,
      updated_at    = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.schedule_slots SET
      academic_year = p_academic_year,
      term = p_term,
      classroom = p_classroom,
      day_of_week = p_day_of_week,
      period_number = p_period_number,
      subject_code = p_subject_code,
      subject_name = p_subject_name,
      subject_id = p_subject_id,
      teacher_id = p_teacher_id,
      teacher_name = p_teacher_name,
      room = p_room,
      notes = p_notes,
      color = p_color
    WHERE id = p_id AND school_id = v_school_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_schedule_slot TO authenticated;


-- 10. RPC: delete_schedule_slot
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_schedule_slot(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_count int;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  DELETE FROM public.schedule_slots WHERE id = p_id AND school_id = v_school_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', v_count > 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_schedule_slot TO authenticated;


-- 11. RPC: get_class_timetable — all slots for a class
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_class_timetable(
  p_classroom text,
  p_academic_year text,
  p_term text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_slots jsonb;
  v_periods jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error', 'no_school_context'); END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_slots
  FROM (
    SELECT id, academic_year, term, classroom, day_of_week, period_number,
           subject_code, subject_name, subject_id, teacher_id, teacher_name,
           room, notes, color
    FROM public.schedule_slots
    WHERE school_id = v_school_id
      AND classroom = p_classroom
      AND academic_year = p_academic_year
      AND term = p_term
    ORDER BY day_of_week, period_number
  ) t;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.period_number) INTO v_periods
  FROM (
    SELECT * FROM public.class_periods
    WHERE school_id = v_school_id
    ORDER BY sort_order, period_number
  ) t;

  RETURN jsonb_build_object(
    'classroom', p_classroom,
    'academic_year', p_academic_year,
    'term', p_term,
    'periods', COALESCE(v_periods, '[]'::jsonb),
    'slots', COALESCE(v_slots, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_class_timetable TO authenticated;


-- 12. RPC: get_teacher_timetable — all slots a teacher teaches
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_teacher_timetable(
  p_teacher_id uuid,
  p_academic_year text,
  p_term text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_slots jsonb;
  v_periods jsonb;
  v_teacher jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error', 'no_school_context'); END IF;

  SELECT to_jsonb(t.*) INTO v_teacher FROM public.teachers t WHERE t.id = p_teacher_id AND t.school_id = v_school_id;

  SELECT jsonb_agg(row_to_json(t)) INTO v_slots
  FROM (
    SELECT id, classroom, day_of_week, period_number,
           subject_code, subject_name, room, notes, color
    FROM public.schedule_slots
    WHERE school_id = v_school_id
      AND teacher_id = p_teacher_id
      AND academic_year = p_academic_year
      AND term = p_term
    ORDER BY day_of_week, period_number
  ) t;

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.sort_order, t.period_number) INTO v_periods
  FROM (
    SELECT * FROM public.class_periods
    WHERE school_id = v_school_id
    ORDER BY sort_order, period_number
  ) t;

  RETURN jsonb_build_object(
    'teacher', v_teacher,
    'academic_year', p_academic_year,
    'term', p_term,
    'periods', COALESCE(v_periods, '[]'::jsonb),
    'slots', COALESCE(v_slots, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_teacher_timetable TO authenticated;


-- 13. RPC: get_my_timetable — student/parent view (auto-detect classroom)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_timetable(
  p_student_id uuid DEFAULT NULL,
  p_academic_year text DEFAULT NULL,
  p_term text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_user_id uuid;
  v_classroom text;
  v_target_student uuid;
BEGIN
  v_user_id := auth.uid();
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error', 'no_school_context'); END IF;

  -- Resolve student
  IF p_student_id IS NULL THEN
    SELECT id INTO v_target_student FROM public.students
    WHERE profile_id = v_user_id AND school_id = v_school_id LIMIT 1;
  ELSE
    IF p_student_id = ANY(public.my_student_ids()) OR public.is_staff_or_higher() THEN
      v_target_student := p_student_id;
    ELSE
      SELECT id INTO v_target_student FROM public.students
      WHERE id = p_student_id AND profile_id = v_user_id;
    END IF;
  END IF;

  IF v_target_student IS NULL THEN RETURN jsonb_build_object('error', 'no_student'); END IF;

  SELECT classroom INTO v_classroom FROM public.students WHERE id = v_target_student;
  IF v_classroom IS NULL THEN RETURN jsonb_build_object('error', 'no_classroom_assigned'); END IF;

  RETURN public.get_class_timetable(
    v_classroom,
    COALESCE(p_academic_year, to_char(EXTRACT(YEAR FROM now())::int + 543, 'FM0000')),
    COALESCE(p_term, '1')
  ) || jsonb_build_object('student_id', v_target_student, 'classroom', v_classroom);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_timetable TO authenticated;


-- 14. RPC: bulk_upsert_periods — seed all periods at once (template helper)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_upsert_periods(p_periods jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_count int := 0;
  v_result jsonb;
BEGIN
  IF NOT public.is_owner_or_developer() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_periods)
  LOOP
    v_result := public.upsert_period(
      NULL,
      (v_row->>'period_number')::int,
      v_row->>'label',
      (v_row->>'start_time')::time,
      (v_row->>'end_time')::time,
      COALESCE((v_row->>'is_break')::boolean, false),
      COALESCE((v_row->>'sort_order')::int, 0)
    );
    IF v_result->>'success' = 'true' THEN v_count := v_count + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'saved', v_count);
END;
$$;
GRANT EXECUTE ON FUNCTION public.bulk_upsert_periods TO authenticated;


-- ============================================================================
-- Verify
-- ============================================================================
-- Default period template (8 periods, 50min each, Thai standard):
-- SELECT public.bulk_upsert_periods('[
--   {"period_number":1, "label":"คาบ 1", "start_time":"08:30", "end_time":"09:20", "sort_order":10},
--   {"period_number":2, "label":"คาบ 2", "start_time":"09:20", "end_time":"10:10", "sort_order":20},
--   {"period_number":3, "label":"พักเช้า", "start_time":"10:10", "end_time":"10:25", "is_break":true, "sort_order":30},
--   {"period_number":4, "label":"คาบ 3", "start_time":"10:25", "end_time":"11:15", "sort_order":40},
--   {"period_number":5, "label":"คาบ 4", "start_time":"11:15", "end_time":"12:05", "sort_order":50},
--   {"period_number":6, "label":"พักกลางวัน", "start_time":"12:05", "end_time":"13:00", "is_break":true, "sort_order":60},
--   {"period_number":7, "label":"คาบ 5", "start_time":"13:00", "end_time":"13:50", "sort_order":70},
--   {"period_number":8, "label":"คาบ 6", "start_time":"13:50", "end_time":"14:40", "sort_order":80},
--   {"period_number":9, "label":"คาบ 7", "start_time":"14:40", "end_time":"15:30", "sort_order":90}
-- ]'::jsonb);
--
-- SELECT public.get_periods();
-- SELECT public.get_class_timetable('EP/3A', '2569', '1');
-- SELECT public.get_my_timetable();
