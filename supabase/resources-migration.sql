-- e-Lab: Resources CMS migration
--
-- NOT run automatically. Review, then run in the Supabase SQL Editor.
-- Adds one new table (`resources`) and one new Storage bucket
-- (`resources`) — does not touch `profiles`, `learning_progress`,
-- `concept_attempts`, `user_preferences`, existing RLS policies, or any
-- existing data.

-- ============================================================
-- Reusable admin check — used by every policy below, and reusable by
-- future Learn/Question Bank CMS migrations so "is this user an admin"
-- is defined in exactly one place, never duplicated ad hoc per policy.
-- SECURITY DEFINER + a pinned search_path so it reliably reads
-- public.profiles regardless of the caller's own search_path.
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- resources
-- ============================================================
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,

  -- WHO this resource is for. Kept separate from `role` (the profiles
  -- table's auth concept) — audience is content targeting, not identity.
  audience text not null check (audience in ('student', 'teacher', 'both')),

  -- Free-text category, deliberately not a fixed enum: Student resources
  -- currently use 'ib-documents' | 'study-materials' (matching the
  -- existing CATEGORIES in src/pages/student/resources/lib/resourceUtils.js);
  -- Teacher resources currently have no subdivision, so 'teacher' is used
  -- as a single flat category. New categories can be introduced later
  -- without a schema change.
  category text not null,

  -- Curriculum/topic/subtopic as free text, matching the existing
  -- convention already used in src/data/student-resources.js (curriculum:
  -- "dp-chemistry", topic: "Structure 1") — NOT a second parallel
  -- curriculum hierarchy. `curriculum` defaults to the only curriculum
  -- e-Lab currently has, but nothing here hard-codes Chemistry — a future
  -- Physics/Biology/MYP resource just sets a different curriculum value.
  curriculum text not null default 'dp-chemistry',
  topic text,
  subtopic text,
  level text check (level is null or level in ('SL', 'HL', 'SL & HL')),

  resource_type text not null,

  -- Exactly one of file_path / external_url should be set — enforced in
  -- the application layer (resourceService.js), matching how
  -- student-resources.js already documents "set exactly one".
  file_path text, -- Storage object path, e.g. "student/study-materials/<uuid>-notes.pdf" — NOT a public URL
  external_url text,
  original_file_name text,
  mime_type text,
  file_size bigint,

  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  is_locked boolean not null default false,

  -- Separate from status/is_locked/audience entirely, per the brief —
  -- metadata only until a real entitlement system exists. Nothing reads
  -- this to block access yet.
  access_tier text not null default 'free' check (access_tier in ('free', 'premium')),

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resources enable row level security;

create index if not exists resources_audience_status_idx on public.resources(audience, status);
create index if not exists resources_category_idx on public.resources(category);

-- Admin: full access.
create policy "Admins can read all resources"
  on public.resources for select
  using (public.is_admin());

create policy "Admins can insert resources"
  on public.resources for insert
  with check (public.is_admin());

create policy "Admins can update resources"
  on public.resources for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete resources"
  on public.resources for delete
  using (public.is_admin());

-- Students: only published resources meant for students or both.
-- (is_locked does NOT affect this SELECT policy — a locked resource is
-- still visible with a lock indicator, per the brief; only opening the
-- underlying file is blocked, which the Storage policy below handles.)
create policy "Students can read published student resources"
  on public.resources for select
  using (
    status = 'published'
    and audience in ('student', 'both')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'student')
  );

-- Teachers: only published resources meant for teachers or both.
create policy "Teachers can read published teacher resources"
  on public.resources for select
  using (
    status = 'published'
    and audience in ('teacher', 'both')
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher')
  );

drop trigger if exists set_updated_at on public.resources;
create trigger set_updated_at before update on public.resources
  for each row execute function public.touch_updated_at(); -- reuses the function already created in schema.sql

-- ============================================================
-- Storage bucket — PRIVATE (not public), per the brief's explicit
-- instruction. Files are only ever accessed via short-lived signed URLs
-- generated after the `resources` row's business rules (status, audience,
-- is_locked) are checked — see resourceService.js. A predictable
-- permanent public URL is never handed out.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('resources', 'resources', false)
on conflict (id) do nothing;

-- Admins: full Storage access within the resources bucket.
create policy "Admins can manage resource files"
  on storage.objects for all
  using (bucket_id = 'resources' and public.is_admin())
  with check (bucket_id = 'resources' and public.is_admin());

-- Students/Teachers: can only read (needed for createSignedUrl) an
-- object whose PATH matches a resources row that is published, unlocked,
-- and targeted at their role. This is what actually prevents a locked or
-- teacher-only file from being opened by guessing/reusing a path — the
-- check happens at the Storage layer itself, not just in the UI.
create policy "Authorized users can read unlocked published resource files"
  on storage.objects for select
  using (
    bucket_id = 'resources'
    and exists (
      select 1 from public.resources r
      join public.profiles p on p.id = auth.uid()
      where r.file_path = storage.objects.name
        and r.status = 'published'
        and r.is_locked = false
        and (r.audience = 'both' or r.audience = p.role)
    )
  );
