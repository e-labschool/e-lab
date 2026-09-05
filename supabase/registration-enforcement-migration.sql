-- e-Lab: Backend registration enforcement (OPTIONAL)
--
-- The AuthPage UI already hides the sign-up form and shows "registration
-- currently unavailable" when a role's registration is switched off — but
-- per the brief, that alone is frontend hiding, not real enforcement. A
-- determined user could still call supabase.auth.signUp() directly
-- (bypassing the UI entirely) and create an account while registration
-- is "closed".
--
-- This migration closes that gap by rejecting the signup at the database
-- level — but it does so by adding a BEFORE INSERT trigger on
-- auth.users, which is Supabase-managed schema, not a table this project
-- created. That makes this meaningfully higher-risk than every other
-- migration in this project: a mistake here affects ALL authentication,
-- not just one feature. Recommended: test this in a Supabase staging/
-- branch project first, not directly on production.
--
-- If you'd rather not take that risk right now, the existing UI-level
-- check (AuthPage.jsx, reading platform_settings_public) is a reasonable
-- interim safeguard on its own — most real users go through the UI, not
-- the raw API — and you can apply this later with no code changes needed
-- elsewhere.
create or replace function public.enforce_registration_open()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  settings_row public.platform_settings;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  select * into settings_row from public.platform_settings where id = 1;
  if not found then
    return new; -- settings not configured yet — fail open, don't block all signups
  end if;

  if requested_role = 'student' and not settings_row.allow_student_registration then
    raise exception 'Student registration is currently unavailable.';
  end if;

  if requested_role = 'teacher' and not settings_row.allow_teacher_registration then
    raise exception 'Teacher registration is currently unavailable.';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_registration_open on auth.users;
create trigger enforce_registration_open
  before insert on auth.users
  for each row execute function public.enforce_registration_open();

-- To remove this later: `drop trigger enforce_registration_open on auth.users;`
