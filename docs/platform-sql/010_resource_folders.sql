-- =====================================================================================================
-- 010_resource_folders.sql   --   DRAFT / NOT APPLIED / DATABASE / risk: LOW-MEDIUM
--
-- *** DO NOT RUN WITHOUT OWNER APPROVAL. Never run it first on production: run it on a restored copy
-- *** (staging) first.  The author did not run it against the live project.
--
-- PURPOSE
--   Replace the hard-coded resource categories with a real folder tree the admin manages
--   (Admin -> Folders), mapped to the "Folder" dropdown of the Add-resource form and browsable by
--   students and teachers.
--     * new table  public.resource_folders  (self-referencing tree, max depth 3, no cycles)
--     * new column public.resources.folder_id  (nullable FK, ON DELETE RESTRICT, indexed)
--     * RLS on the new table that mirrors the existing `resources` policies exactly
--       (admin = public.is_admin(); students/teachers read folders whose audience matches their role or 'both')
--     * BACKFILL: the four historical categories become top-level folders and every existing resource
--       gets folder_id from its legacy category (idempotent)
--
-- WHAT IS DELIBERATELY NOT TOUCHED
--     * resources.category (kept; the app keeps writing it and older readers keep working)
--     * storage objects, bucket, storage policies, file_path values (paths are audience/category/<uuid>.ext;
--       the existing storage policy matches on file_path, not on category or folder) -- NO FILE MOVES EVER
--     * existing resources policies, is_admin(), profiles, any other table
--
-- PRECONDITIONS
--     * public.resources exists (supabase/resources-migration.sql applied)
--     * public.is_admin() and public.touch_updated_at() exist (both created by earlier migrations)
--     * 010_preflight_readonly.sql was run and its output reviewed
--     * a backup exists (see docs/RESOURCE_FOLDERS.md section "Applying the SQL safely")
--     * run as the project owner (the SQL editor's postgres role) because the backfill briefly disables
--       the updated_at trigger on resources so that updated_at is NOT bumped on every existing row
--
-- RISK
--     Low for data (additive; one nullable column; backfill only fills folder_id).  Medium for rollout:
--     the app code already works without this migration (it falls back to the four categories) and with it.
--     Deploy order: apply SQL -> verify -> (app code may already be deployed; nothing else to do).
--     Premium is NOT enforced by this migration: folders carry access_tier as metadata only; enforcement
--     arrives with docs/security-plan 030/032 when the owner decides.
--
-- ROLLBACK : 010_resource_folders_rollback.sql
-- IDEMPOTENT: yes (safe to run twice).
-- =====================================================================================================
begin;

-- ---- 1. table ------------------------------------------------------------------------------------
create table if not exists public.resource_folders (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.resource_folders(id) on delete restrict,
  -- same audience vocabulary as resources.audience
  audience    text not null check (audience in ('student', 'teacher', 'both')),
  name        text not null check (char_length(btrim(name)) between 1 and 80 and name !~ '[/\\]'),
  -- stable key. For the four seeded top-level folders it equals the legacy category id, which is what keeps
  -- old deep links (/student/resources/ib-documents) and the resources.category mapping working.
  slug        text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order  integer not null default 0,
  -- same convention as resources.access_tier ('free' | 'premium').  Metadata only until enforcement exists.
  access_tier text not null default 'free' check (access_tier in ('free', 'premium')),
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- unique (parent, name) per audience (case-insensitive); top-level rows share one "null parent" bucket.
create unique index if not exists resource_folders_sibling_name_uq
  on public.resource_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), audience, lower(name));
create unique index if not exists resource_folders_sibling_slug_uq
  on public.resource_folders (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), audience, slug);
create index if not exists resource_folders_parent_idx on public.resource_folders (parent_id);
create index if not exists resource_folders_audience_idx on public.resource_folders (audience);

-- ---- 2. structure guard: depth <= 3, no cycles, audience nesting ---------------------------------
-- A child's audience may not be wider than its parent's (parent 'both' allows anything; parent 'student'
-- or 'teacher' only the same audience).  Depth: top-level = 1, maximum 3 (including the subtree below).
create or replace function public.resource_folders_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_aud text;
  v_parent_parent uuid;
  v_depth int := 1;      -- depth of the NEW PARENT (1 when it is top-level)
  v_cursor uuid;
  v_hops int := 0;
  v_sub int := 0;        -- height of the subtree below NEW (0 when it has no children)
begin
  -- serialise structure edits so two concurrent moves cannot jointly create a cycle
  perform pg_advisory_xact_lock(hashtext('public.resource_folders'));

  new.name := btrim(new.name);

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A folder cannot be its own parent' using errcode = '23514';
    end if;
    select audience, parent_id into v_parent_aud, v_parent_parent from public.resource_folders where id = new.parent_id;
    if not found then
      raise exception 'Parent folder does not exist' using errcode = '23503';
    end if;
    v_cursor := v_parent_parent;
    while v_cursor is not null loop
      if v_cursor = new.id then
        raise exception 'Moving this folder there would create a cycle' using errcode = '23514';
      end if;
      v_depth := v_depth + 1;
      v_hops := v_hops + 1;
      if v_hops > 20 then raise exception 'Folder hierarchy is corrupt (too many levels)' using errcode = '23514'; end if;
      select parent_id into v_cursor from public.resource_folders where id = v_cursor;
    end loop;
    if v_parent_aud <> 'both' and new.audience <> v_parent_aud then
      raise exception 'Audience % does not fit inside a % folder', new.audience, v_parent_aud using errcode = '23514';
    end if;
  else
    v_depth := 0;
  end if;

  if tg_op = 'UPDATE' then
    with recursive t(id, d) as (
      select id, 1 from public.resource_folders where parent_id = new.id
      union all
      select f.id, t.d + 1 from public.resource_folders f join t on f.parent_id = t.id where t.d < 10
    )
    select coalesce(max(d), 0) into v_sub from t;

    -- audience of anything below must still fit under this folder
    if new.audience <> 'both' and exists (
      with recursive t(id, aud) as (
        select id, audience from public.resource_folders where parent_id = new.id
        union all
        select f.id, f.audience from public.resource_folders f join t on f.parent_id = t.id
      )
      select 1 from t where aud <> new.audience
    ) then
      raise exception 'Sub-folders are for a different audience; change them first' using errcode = '23514';
    end if;
  end if;

  if v_depth + 1 + v_sub > 3 then
    raise exception 'Folders can be nested at most 3 levels deep' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists resource_folders_guard on public.resource_folders;
create trigger resource_folders_guard
  before insert or update of parent_id, audience on public.resource_folders
  for each row execute function public.resource_folders_guard();

drop trigger if exists set_updated_at on public.resource_folders;
create trigger set_updated_at before update on public.resource_folders
  for each row execute function public.touch_updated_at();

-- ---- 3. RLS (mirrors supabase/resources-migration.sql policy shapes and role checks) --------------
alter table public.resource_folders enable row level security;

drop policy if exists "Admins can read all resource folders" on public.resource_folders;
create policy "Admins can read all resource folders" on public.resource_folders for select
  using (public.is_admin());
drop policy if exists "Admins can insert resource folders" on public.resource_folders;
create policy "Admins can insert resource folders" on public.resource_folders for insert
  with check (public.is_admin());
drop policy if exists "Admins can update resource folders" on public.resource_folders;
create policy "Admins can update resource folders" on public.resource_folders for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete resource folders" on public.resource_folders;
create policy "Admins can delete resource folders" on public.resource_folders for delete
  using (public.is_admin());

-- Same role checks as the resources policies: audience matches the caller's profile role, or 'both'.
drop policy if exists "Students can read student resource folders" on public.resource_folders;
create policy "Students can read student resource folders" on public.resource_folders for select
  using (
    audience in ('student', 'both')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
  );
drop policy if exists "Teachers can read teacher resource folders" on public.resource_folders;
create policy "Teachers can read teacher resource folders" on public.resource_folders for select
  using (
    audience in ('teacher', 'both')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );
-- Table privileges: nothing is granted here.  Whatever default privileges the project applies to new
-- public tables is what resources got too; if docs/security-plan 020 (grants hardening) has been applied,
-- grant `select, insert, update, delete` on public.resource_folders to `authenticated` the same way it does
-- for public.resources (RLS above still decides who may do what).

-- ---- 4. resources.folder_id ----------------------------------------------------------------------
alter table public.resources
  add column if not exists folder_id uuid references public.resource_folders(id) on delete restrict;
create index if not exists resources_folder_id_idx on public.resources (folder_id);
-- ON DELETE RESTRICT (here and on parent_id): a folder that still holds resources or sub-folders cannot be deleted.

-- ---- 5. BACKFILL (idempotent) ---------------------------------------------------------------------
-- 5a. seed the four historical categories as top-level folders (slug = legacy category id).
--     Student folders sort 10/20, teacher folders 110/120 (so they stay grouped in the admin tree).
insert into public.resource_folders (parent_id, audience, name, slug, sort_order, access_tier)
select null, v.aud, v.name, v.slug, v.ord, 'free'
from (values
  ('student', 'IB Documents',                 'ib-documents',     10),
  ('student', 'Study Materials',              'study-materials',  20),
  ('teacher', 'IB Resources',                 'ib-resources',     110),
  ('teacher', 'Worksheets & Other Resources', 'worksheets-other', 120)
) as v(aud, name, slug, ord)
where not exists (
  select 1 from public.resource_folders f where f.parent_id is null and f.audience = v.aud and f.slug = v.slug
)
on conflict do nothing;

-- 5b. point every existing resource at the folder of its legacy category.  Only rows without a folder_id
--     are touched; resources.category and file_path are NOT modified.  The updated_at trigger is
--     suspended for this statement so updated_at is not bumped on every row.
alter table public.resources disable trigger set_updated_at;
update public.resources r
   set folder_id = f.id
  from public.resource_folders f
 where r.folder_id is null
   and f.parent_id is null
   and f.slug = r.category
   and f.audience = case when r.category in ('ib-documents', 'study-materials') then 'student'
                         when r.category in ('ib-resources', 'worksheets-other') then 'teacher' end;
alter table public.resources enable trigger set_updated_at;
-- Resources with any OTHER category value keep folder_id NULL; the app shows them under "All resources"
-- and the admin can file them via Resources -> Edit -> Folder.  (The preflight lists them beforehand.)
-- A resource with audience 'both' is placed in the folder matching its stored category; the app maps it to
-- the equivalent folder for the other role at read time, exactly as getCategoryForAudience() did.

-- ---- 6. quick self-check (read-only; remove if your editor shows only the last result) ---------------
select
  (select count(*) from public.resource_folders)                              as folders,
  (select count(*) from public.resources)                                     as resources,
  (select count(*) from public.resources where folder_id is not null)         as resources_with_folder,
  (select count(*) from public.resources where folder_id is null)             as resources_without_folder;

commit;
