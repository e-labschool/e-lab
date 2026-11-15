-- =====================================================================================================
-- 080_teacher_profile_metadata.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: LOW
-- Phase P8.  Stores validated professional metadata for teachers WITHOUT granting anything.
--
-- !! OPEN QUESTION (blocking the UI, not this schema) !!  The brief says the Teacher form uses "the previously agreed
-- required school name and dropdown professional fields".  That agreement is not in the repository, so NO FIELD NAMES
-- OR OPTION LISTS ARE INVENTED HERE.  The schema is definition-driven:
--   * school_name is a required column (named in the brief);
--   * every other professional field is a ROW in teacher_field_definitions with its options in teacher_field_options.
--     When the user supplies the list, a one-line INSERT per field (see the commented example at the bottom) configures it.
--   * save_teacher_profile() validates values against those rows, so dropdown values cannot be made up client-side.
--
-- POLICY: registration stays open; no manual approval; school or personal email allowed; the teacher ROLE grants
-- nothing here. These tables are display/analytics metadata, not authorization: no policy or function in this plan
-- reads them to grant access. (School-specific access comes only from organization_members + an active org entitlement.)
-- DOES NOT touch auth.users triggers or handle_new_user (live body unseen).  The client calls save_teacher_profile()
-- once after the first sign-in, passing the values the signup form stored in user metadata; metadata is used only to
-- PRE-FILL, the RPC re-validates everything.   Optional exception-safe trigger alternative is at the bottom (commented).
-- Concurrent sessions: nothing here limits them (no session table, no device registration) -- standard Supabase behaviour.
-- ROLLBACK: 080_teacher_profile_metadata_rollback.sql      IDEMPOTENT: yes.
-- =====================================================================================================
begin;

create table if not exists public.teacher_field_definitions (
  field_key text primary key check (field_key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label     text not null,
  kind      text not null check (kind in ('select', 'text')),
  required  boolean not null default true,
  sort      int not null default 0,
  active    boolean not null default true
);
create table if not exists public.teacher_field_options (
  field_key text not null references public.teacher_field_definitions(field_key) on delete cascade,
  value     text not null check (char_length(value) between 1 and 100),
  label     text not null,
  sort      int not null default 0,
  active    boolean not null default true,
  primary key (field_key, value)
);
create table if not exists public.teacher_profiles (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  school_name text not null check (char_length(btrim(school_name)) between 2 and 200),
  fields      jsonb not null default '{}'::jsonb,
  complete    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['teacher_field_definitions', 'teacher_field_options', 'teacher_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
drop policy if exists "Authenticated read field definitions" on public.teacher_field_definitions;
create policy "Authenticated read field definitions" on public.teacher_field_definitions for select to authenticated using (active);
drop policy if exists "Authenticated read field options" on public.teacher_field_options;
create policy "Authenticated read field options" on public.teacher_field_options for select to authenticated using (active);
drop policy if exists "Owner reads own teacher profile" on public.teacher_profiles;
create policy "Owner reads own teacher profile" on public.teacher_profiles for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Admins read teacher profiles" on public.teacher_profiles;
create policy "Admins read teacher profiles" on public.teacher_profiles for select to authenticated using (public.is_admin());
-- The signup page must read the definitions BEFORE sign-in to render the dropdowns:  expose them through a tiny anon-safe view.
create or replace view public.teacher_signup_fields as
  select d.field_key, d.label, d.kind, d.required, d.sort,
         coalesce((select jsonb_agg(jsonb_build_object('value', o.value, 'label', o.label) order by o.sort, o.value)
                     from public.teacher_field_options o where o.field_key = d.field_key and o.active), '[]'::jsonb) as options
    from public.teacher_field_definitions d where d.active;
revoke all on public.teacher_signup_fields from public;
grant select on public.teacher_signup_fields to anon, authenticated;   -- owner-rights view: labels/options only, no personal data

create or replace function public.validate_teacher_fields(p_fields jsonb) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare d record; v text; problems text[] := '{}'; k text;
begin
  if jsonb_typeof(coalesce(p_fields, '{}'::jsonb)) <> 'object' then return array['fields must be an object']; end if;
  for k in select jsonb_object_keys(coalesce(p_fields, '{}'::jsonb)) loop
    if not exists (select 1 from public.teacher_field_definitions where field_key = k and active) then problems := problems || ('unknown field: ' || left(k, 50)); end if;
  end loop;
  for d in select * from public.teacher_field_definitions where active loop
    v := nullif(btrim(coalesce(p_fields ->> d.field_key, '')), '');
    if v is null then
      if d.required then problems := problems || ('missing required field: ' || d.field_key); end if;
    elsif d.kind = 'select' and not exists (select 1 from public.teacher_field_options o where o.field_key = d.field_key and o.value = v and o.active) then
      problems := problems || ('invalid option for ' || d.field_key);
    elsif d.kind = 'text' and char_length(v) > 200 then
      problems := problems || ('too long: ' || d.field_key);
    end if;
  end loop;
  return problems;
end $$;
revoke all on function public.validate_teacher_fields(jsonb) from public, anon;
grant execute on function public.validate_teacher_fields(jsonb) to authenticated;

create or replace function public.save_teacher_profile(p_school_name text, p_fields jsonb default '{}'::jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_problems text[]; v_school text := btrim(coalesce(p_school_name, ''));
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'sign_in_required'); end if;
  if not exists (select 1 from public.profiles where id = v_uid and role = 'teacher' and coalesce(status, 'active') = 'active') then
    return jsonb_build_object('ok', false, 'error', 'not_a_teacher');          -- grants nothing; just refuses to store
  end if;
  if char_length(v_school) < 2 or char_length(v_school) > 200 then return jsonb_build_object('ok', false, 'error', 'school_name_required'); end if;
  v_problems := public.validate_teacher_fields(p_fields);
  insert into public.teacher_profiles (user_id, school_name, fields, complete)
  values (v_uid, v_school, coalesce(p_fields, '{}'::jsonb), cardinality(v_problems) = 0)
  on conflict (user_id) do update set school_name = excluded.school_name, fields = excluded.fields, complete = excluded.complete, updated_at = now();
  return jsonb_build_object('ok', true, 'complete', cardinality(v_problems) = 0, 'problems', to_jsonb(v_problems));
end $$;
revoke all on function public.save_teacher_profile(text, jsonb) from public, anon;
grant execute on function public.save_teacher_profile(text, jsonb) to authenticated;

commit;

-- ---- Example of configuring ONE field once the user supplies the agreed list (NOT executed; names are placeholders) ----
-- insert into public.teacher_field_definitions (field_key, label, kind, required, sort) values ('<field_key>', '<Label>', 'select', true, 10);
-- insert into public.teacher_field_options (field_key, value, label, sort) values ('<field_key>', '<value>', '<Option label>', 10);

-- ---- Optional alternative (NOT part of the default plan): capture at signup instead of first sign-in. ---------------
-- Adds a trigger on auth.users; a failure there blocks ALL signups, so the body is exception-safe and staging-tested only.
-- create or replace function public.capture_teacher_profile_from_signup() returns trigger language plpgsql security definer set search_path = '' as $f$
-- begin
--   begin
--     if (new.raw_user_meta_data ->> 'role') = 'teacher' and coalesce(btrim(new.raw_user_meta_data ->> 'school'), '') <> '' then
--       insert into public.teacher_profiles (user_id, school_name, fields, complete)
--       values (new.id, left(btrim(new.raw_user_meta_data ->> 'school'), 200), coalesce(new.raw_user_meta_data -> 'teacher_fields', '{}'::jsonb), false)
--       on conflict (user_id) do nothing;
--     end if;
--   exception when others then raise warning 'capture_teacher_profile_from_signup failed: %', sqlerrm;
--   end;
--   return new;
-- end $f$;
-- create trigger on_auth_user_created_zz_teacher_profile after insert on auth.users for each row execute function public.capture_teacher_profile_from_signup();
