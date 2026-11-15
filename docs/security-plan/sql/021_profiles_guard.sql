-- =====================================================================================================
-- 021_profiles_guard.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: LOW-MEDIUM
-- Phase P2.  Defence in depth for C-AUTH-02/06/09 (profiles.role / status must never be user-writable).
--
-- Live fact (supplied in docs/SECURITY_AUDIT_SPEC.md): column UPDATE on role/status/email/id is already
-- denied to `authenticated`. This adds a SECOND layer that survives an accidental future GRANT:
--   * BEFORE UPDATE trigger: role/status may change only if the caller has no JWT (SQL editor, service role,
--     Auth admin API) or is_admin() is true. admin_update_profile_role_status (definer, runs for an admin
--     caller so auth.uid() is the admin) keeps working.
--   * REVOKE INSERT on profiles from authenticated, anon (rows are created by handle_new_user only).
--     Verified in the repo: AuthContext.upsertProfile uses .update(), never .insert()/.upsert() (AuthContext.jsx:168-186).
--
-- PRECONDITIONS : 019 applied. Q12 and Q17 reviewed (no other trigger/RPC that changes role/status as a
--                 non-admin session). If an email-sync trigger exists it is not affected (email is not guarded).
-- ROLLBACK      : 021_profiles_guard_rollback.sql
-- IDEMPOTENT    : yes.
-- =====================================================================================================
begin;
select secplan.snapshot_acls('021');

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and auth.uid() is not null          -- a request made with a user JWT
     and not public.is_admin()
  then
    raise exception 'Not authorized to change role or status' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.guard_profile_privileged_columns() from public, anon, authenticated;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

revoke insert on public.profiles from authenticated, anon;
commit;
