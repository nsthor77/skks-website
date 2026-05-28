-- ============================================================================
-- Sprint 14.6: Multi-Teacher per Slot (Co-Teaching) + Student Count
-- ============================================================================
-- Thai bilingual schools (EP/IP) commonly have 1 foreign + 2 Thai teachers
-- co-teaching the same period. This adds flexible multi-teacher support.
--
-- - teacher_ids uuid[]  → fast conflict queries (array overlap)
-- - teachers jsonb      → display metadata [{teacher_id, teacher_name, role}]
-- - Backward compatible: teacher_id/teacher_name = lead (first) teacher
-- - Rewrites check_slot_conflict + upsert_schedule_slot for arrays
-- - Adds student_count to get_class_timetable
-- Created: 2026-05-28
-- ============================================================================

-- 1. Add columns (defensive)
-- ============================================================================
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS teacher_ids uuid[] DEFAULT '{}';
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS teachers jsonb DEFAULT '[]'::jsonb;

-- 2. Backfill from existing single teacher_id (only rows not yet migrated)
-- ============================================================================
UPDATE public.schedule_slots
SET teacher_ids = ARRAY[teacher_id]
WHERE teacher_id IS NOT NULL
  AND (teacher_ids IS NULL OR teacher_ids = '{}');

UPDATE public.schedule_slots
SET teachers = jsonb_build_array(
      jsonb_build_object(
        'teacher_id', teacher_id,
        'teacher_name', COALESCE(teacher_name, ''),
        'role', 'lead'
      )
    )
WHERE teacher_id IS NOT NULL
  AND (teachers IS NULL OR teachers = '[]'::jsonb);

-- 3. GIN index for fast array-overlap conflict lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS ss_teacher_ids_gin ON public.schedule_slots USING GIN (teacher_ids);


-- 4. RPC: check_slot_conflict (rewritten for teacher ARRAY)
-- ============================================================================
-- A teacher conflicts if they appear in ANY slot at the same day+period+year+term
-- in a DIFFERENT classroom. Co-teaching in the SAME classroom is fine.
DROP FUNCTION IF EXISTS public.check_slot_conflict(text, text, int, int, uuid, text, uuid);
CREATE OR REPLACE FUNCTION public.check_slot_conflict(
  p_academic_year text,
  p_term text,
  p_day_of_week int,
  p_period_number int,
  p_teacher_ids uuid[] DEFAULT '{}',
  p_room text DEFAULT NULL,
  p_classroom text DEFAULT NULL,            -- current classroom (exclude same-room co-teaching)
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
    SELECT id, classroom, subject_code, subject_name, teachers, room,
           CASE
             WHEN p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids,1) > 0
                  AND teacher_ids && p_teacher_ids
                  AND classroom IS DISTINCT FROM p_classroom
               THEN 'teacher'
             WHEN p_room IS NOT NULL AND p_room <> '' AND room = p_room
                  AND classroom IS DISTINCT FROM p_classroom
               THEN 'room'
             ELSE 'unknown'
           END AS conflict_type,
           -- which teacher(s) overlap
           (SELECT jsonb_agg(elem)
              FROM jsonb_array_elements(teachers) elem
             WHERE (elem->>'teacher_id')::uuid = ANY(p_teacher_ids)) AS overlap_teachers
    FROM public.schedule_slots
    WHERE school_id = v_school_id
      AND academic_year = p_academic_year
      AND term = p_term
      AND day_of_week = p_day_of_week
      AND period_number = p_period_number
      AND (p_exclude_slot_id IS NULL OR id <> p_exclude_slot_id)
      AND classroom IS DISTINCT FROM p_classroom   -- different room only
      AND (
        (p_teacher_ids IS NOT NULL AND array_length(p_teacher_ids,1) > 0 AND teacher_ids && p_teacher_ids)
        OR (p_room IS NOT NULL AND p_room <> '' AND room = p_room)
      )
  ) t;

  RETURN jsonb_build_object('conflicts', COALESCE(v_conflicts, '[]'::jsonb));
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_slot_conflict TO authenticated;


-- 5. RPC: upsert_schedule_slot (rewritten to accept p_teachers jsonb array)
-- ============================================================================
-- p_teachers = [{"teacher_id":"uuid","teacher_name":"...","role":"lead|thai|foreign|assistant|co"}]
DROP FUNCTION IF EXISTS public.upsert_schedule_slot(uuid, text, text, text, int, int, text, text, uuid, uuid, text, text, text, text, boolean);
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
  p_teachers jsonb DEFAULT '[]'::jsonb,      -- NEW: array of teacher objects
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
  v_teacher_ids uuid[];
  v_lead_id uuid;
  v_lead_name text;
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

  -- Extract teacher_ids array from jsonb
  SELECT array_agg((elem->>'teacher_id')::uuid)
  INTO v_teacher_ids
  FROM jsonb_array_elements(COALESCE(p_teachers, '[]'::jsonb)) elem
  WHERE elem->>'teacher_id' IS NOT NULL AND elem->>'teacher_id' <> '';

  v_teacher_ids := COALESCE(v_teacher_ids, '{}');

  -- Lead teacher = first in array (backward-compat single columns)
  v_lead_id := (p_teachers->0->>'teacher_id')::uuid;
  v_lead_name := p_teachers->0->>'teacher_name';

  -- Conflict check (unless caller opts out)
  IF NOT p_allow_conflict AND (array_length(v_teacher_ids,1) > 0 OR (p_room IS NOT NULL AND p_room <> '')) THEN
    v_conflict := public.check_slot_conflict(
      p_academic_year, p_term, p_day_of_week, p_period_number,
      v_teacher_ids, p_room, p_classroom, p_id
    );
    v_conflicts_arr := v_conflict->'conflicts';
    IF jsonb_array_length(v_conflicts_arr) > 0 THEN
      RETURN jsonb_build_object('success', false, 'error', 'conflict', 'conflicts', v_conflicts_arr);
    END IF;
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.schedule_slots (
      school_id, academic_year, term, classroom, day_of_week, period_number,
      subject_code, subject_name, subject_id,
      teacher_id, teacher_name, teacher_ids, teachers,
      room, notes, color, created_by
    ) VALUES (
      v_school_id, p_academic_year, p_term, p_classroom, p_day_of_week, p_period_number,
      p_subject_code, p_subject_name, p_subject_id,
      v_lead_id, v_lead_name, v_teacher_ids, COALESCE(p_teachers, '[]'::jsonb),
      p_room, p_notes, p_color, v_user_id
    )
    ON CONFLICT (school_id, academic_year, term, classroom, day_of_week, period_number) DO UPDATE SET
      subject_code  = EXCLUDED.subject_code,
      subject_name  = EXCLUDED.subject_name,
      subject_id    = EXCLUDED.subject_id,
      teacher_id    = EXCLUDED.teacher_id,
      teacher_name  = EXCLUDED.teacher_name,
      teacher_ids   = EXCLUDED.teacher_ids,
      teachers      = EXCLUDED.teachers,
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
      teacher_id = v_lead_id,
      teacher_name = v_lead_name,
      teacher_ids = v_teacher_ids,
      teachers = COALESCE(p_teachers, '[]'::jsonb),
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


-- 6. RPC: get_class_timetable (add student_count + teachers already in slots)
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
  v_student_count int;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('error', 'no_school_context'); END IF;

  SELECT jsonb_agg(row_to_json(t)) INTO v_slots
  FROM (
    SELECT id, academic_year, term, classroom, day_of_week, period_number,
           subject_code, subject_name, subject_id,
           teacher_id, teacher_name, teacher_ids, teachers,
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

  -- Student count for this classroom (data-aware)
  SELECT COUNT(*) INTO v_student_count
  FROM public.students
  WHERE school_id = v_school_id AND classroom = p_classroom AND status = 'active';

  RETURN jsonb_build_object(
    'classroom', p_classroom,
    'academic_year', p_academic_year,
    'term', p_term,
    'student_count', COALESCE(v_student_count, 0),
    'periods', COALESCE(v_periods, '[]'::jsonb),
    'slots', COALESCE(v_slots, '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_class_timetable TO authenticated;


-- 7. RPC: get_teacher_timetable (include teachers jsonb for co-teaching display)
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

  -- Match slots where teacher is ANY of the assigned teachers (co-teaching aware)
  SELECT jsonb_agg(row_to_json(t)) INTO v_slots
  FROM (
    SELECT id, classroom, day_of_week, period_number,
           subject_code, subject_name, teachers, room, notes, color
    FROM public.schedule_slots
    WHERE school_id = v_school_id
      AND academic_year = p_academic_year
      AND term = p_term
      AND (teacher_id = p_teacher_id OR p_teacher_id = ANY(teacher_ids))
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


-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.get_class_timetable('EP/2A', '2569', '1');   -- now returns student_count
-- SELECT public.check_slot_conflict('2569','1',1,1, ARRAY['<teacher-uuid>']::uuid[], NULL, 'EP/2B', NULL);
