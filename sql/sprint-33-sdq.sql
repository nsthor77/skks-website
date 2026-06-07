-- ============================================================================
-- Sprint 33 — SDQ assessment (แบบประเมินจุดแข็งและจุดอ่อน / กรมสุขภาพจิต)
-- ============================================================================
-- Standardized 25-item SDQ. 3 versions (self/teacher/parent). Scoring +
-- interpretation are computed in the browser and stored alongside raw answers.
-- Part of ระบบดูแลช่วยเหลือนักเรียน (required by สพฐ.).
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.sdq_assessments (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  version        text not null default 'teacher',   -- self | teacher | parent
  assessor_name  text,
  answers        jsonb not null,                     -- {"1":0,"2":1,...,"25":2}
  scores         jsonb not null,                     -- {emotional,conduct,hyperactivity,peer,prosocial,total}
  interpretation jsonb,                              -- {total:'ปกติ', prosocial:'ปกติ', overall:'เสี่ยง'}
  academic_year  text,
  term           smallint,
  assessed_on    date not null default current_date,
  note           text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);
create index if not exists sdq_school_student_idx on public.sdq_assessments (school_id, student_id, assessed_on desc);

alter table public.sdq_assessments enable row level security;

-- staff/teacher manage
drop policy if exists sdq_staff_manage on public.sdq_assessments;
create policy sdq_staff_manage on public.sdq_assessments for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());

-- student/parent read their own
drop policy if exists sdq_student_read on public.sdq_assessments;
create policy sdq_student_read on public.sdq_assessments for select to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

-- ---- RPCs -------------------------------------------------------------------
create or replace function public.save_sdq(
  p_id uuid, p_student_id uuid, p_version text, p_assessor_name text,
  p_answers jsonb, p_scores jsonb, p_interpretation jsonb,
  p_year text, p_term smallint, p_assessed_on date, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if p_student_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบนักเรียน'); end if;

  if p_id is null then
    insert into public.sdq_assessments
      (school_id, student_id, version, assessor_name, answers, scores, interpretation, academic_year, term, assessed_on, note, created_by)
    values (v_school, p_student_id, coalesce(p_version,'teacher'), p_assessor_name, p_answers, p_scores, p_interpretation,
            p_year, p_term, coalesce(p_assessed_on, current_date), p_note, auth.uid())
    returning id into v_id;
  else
    update public.sdq_assessments set
      version = coalesce(p_version, version), assessor_name = p_assessor_name,
      answers = p_answers, scores = p_scores, interpretation = p_interpretation,
      academic_year = p_year, term = p_term, assessed_on = coalesce(p_assessed_on, assessed_on), note = p_note
    where id = p_id and school_id = v_school
    returning id into v_id;
    if v_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success', true, 'id', v_id);
end$$;
grant execute on function public.save_sdq to authenticated;

create or replace function public.get_sdq(p_student_id uuid)
returns setof public.sdq_assessments language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query select * from public.sdq_assessments
    where school_id = v_school and student_id = p_student_id
    order by assessed_on desc, created_at desc;
end$$;
grant execute on function public.get_sdq to authenticated;

create or replace function public.delete_sdq(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  delete from public.sdq_assessments where id = p_id and school_id = v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_sdq to authenticated;

-- ============================================================================
-- verify: select public.get_sdq('<student uuid>');
-- ============================================================================
