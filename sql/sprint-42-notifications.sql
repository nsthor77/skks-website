-- ============================================================================
-- Sprint 42 — ศูนย์แจ้งเตือนรวม (notification center) — PULL model
-- ============================================================================
-- One RPC aggregates "things needing attention" for the current user from
-- existing data (no new writes anywhere): active announcements, pending consent
-- forms, unanswered surveys, unpaid bills. Read-state is tracked client-side.
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create or replace function public.get_notifications()
returns table(kind text, title text, detail text, url text, ts timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_role text;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  v_role := public.current_user_role();

  -- 1) active announcements for me
  return query
    select 'announcement'::text, a.title, left(coalesce(a.body,''),140), 'announcements'::text, a.created_at
    from public.announcements a
    where a.school_id = v_school and a.active
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at   is null or a.ends_at   >= now())
      and (a.audience='all'
        or (a.audience='staff'    and v_role in ('teacher','staff','owner','developer'))
        or (a.audience='students' and v_role in ('student','parent'))
        or (a.audience='parents'  and v_role='parent'));

  -- 2) consent forms my children have not answered (parent/student)
  return query
    select 'consent'::text, 'หนังสือรอตอบ: '||f.title,
           btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')),
           'my-consent'::text, f.created_at
    from public.students s
    join public.consent_forms f on f.school_id = v_school and f.active
    left join public.consent_responses r on r.form_id = f.id and r.student_id = s.id
    where s.id = any (public.my_student_ids()) and r.decision is null
      and (f.audience='all'
        or (f.audience='grade'     and coalesce(s.grade,'')=coalesce(f.target_grade,''))
        or (f.audience='classroom' and coalesce(s.classroom,'')=coalesce(f.target_classroom,'')));

  -- 3) surveys I have not answered
  return query
    select 'survey'::text, 'แบบสอบถาม: '||sv.title, coalesce(sv.description,''), 'my-surveys'::text, sv.created_at
    from public.surveys sv
    where sv.school_id = v_school and sv.active
      and not exists (select 1 from public.survey_responses rr where rr.survey_id=sv.id and rr.respondent_id=auth.uid())
      and (sv.audience='all'
        or (sv.audience='staff'    and v_role in ('teacher','staff','owner','developer'))
        or (sv.audience='students' and v_role='student')
        or (sv.audience='parents'  and v_role='parent'));

  -- 4) unpaid bills for my children (wrapped: bills schema may vary)
  begin
    return query
      select 'bill'::text, 'บิลค่าเทอมรอชำระ'::text,
             '฿'||trim(to_char(b.amount,'FM999,999,990')), 'my-bills'::text, b.due_date::timestamptz
      from public.bills b
      where b.school_id = v_school and b.status in ('unpaid','pending')
        and b.student_id = any (public.my_student_ids());
  exception when others then null;
  end;
end$$;
grant execute on function public.get_notifications to authenticated;

-- ============================================================================
-- verify: select * from public.get_notifications();
-- ============================================================================
