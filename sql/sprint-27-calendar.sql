-- ============================================================================
-- Sprint 27: Academic Calendar (ปฏิทินการศึกษา)
-- ============================================================================
-- School-wide calendar: holidays, exams, activities, important dates.
-- Everyone in the school can view; staff manage. Created: 2026-05-28
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  category text DEFAULT 'event',             -- holiday / exam / activity / important / event
  event_date date NOT NULL,
  end_date date,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cev_school_date_idx ON public.calendar_events (school_id, event_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='cev_set_updated_at') THEN
    CREATE TRIGGER cev_set_updated_at BEFORE UPDATE ON public.calendar_events
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cev_select_all ON public.calendar_events;
CREATE POLICY cev_select_all ON public.calendar_events FOR SELECT TO authenticated
  USING (school_id = public.current_school_id());

DROP POLICY IF EXISTS cev_modify_staff ON public.calendar_events;
CREATE POLICY cev_modify_staff ON public.calendar_events FOR ALL TO authenticated
  USING (school_id = public.current_school_id() AND public.is_staff_or_higher())
  WITH CHECK (school_id = public.current_school_id() AND public.is_staff_or_higher());

CREATE OR REPLACE FUNCTION public.save_calendar_event(
  p_id uuid, p_title text, p_event_date date, p_category text DEFAULT 'event',
  p_end_date date DEFAULT NULL, p_description text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_id uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  v_school := public.current_school_id();
  IF p_title IS NULL OR length(btrim(p_title))=0 THEN RETURN jsonb_build_object('success',false,'error','no_title'); END IF;
  IF p_event_date IS NULL THEN RETURN jsonb_build_object('success',false,'error','no_date'); END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.calendar_events (school_id, created_by, title, category, event_date, end_date, description)
    VALUES (v_school, auth.uid(), btrim(p_title), COALESCE(NULLIF(p_category,''),'event'), p_event_date, p_end_date, p_description)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.calendar_events SET title=btrim(p_title), category=COALESCE(NULLIF(p_category,''),category),
      event_date=p_event_date, end_date=p_end_date, description=p_description
    WHERE id=p_id AND school_id=v_school RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  END IF;
  RETURN jsonb_build_object('success',true,'id',v_id);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END;
$$;
GRANT EXECUTE ON FUNCTION public.save_calendar_event TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_calendar_event(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('success',false,'error','forbidden'); END IF;
  v_school := public.current_school_id();
  DELETE FROM public.calendar_events WHERE id=p_id AND school_id=v_school;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not_found'); END IF;
  RETURN jsonb_build_object('success',true);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'error',SQLERRM); END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event TO authenticated;

CREATE OR REPLACE FUNCTION public.get_calendar_events(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school uuid; v_rows jsonb;
BEGIN
  v_school := public.current_school_id();
  IF v_school IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT jsonb_agg(row_to_json(t) ORDER BY t.event_date) INTO v_rows FROM (
    SELECT c.* FROM public.calendar_events c
    WHERE c.school_id = v_school
      AND (p_from IS NULL OR c.event_date >= p_from)
      AND (p_to IS NULL OR c.event_date <= p_to)
  ) t;
  RETURN COALESCE(v_rows,'[]'::jsonb);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_calendar_events TO authenticated;

-- Verify:
-- SELECT public.save_calendar_event(NULL,'วันปิดเทอม','2569-10-01','holiday','2569-10-31',NULL);
-- SELECT public.get_calendar_events(NULL,NULL);
