-- Rollback for 021_profiles_guard.sql -- DRAFT / NOT APPLIED.
drop trigger if exists guard_profile_privileged_columns on public.profiles;
drop function if exists public.guard_profile_privileged_columns();
-- Restores INSERT on profiles only if the snapshot shows it existed (it should, per repo schema.sql policy).
do $$
begin
  if exists (select 1 from secplan.acl_snapshot where phase = '021' and object_kind = 'table'
             and object_name = 'profiles' and privilege = 'INSERT' and grantee = 'authenticated') then
    grant insert on public.profiles to authenticated;
  end if;
end $$;
