-- ============================================================================
-- Tier 3 — Monthly summary report for the principal (ผอ.)
--   1) get_monthly_report(p_year, p_month) → jsonb summary (staff+)
--   2) ensure_principal_link_code()        → owner-only LINE link code
--   3) unlink_principals()                 → owner-only, clear linked ผอ. LINE ids
--
-- LINE ids of linked principals live in schools.line_settings (jsonb):
--   { ..., "principal_link_code": "AB12CD",
--          "principal_line_user_ids": ["U...","U..."] }   (max 5)
--
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- ───────────────── 1) Monthly report (staff+) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_monthly_report(p_year int, p_month int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid;
  d_from date; d_to date;
  v_school_days int := 0; v_checked int := 0;
  v_present int := 0; v_absent int := 0; v_late int := 0; v_leave int := 0;
  v_rate numeric := NULL;
  v_top_absent jsonb := '[]'::jsonb;
  v_paid numeric := 0; v_unpaid_total numeric := 0; v_unpaid_count int := 0;
  v_students_total int := 0; v_students_new int := 0;
  v_hw_assigned int := 0; v_hw_graded int := 0;
  v_beh_neg int := 0; v_beh_minus numeric := 0;
BEGIN
  IF NOT public.is_staff_or_higher() THEN RETURN jsonb_build_object('error','no_permission'); END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN RETURN jsonb_build_object('error','no_school'); END IF;
  IF p_year IS NULL OR p_month IS NULL OR p_month < 1 OR p_month > 12
     OR p_year < 2000 OR p_year > 2200 THEN
    RETURN jsonb_build_object('error','เดือน/ปีไม่ถูกต้อง');
  END IF;

  d_from := make_date(p_year, p_month, 1);
  d_to   := (d_from + interval '1 month')::date;

  -- attendance in month (same status buckets as get_today_summary)
  BEGIN
    SELECT count(DISTINCT a.attendance_date),
           count(*),
           count(*) FILTER (WHERE a.status IN ('present','late','half_day_am','half_day_pm')),
           count(*) FILTER (WHERE a.status = 'absent'),
           count(*) FILTER (WHERE a.status = 'late'),
           count(*) FILTER (WHERE a.status = 'leave')
    INTO v_school_days, v_checked, v_present, v_absent, v_late, v_leave
    FROM public.attendance a
    WHERE a.school_id = sid
      AND a.attendance_date >= d_from AND a.attendance_date < d_to;

    IF v_checked > 0 THEN
      v_rate := round(v_present::numeric * 100 / v_checked, 1);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- top 5 absent students in month
  BEGIN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'name', coalesce(s.first_name_th, s.first_name_en, '') || ' ' || coalesce(s.last_name_th, s.last_name_en, ''),
             'classroom', s.classroom,
             'absent_count', t.cnt
           ) ORDER BY t.cnt DESC), '[]'::jsonb)
    INTO v_top_absent
    FROM (
      SELECT a.student_id, count(*) AS cnt
      FROM public.attendance a
      WHERE a.school_id = sid AND a.status = 'absent'
        AND a.attendance_date >= d_from AND a.attendance_date < d_to
      GROUP BY a.student_id
      ORDER BY count(*) DESC
      LIMIT 5
    ) t
    JOIN public.students s ON s.id = t.student_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- money received in month (join through students for tenant scope)
  BEGIN
    SELECT coalesce(sum(p.amount), 0) INTO v_paid
    FROM public.payments p
    JOIN public.students s ON s.id = p.student_id AND s.school_id = sid
    WHERE p.status = 'completed'
      AND p.payment_date >= d_from AND p.payment_date < d_to;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- unpaid bills (current snapshot, not month-scoped)
  BEGIN
    SELECT coalesce(sum(b.amount), 0), count(*)
    INTO v_unpaid_total, v_unpaid_count
    FROM public.bills b
    JOIN public.students s ON s.id = b.student_id AND s.school_id = sid
    WHERE b.status IN ('unpaid','overdue');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- students: active total + new in month
  BEGIN
    SELECT count(*),
           count(*) FILTER (WHERE s.created_at >= d_from AND s.created_at < d_to)
    INTO v_students_total, v_students_new
    FROM public.students s
    WHERE s.school_id = sid AND coalesce(s.status,'active') = 'active';
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- homework: assigned in month + graded (status 'done') in month
  BEGIN
    SELECT count(*) INTO v_hw_assigned
    FROM public.homework_assignments ha
    WHERE ha.school_id = sid
      AND ha.assigned_date >= d_from AND ha.assigned_date < d_to;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    SELECT count(*) INTO v_hw_graded
    FROM public.homework_submissions hs
    WHERE hs.school_id = sid AND hs.status = 'done'
      AND hs.updated_at >= d_from AND hs.updated_at < d_to;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- behavior: negative records + total minus points in month
  BEGIN
    SELECT count(*), coalesce(abs(sum(b.delta)), 0)
    INTO v_beh_neg, v_beh_minus
    FROM public.behavior_records b
    WHERE b.school_id = sid AND b.delta < 0
      AND b.occurred_date >= d_from AND b.occurred_date < d_to;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object(
    'year', p_year,
    'month', p_month,
    'attendance', jsonb_build_object(
      'school_days', v_school_days, 'checked', v_checked,
      'present', v_present, 'absent', v_absent, 'late', v_late, 'leave', v_leave,
      'attendance_rate', v_rate
    ),
    'top_absent', v_top_absent,
    'money', jsonb_build_object(
      'paid_total', v_paid, 'unpaid_total', v_unpaid_total, 'unpaid_count', v_unpaid_count
    ),
    'students', jsonb_build_object(
      'total_active', v_students_total, 'new_this_month', v_students_new
    ),
    'homework', jsonb_build_object(
      'assigned', v_hw_assigned, 'graded', v_hw_graded
    ),
    'behavior', jsonb_build_object(
      'negative_records', v_beh_neg, 'minus_points', v_beh_minus
    )
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_monthly_report(int,int) TO authenticated;

-- ───────────────── 2) Principal link code (owner only) ─────────────────────
-- Generates (once) and returns the 6-char code the ผอ. types into the school's
-- LINE OA:  "ผอ <CODE>".  Confusable chars 0/O/1/I are excluded.
CREATE OR REPLACE FUNCTION public.ensure_principal_link_code()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sid uuid;
  v_settings jsonb;
  v_code text;
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
BEGIN
  IF NOT public.is_owner_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'เฉพาะเจ้าของโรงเรียน');
  END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียน');
  END IF;

  SELECT coalesce(line_settings, '{}'::jsonb) INTO v_settings
  FROM public.schools WHERE id = sid;

  v_code := v_settings->>'principal_link_code';
  IF v_code IS NULL OR btrim(v_code) = '' THEN
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    END LOOP;
    UPDATE public.schools
    SET line_settings = jsonb_set(coalesce(line_settings, '{}'::jsonb),
                                  '{principal_link_code}', to_jsonb(v_code), true)
    WHERE id = sid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', v_code,
    'linked_count', jsonb_array_length(coalesce(v_settings->'principal_line_user_ids', '[]'::jsonb))
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_principal_link_code() TO authenticated;

-- ───────────────── 3) Unlink all principals (owner only) ───────────────────
CREATE OR REPLACE FUNCTION public.unlink_principals()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  IF NOT public.is_owner_or_higher() THEN
    RETURN jsonb_build_object('success', false, 'error', 'เฉพาะเจ้าของโรงเรียน');
  END IF;
  sid := public.current_school_id();
  IF sid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียน');
  END IF;

  UPDATE public.schools
  SET line_settings = jsonb_set(coalesce(line_settings, '{}'::jsonb),
                                '{principal_line_user_ids}', '[]'::jsonb, true)
  WHERE id = sid;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END $$;
GRANT EXECUTE ON FUNCTION public.unlink_principals() TO authenticated;

-- Verify:
--   SELECT public.get_monthly_report(2026, 6);
--   SELECT public.ensure_principal_link_code();   -- owner only
--   SELECT public.unlink_principals();            -- owner only
--   SELECT line_settings->>'principal_link_code',
--          line_settings->'principal_line_user_ids'
--   FROM public.schools WHERE id = public.current_school_id();
