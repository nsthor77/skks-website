-- ============================================================================
-- Sprint 30 — In-app announcement board (ประกาศในแอป)
-- ============================================================================
-- School-scoped announcements that pop up on the dashboard for the right audience
-- at login. Admin/owner post + manage; everyone sees the ones meant for them.
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  title       text not null,
  body        text,
  audience    text not null default 'all',     -- all | staff | students | parents
  pinned      boolean not null default false,
  active      boolean not null default true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists announcements_school_idx on public.announcements (school_id, active);

alter table public.announcements enable row level security;

-- staff/admin/owner of the school manage their announcements
drop policy if exists ann_staff_manage on public.announcements;
create policy ann_staff_manage on public.announcements for all to authenticated
  using (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'))
  with check (school_id = public.current_school_id()
         and public.current_user_role() in ('staff','owner','developer'));

-- any signed-in member of the school may READ (RPC further filters by audience)
drop policy if exists ann_member_read on public.announcements;
create policy ann_member_read on public.announcements for select to authenticated
  using (school_id = public.current_school_id());

-- ---- RPCs -------------------------------------------------------------------

-- Active announcements visible to the CURRENT user (by role + date window).
create or replace function public.get_active_announcements()
returns setof public.announcements
language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_role text;
begin
  v_school := public.current_school_id();
  if v_school is null then return; end if;
  v_role := public.current_user_role();
  return query
    select * from public.announcements a
    where a.school_id = v_school
      and a.active = true
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at   is null or a.ends_at   >= now())
      and (
        a.audience = 'all'
        or (a.audience = 'staff'    and v_role in ('teacher','staff','owner','developer'))
        or (a.audience = 'students' and v_role in ('student','parent'))
        or (a.audience = 'parents'  and v_role = 'parent')
      )
    order by a.pinned desc, a.created_at desc;
end$$;
grant execute on function public.get_active_announcements to authenticated;

-- Full list for the admin page (incl inactive/expired).
create or replace function public.list_announcements()
returns setof public.announcements
language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then return; end if;
  return query select * from public.announcements a
    where a.school_id = v_school order by a.pinned desc, a.created_at desc;
end$$;
grant execute on function public.list_announcements to authenticated;

-- Create or update (p_id null = create). Staff/owner only.
create or replace function public.save_announcement(
  p_id uuid, p_title text, p_body text, p_audience text,
  p_pinned boolean, p_active boolean, p_starts_at timestamptz, p_ends_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_id uuid; v_aud text;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  if coalesce(btrim(p_title),'') = '' then
    return jsonb_build_object('success', false, 'error', 'กรุณาใส่หัวข้อ');
  end if;
  v_aud := lower(coalesce(p_audience,'all'));
  if v_aud not in ('all','staff','students','parents') then v_aud := 'all'; end if;

  if p_id is null then
    insert into public.announcements (school_id, title, body, audience, pinned, active, starts_at, ends_at, created_by)
    values (v_school, btrim(p_title), p_body, v_aud, coalesce(p_pinned,false), coalesce(p_active,true), p_starts_at, p_ends_at, auth.uid())
    returning id into v_id;
  else
    update public.announcements set
      title = btrim(p_title), body = p_body, audience = v_aud,
      pinned = coalesce(p_pinned,false), active = coalesce(p_active,true),
      starts_at = p_starts_at, ends_at = p_ends_at, updated_at = now()
    where id = p_id and school_id = v_school
    returning id into v_id;
    if v_id is null then return jsonb_build_object('success', false, 'error', 'ไม่พบประกาศ'); end if;
  end if;
  return jsonb_build_object('success', true, 'id', v_id);
end$$;
grant execute on function public.save_announcement to authenticated;

create or replace function public.delete_announcement(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_school uuid;
begin
  v_school := public.current_school_id();
  if v_school is null or public.current_user_role() not in ('staff','owner','developer') then
    return jsonb_build_object('success', false, 'error', 'ไม่มีสิทธิ์');
  end if;
  delete from public.announcements where id = p_id and school_id = v_school;
  return jsonb_build_object('success', true);
end$$;
grant execute on function public.delete_announcement to authenticated;

-- ============================================================================
-- verify:  select public.get_active_announcements();
--          select public.list_announcements();
-- ============================================================================
