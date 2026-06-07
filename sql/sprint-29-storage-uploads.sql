-- ============================================================================
-- Sprint 29 — Self-service image upload (Supabase Storage)
-- ============================================================================
-- Creates ONE public bucket "school-assets" that holds every tenant's logos and
-- student photos, isolated by a top-level folder = school_id:
--     school-assets/{school_id}/logos/...
--     school-assets/{school_id}/students/...
-- Read = public (so logos/photos render in PDFs, ID cards, public site without auth).
-- Write/Update/Delete = only staff+ of the SAME school (RLS by folder = current_school_id).
-- Also adds students.photo_url for the student photo.
-- Idempotent — safe to re-run. Run on prod "School Kit".
-- ============================================================================

-- 1) bucket -------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school-assets', 'school-assets', true, 3145728,           -- 3 MB cap
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 3145728,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) RLS on storage.objects ---------------------------------------------------
-- (RLS is already enabled on storage.objects by Supabase.)

-- public read (bucket is public; explicit SELECT policy lets the app also list)
drop policy if exists "school_assets_public_read" on storage.objects;
create policy "school_assets_public_read" on storage.objects
  for select to public
  using (bucket_id = 'school-assets');

-- staff+ of the school may upload into THEIR OWN {school_id}/ folder
drop policy if exists "school_assets_staff_insert" on storage.objects;
create policy "school_assets_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_staff_or_higher()
  );

-- staff+ may overwrite/replace within their own folder
drop policy if exists "school_assets_staff_update" on storage.objects;
create policy "school_assets_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_staff_or_higher()
  )
  with check (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_staff_or_higher()
  );

-- staff+ may delete within their own folder
drop policy if exists "school_assets_staff_delete" on storage.objects;
create policy "school_assets_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = public.current_school_id()::text
    and public.is_staff_or_higher()
  );

-- 3) student photo column -----------------------------------------------------
alter table public.students add column if not exists photo_url text;

-- ============================================================================
-- verify:
--   select id, public, file_size_limit from storage.buckets where id='school-assets';
--   select policyname from pg_policies where tablename='objects' and policyname like 'school_assets%';
--   select column_name from information_schema.columns where table_name='students' and column_name='photo_url';
-- ============================================================================
