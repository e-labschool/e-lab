-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Rolls back 011_download_requires_premium.sql.
-- Restores the view to the eight columns of 001, then drops the column.  The app falls back to "downloads are free".
create or replace view public.platform_settings_public as
select
  platform_name,
  tagline,
  allow_student_registration,
  allow_teacher_registration,
  maintenance_mode,
  maintenance_message,
  premium_enabled,
  require_login_for_simulations
from public.platform_settings
where id = 1;
-- (CREATE OR REPLACE VIEW cannot drop columns; if Postgres refuses, run: drop view public.platform_settings_public;
--  then re-create it as in 001_site_access_config.sql and re-run its grant.)

grant select on public.platform_settings_public to anon, authenticated;

alter table public.platform_settings drop column if exists download_requires_premium;
