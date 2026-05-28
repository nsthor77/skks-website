-- ============================================================================
-- Sprint 20: Learning Materials (สื่อการสอน/ไฟล์เรียน)
-- ============================================================================
-- Teacher/staff share learning materials (links: Google Drive / YouTube / PDF /
-- docs) targeted to a classroom (or grade, or whole school).
-- Students/parents browse + open materials for their classroom.
-- Link-based (url) → no Storage bucket setup needed. Created: 2026-05-28
-- ============================================================================

-- 1. Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.learning_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  title text NOT NULL,
  description text,
  subject text,
  classroom text,                            -- target classroom (NULL = all in grade/school)
  grade text,
  academic_year text,

  material_type text NOT NULL DEFAULT 'link', -- link / video / document / file / other
  url text,                                   -- external link (Drive / YouTube / PDF...)

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS classroom text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS grade text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS material_type text DEFAULT 'link';
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.learning_materials ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS lm_school_classroom_idx ON public.learning_materials (school_id, classroom, created_at);
CREATE INDEX IF NOT EXISTS lm_creator_idx ON public.learning_materials (created_by);

COMMENT ON TABLE public.learning_materials IS 'Sprint 20: learning materials (links) shared by staff to a classroom/grade';

-- 2. updated_at trigger
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'lm_set_updated_at') THEN
    CREATE TRIGGER lm_set_updated_at BEFORE UPDATE ON public.learning_materials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 3. RLS
-- ============================================================================
ALTER TABLE public.learning_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_select_staff ON public.learning_materials;
CREATE POLICY lm_select_staff ON public.learning_materials
  FOR SELECT TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher());

DROP POLICY IF EXISTS lm_select_own ON public.learning_materials;
CREATE POLICY lm_select_own ON public.learning_materials
  FOR SELECT TO authenticated
  USING (
    school_id = public.current_school_id()
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = auth.uid())
        AND (learning_materials.classroom IS NULL OR s.classroom = learning_materials.classroom)
        AND (learning_materials.grade IS NULL OR s.grade = learning_materials.grade)
    )
  );

DROP POLICY IF EXISTS lm_modify_staff ON public.learning_materials;
CREATE POLICY lm_modify_staff ON public.learning_materials
  FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

-- 4. RPC: create_material (staff/teacher)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_material(
  p_title text,
  p_url text,
  p_material_type text DEFAULT 'link',
  p_description text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL,
  p_academic_year text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'no_school'); END IF;
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_title');
  END IF;

  INSERT INTO public.learning_materials
    (school_id, created_by, title, description, subject, classroom, grade, academic_year, material_type, url)
  VALUES
    (v_school_id, auth.uid(), btrim(p_title), p_description,
     NULLIF(btrim(COALESCE(p_subject,'')),''), NULLIF(btrim(COALESCE(p_classroom,'')),''),
     NULLIF(btrim(COALESCE(p_grade,'')),''), p_academic_year,
     COALESCE(NULLIF(btrim(COALESCE(p_material_type,'')),''),'link'), NULLIF(btrim(COALESCE(p_url,'')),''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_material TO authenticated;

-- 5. RPC: update_material (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_material(
  p_id uuid,
  p_title text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_material_type text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_classroom text DEFAULT NULL,
  p_grade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();

  UPDATE public.learning_materials SET
    title         = COALESCE(NULLIF(btrim(COALESCE(p_title,'')),''), title),
    url           = COALESCE(p_url, url),
    material_type = COALESCE(NULLIF(p_material_type,''), material_type),
    description   = COALESCE(p_description, description),
    subject       = COALESCE(p_subject, subject),
    classroom     = COALESCE(p_classroom, classroom),
    grade         = COALESCE(p_grade, grade)
  WHERE id = p_id AND school_id = v_school_id;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_material TO authenticated;

-- 6. RPC: delete_material (staff)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_material(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_school_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;
  v_school_id := public.current_school_id();
  DELETE FROM public.learning_materials WHERE id = p_id AND school_id = v_school_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_material TO authenticated;

-- 7. RPC: get_materials (role-aware)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_materials(
  p_classroom text DEFAULT NULL,
  p_subject text DEFAULT NULL,
  p_mine boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school_id uuid;
  v_uid uuid;
  v_staff boolean;
  v_rows jsonb;
BEGIN
  v_school_id := public.current_school_id();
  IF v_school_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  v_uid := auth.uid();
  v_staff := public.is_staff_or_higher();

  SELECT jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC) INTO v_rows
  FROM (
    SELECT lm.*,
           COALESCE(pr.display_name, 'ครู') AS creator_name
    FROM public.learning_materials lm
    LEFT JOIN public.profiles pr ON pr.id = lm.created_by
    WHERE lm.school_id = v_school_id
      AND (p_classroom IS NULL OR lm.classroom = p_classroom)
      AND (p_subject IS NULL OR lm.subject = p_subject)
      AND (NOT p_mine OR lm.created_by = v_uid)
      AND (
        v_staff
        OR EXISTS (
          SELECT 1 FROM public.students s
          WHERE (s.id = ANY(public.my_student_ids()) OR s.profile_id = v_uid)
            AND (lm.classroom IS NULL OR s.classroom = lm.classroom)
            AND (lm.grade IS NULL OR s.grade = lm.grade)
        )
      )
    ORDER BY lm.created_at DESC
  ) t;

  RETURN COALESCE(v_rows, '[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_materials TO authenticated;

-- ============================================================================
-- Verify
-- ============================================================================
-- SELECT public.create_material('ใบงานบทที่ 3','https://drive.google.com/...','document','สรุปเนื้อหา','คณิตศาสตร์','ป.6/1','ป.6','2569');
-- SELECT public.get_materials(NULL, NULL, false);
