-- Rollback for 025_export_controls_settings.sql -- DRAFT / NOT APPLIED.
drop function if exists public.resource_downloads_enabled();   -- run AFTER 032_rollback (the 032 policy calls it)
drop view if exists public.platform_export_policy;
alter table public.platform_settings
  drop column if exists allow_resource_downloads,
  drop column if exists allow_teacher_exports;
-- NOTE: if Admin -> Settings toggles were already deployed, roll the app back first or saving settings will fail.
