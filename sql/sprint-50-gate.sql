-- ============================================================================
-- Sprint 50 — เช็คชื่อประตู QR (gate entry/exit scan)
-- ============================================================================
-- Scans student QR (ID card encodes student_number or id) → logs entry/exit.
-- gate_scan() resolves the scanned code to a student of THIS school. Idempotent.
-- ============================================================================
create table if not exists public.gate_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  direction text not null default 'in',   -- in | out
  scanned_at timestamptz not null default now(),
  scanned_by uuid
);
create index if not exists gate_logs_idx on public.gate_logs (school_id, scanned_at desc);

alter table public.gate_logs enable row level security;
drop policy if exists gate_staff on public.gate_logs;
create policy gate_staff on public.gate_logs for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
drop policy if exists gate_own on public.gate_logs;
create policy gate_own on public.gate_logs for select to authenticated
  using (school_id = public.current_school_id() and student_id = any(public.my_student_ids()));

-- resolve scanned code → student, log it, return student info
create or replace function public.gate_scan(p_code text, p_direction text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_sid uuid; v_name text; v_grade text; v_class text; v_dir text;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success',false,'error','ไม่มีสิทธิ์'); end if;
  if coalesce(btrim(p_code),'')='' then return jsonb_build_object('success',false,'error','ไม่พบรหัส'); end if;
  v_dir := case when lower(coalesce(p_direction,'in'))='out' then 'out' else 'in' end;

  select s.id, btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), s.grade, s.classroom
    into v_sid, v_name, v_grade, v_class
  from public.students s
  where s.school_id = v_school
    and (s.student_number = btrim(p_code) or s.id::text = btrim(p_code))
  limit 1;

  if v_sid is null then return jsonb_build_object('success',false,'error','ไม่พบนักเรียนรหัสนี้'); end if;

  insert into public.gate_logs (school_id, student_id, direction, scanned_by)
  values (v_school, v_sid, v_dir, auth.uid());

  return jsonb_build_object('success',true,'student_name',v_name,'grade',v_grade,'classroom',v_class,'direction',v_dir);
end$$;
grant execute on function public.gate_scan to authenticated;

create or replace function public.recent_gate_logs(p_limit int)
returns table(student_name text, grade text, classroom text, direction text, scanned_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), s.grade, s.classroom, g.direction, g.scanned_at
    from public.gate_logs g join public.students s on s.id=g.student_id
    where g.school_id=v_school order by g.scanned_at desc limit coalesce(p_limit,30);
end$$;
grant execute on function public.recent_gate_logs to authenticated;
-- ============================================================================
