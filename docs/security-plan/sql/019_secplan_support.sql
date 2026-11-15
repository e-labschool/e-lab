-- =====================================================================================================
-- 019_secplan_support.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: LOW
-- Phase P2 (prerequisite). Creates a private schema `secplan` holding SNAPSHOTS of grants, policies and
-- function definitions, so that every later migration in this plan can be reversed exactly from data
-- (not from memory). Adds no behaviour; touches no existing object.
--
-- PRECONDITIONS : P0 completed; a Supabase backup taken and a restore drill passed.
-- RISK          : Low. New schema + 3 tables + 6 helper functions. The schema is NOT in the API's exposed
--                 schemas (public only) and all privileges are revoked from anon/authenticated, so PostgREST
--                 cannot reach it. Verify with Q14/Q11-style checks afterwards.
-- ROLLBACK      : 019_secplan_support_rollback.sql (drops the schema). ONLY run it after every later phase
--                 that depends on it has been rolled back, or its rollback data is lost.
-- IDEMPOTENT    : yes (create ... if not exists / create or replace).
-- =====================================================================================================
begin;

create schema if not exists secplan;
revoke all on schema secplan from public, anon, authenticated;

create table if not exists secplan.acl_snapshot (
  id          bigint generated always as identity primary key,
  taken_at    timestamptz not null default now(),
  phase       text   not null,
  object_kind text   not null check (object_kind in ('function', 'table')),
  object_name text   not null,      -- regprocedure text or schema.table
  grantee     text   not null,      -- role name or 'PUBLIC'
  privilege   text   not null
);
create table if not exists secplan.policy_snapshot (
  id          bigint generated always as identity primary key,
  taken_at    timestamptz not null default now(),
  phase       text not null,
  schemaname  text not null,
  tablename   text not null,
  policyname  text not null,
  permissive  text not null,
  roles       text[] not null,
  cmd         text not null,
  qual        text,
  with_check  text
);
create table if not exists secplan.funcdef_snapshot (
  id          bigint generated always as identity primary key,
  taken_at    timestamptz not null default now(),
  phase       text not null,
  signature   text not null,
  definition  text not null         -- output of pg_get_functiondef (includes CREATE OR REPLACE)
);
revoke all on all tables in schema secplan from public, anon, authenticated;

-- Snapshot every ACL of every function and table in `public`. Re-running for the same phase is a no-op
-- (the FIRST snapshot is the one that matters for rollback).
create or replace function secplan.snapshot_acls(p_phase text) returns void
language plpgsql as $$
begin
  if exists (select 1 from secplan.acl_snapshot where phase = p_phase) then
    raise notice 'ACL snapshot for phase % already exists; keeping the original', p_phase;
    return;
  end if;
  insert into secplan.acl_snapshot (phase, object_kind, object_name, grantee, privilege)
  select p_phase, 'function', p.oid::regprocedure::text,
         case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where n.nspname = 'public';
  insert into secplan.acl_snapshot (phase, object_kind, object_name, grantee, privilege)
  select p_phase, 'table', c.oid::regclass::text,
         case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');
end $$;

-- Re-grant everything recorded for a phase (never revokes anything; combine with the phase's own revokes).
create or replace function secplan.restore_acls(p_phase text) returns void
language plpgsql as $$
declare r record;
begin
  for r in select * from secplan.acl_snapshot where phase = p_phase order by id loop
    begin
      if r.object_kind = 'function' then
        execute format('grant execute on function %s to %s', r.object_name, case when r.grantee = 'PUBLIC' then 'PUBLIC' else quote_ident(r.grantee) end);
      else
        execute format('grant %s on %s to %s', r.privilege, r.object_name, case when r.grantee = 'PUBLIC' then 'PUBLIC' else quote_ident(r.grantee) end);
      end if;
    exception when others then
      raise warning 'could not restore % on % to %: %', r.privilege, r.object_name, r.grantee, sqlerrm;
    end;
  end loop;
end $$;

-- Snapshot / restore all policies of one table.
create or replace function secplan.snapshot_policies(p_phase text, p_schema text, p_table text) returns void
language plpgsql as $$
begin
  if exists (select 1 from secplan.policy_snapshot where phase = p_phase and schemaname = p_schema and tablename = p_table) then
    raise notice 'policy snapshot for % %.% already exists; keeping the original', p_phase, p_schema, p_table;
    return;
  end if;
  insert into secplan.policy_snapshot (phase, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check)
  select p_phase, schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies where schemaname = p_schema and tablename = p_table;
end $$;

-- Recreate every captured policy of a table (drops a same-named policy first). Policies created AFTER the
-- snapshot are left alone; drop those in the phase's own rollback file.
create or replace function secplan.restore_policies(p_phase text, p_schema text, p_table text) returns void
language plpgsql as $$
declare r record; v_roles text;
begin
  for r in select * from secplan.policy_snapshot where phase = p_phase and schemaname = p_schema and tablename = p_table order by id loop
    select string_agg(case when x = 'public' then 'public' else quote_ident(x) end, ', ') into v_roles from unnest(r.roles) x;
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format('create policy %I on %I.%I as %s for %s to %s%s%s',
      r.policyname, r.schemaname, r.tablename, lower(r.permissive), r.cmd, v_roles,
      case when r.qual is not null then format(' using (%s)', r.qual) else '' end,
      case when r.with_check is not null then format(' with check (%s)', r.with_check) else '' end);
  end loop;
end $$;

-- Snapshot / restore function bodies (before any phase that replaces a function).
create or replace function secplan.snapshot_function(p_phase text, p_signature regprocedure) returns void
language plpgsql as $$
begin
  if exists (select 1 from secplan.funcdef_snapshot where phase = p_phase and signature = p_signature::text) then return; end if;
  insert into secplan.funcdef_snapshot (phase, signature, definition) values (p_phase, p_signature::text, pg_get_functiondef(p_signature));
end $$;
create or replace function secplan.restore_functions(p_phase text) returns void
language plpgsql as $$
declare r record;
begin
  for r in select * from secplan.funcdef_snapshot where phase = p_phase order by id loop
    execute r.definition;
  end loop;
end $$;

revoke all on all functions in schema secplan from public, anon, authenticated;
commit;
