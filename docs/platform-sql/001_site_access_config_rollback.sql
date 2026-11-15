-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Rolls back 001_site_access_config.sql.
-- Restores the view to its original six columns, then drops the two columns.  The app falls back to
-- "everything is free" automatically once the columns are gone.
create or replace view public.platform_settings_public as
select
  platform_name,
  tagline,
  allow_student_registration,
  allow_teacher_registration,
  maintenance_mode,
  maintenance_message
from public.platform_settings
where id = 1;
-- (CREATE OR REPLACE VIEW cannot drop columns; if Postgres refuses, run: drop view public.platform_settings_public;
--  then re-create it from supabase/admin-settings-migration.sql and re-run its grant.)

grant select on public.platform_settings_public to anon, authenticated;

alter table public.platform_settings
  drop column if exists premium_enabled,
  drop column if exists require_login_for_simulations;
