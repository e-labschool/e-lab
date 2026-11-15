-- Rollback for 080_teacher_profile_metadata.sql -- DRAFT / NOT APPLIED. Export teacher_profiles first (user-entered data).
begin;
drop trigger if exists on_auth_user_created_zz_teacher_profile on auth.users;
drop function if exists public.capture_teacher_profile_from_signup();
drop function if exists public.save_teacher_profile(text, jsonb);
drop function if exists public.validate_teacher_fields(jsonb);
drop view if exists public.teacher_signup_fields;
drop table if exists public.teacher_profiles;
drop table if exists public.teacher_field_options;
drop table if exists public.teacher_field_definitions;
commit;
