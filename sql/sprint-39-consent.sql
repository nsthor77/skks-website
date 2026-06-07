-- ============================================================================
-- Sprint 39 — หนังสือขออนุญาต/ขอความยินยอม + เซ็นออนไลน์ (consent forms)
-- ============================================================================
-- Staff create a form (consent or acknowledge), targeted all/grade/classroom.
-- Parents respond PER CHILD with a typed signature. Pillar B (parent engagement).
-- Idempotent. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.consent_forms (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  title             text not null,
  body              text,
  audience          text not null default 'all',     -- all | grade | classroom
  target_grade      text,
  target_classroom  text,
  mode              text not null default 'consent',  -- consent (อนุญาต/ไม่อนุญาต) | acknowledge (รับทราบ)
  require_signature boolean not null default true,
  deadline          date,
  active            boolean not null default true,
  created_by        uuid,
  created_at        timestamptz not null default now()
);
create index if not exists consent_forms_school_idx on public.consent_forms (school_id, active);

create table if not exists public.consent_responses (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.consent_forms(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  decision     text,            -- approved | declined | acknowledged
  signer_name  text,
  relation     text,            -- บิดา/มารดา/ผู้ปกครอง
  note         text,
  responded_at timestamptz not null default now(),
  unique (form_id, student_id)
);
create index if not exists consent_resp_form_idx on public.consent_responses (form_id);

alter table public.consent_forms enable row level security;
alter table public.consent_responses enable row level security;

-- forms: staff manage; any member of school may read (RPC filters by audience)
drop policy if exists cf_staff_manage on public.consent_forms;
create policy cf_staff_manage on public.consent_forms for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
drop policy if exists cf_member_read on public.consent_forms;
create policy cf_member_read on public.consent_forms for select to authenticated
  using (school_id = public.current_school_id());

-- responses: staff read/manage all; parent/student manage their own children's
drop policy if exists cr_staff_manage on public.consent_responses;
create policy cr_staff_manage on public.consent_responses for all to authenticated
  using (school_id = public.current_school_id() and public.is_staff_or_higher())
  with check (school_id = public.current_school_id() and public.is_staff_or_higher());
drop policy if exists cr_own_manage on public.consent_responses;
create policy cr_own_manage on public.consent_responses for all to authenticated
  using (school_id = public.current_school_id() and student_id = any (public.my_student_ids()))
  with check (school_id = public.current_school_id() and student_id = any (public.my_student_ids()));

-- ---- staff RPCs -------------------------------------------------------------
create or replace function public.save_consent_form(
  p_id uuid, p_title text, p_body text, p_audience text, p_grade text, p_classroom text,
  p_mode text, p_require_sig boolean, p_deadline date, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid; v_aud text;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if coalesce(btrim(p_title),'')='' then return jsonb_build_object('success', false, 'error', 'กรุณาใส่หัวข้อ'); end if;
  v_aud := lower(coalesce(p_audience,'all')); if v_aud not in ('all','grade','classroom') then v_aud:='all'; end if;
  if p_id is null then
    insert into public.consent_forms (school_id,title,body,audience,target_grade,target_classroom,mode,require_signature,deadline,active,created_by)
    values (v_school, btrim(p_title), p_body, v_aud, p_grade, p_classroom, coalesce(p_mode,'consent'),
            coalesce(p_require_sig,true), p_deadline, coalesce(p_active,true), auth.uid())
    returning id into v_id;
  else
    update public.consent_forms set title=btrim(p_title), body=p_body, audience=v_aud, target_grade=p_grade,
      target_classroom=p_classroom, mode=coalesce(p_mode,mode), require_signature=coalesce(p_require_sig,require_signature),
      deadline=p_deadline, active=coalesce(p_active,active)
    where id=p_id and school_id=v_school returning id into v_id;
    if v_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบรายการ'); end if;
  end if;
  return jsonb_build_object('success', true, 'id', v_id);
end$$;
grant execute on function public.save_consent_form to authenticated;

create or replace function public.list_consent_forms()
returns table(id uuid, title text, body text, audience text, target_grade text, target_classroom text,
              mode text, require_signature boolean, deadline date, active boolean, created_at timestamptz,
              responses bigint)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select f.id,f.title,f.body,f.audience,f.target_grade,f.target_classroom,f.mode,f.require_signature,
           f.deadline,f.active,f.created_at,
           (select count(*) from public.consent_responses r where r.form_id=f.id)
    from public.consent_forms f where f.school_id=v_school order by f.created_at desc;
end$$;
grant execute on function public.list_consent_forms to authenticated;

create or replace function public.delete_consent_form(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์'); end if;
  delete from public.consent_forms where id=p_id and school_id=v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_consent_form to authenticated;

create or replace function public.get_consent_responses(p_form_id uuid)
returns table(student_id uuid, student_name text, grade text, classroom text,
              decision text, signer_name text, relation text, note text, responded_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or not public.is_staff_or_higher() then return; end if;
  return query
    select s.id, btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')), s.grade, s.classroom,
           r.decision, r.signer_name, r.relation, r.note, r.responded_at
    from public.students s
    join public.consent_forms f on f.id = p_form_id and f.school_id = v_school
    left join public.consent_responses r on r.form_id = f.id and r.student_id = s.id
    where s.school_id = v_school
      and coalesce(s.status,'active')='active'
      and (f.audience='all'
        or (f.audience='grade' and coalesce(s.grade,'')=coalesce(f.target_grade,''))
        or (f.audience='classroom' and coalesce(s.classroom,'')=coalesce(f.target_classroom,'')))
    order by r.responded_at desc nulls last, s.grade, s.classroom;
end$$;
grant execute on function public.get_consent_responses to authenticated;

-- ---- parent/student RPCs ----------------------------------------------------
-- applicable active forms × my children, with my response (if any)
create or replace function public.get_my_consents()
returns table(form_id uuid, student_id uuid, student_name text, title text, body text, mode text,
              require_signature boolean, deadline date, decision text, signer_name text, responded_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  return query
    select f.id, s.id, btrim(coalesce(s.first_name_th,'')||' '||coalesce(s.last_name_th,'')),
           f.title, f.body, f.mode, f.require_signature, f.deadline, r.decision, r.signer_name, r.responded_at
    from public.students s
    join public.consent_forms f on f.school_id = v_school and f.active
    left join public.consent_responses r on r.form_id = f.id and r.student_id = s.id
    where s.id = any (public.my_student_ids())
      and (f.audience='all'
        or (f.audience='grade' and coalesce(s.grade,'')=coalesce(f.target_grade,''))
        or (f.audience='classroom' and coalesce(s.classroom,'')=coalesce(f.target_classroom,'')))
    order by (r.decision is not null), f.created_at desc;
end$$;
grant execute on function public.get_my_consents to authenticated;

create or replace function public.submit_consent(
  p_form_id uuid, p_student_id uuid, p_decision text, p_signer_name text, p_relation text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null then return jsonb_build_object('success', false, 'error', 'ไม่พบโรงเรียน'); end if;
  if not (p_student_id = any (public.my_student_ids())) then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์ตอบแทนนักเรียนคนนี้');
  end if;
  insert into public.consent_responses (form_id, school_id, student_id, decision, signer_name, relation, note, responded_at)
  values (p_form_id, v_school, p_student_id, p_decision, p_signer_name, p_relation, p_note, now())
  on conflict (form_id, student_id) do update set
    decision=excluded.decision, signer_name=excluded.signer_name, relation=excluded.relation,
    note=excluded.note, responded_at=now();
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.submit_consent to authenticated;

-- ============================================================================
