-- =====================================================================================================
-- 025_export_controls_settings.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: LOW
-- Phase P1b/P2.  Admin-controlled switches for application-provided download / export controls.
--
-- Defaults are TRUE so applying this changes nothing visible. The app code in draft-code/P1 already treats
-- a missing column/view as "enabled" (current behaviour), so code and SQL can ship in either order. The
-- Admin -> Settings toggles (draft-code/P1/AdminSettings.export-toggles.diff) must ship only AFTER this
-- migration, because AdminSettings.jsx sends the whole settings row back on save (settingsService.js:34-37).
--
-- HONEST SCOPE: allow_resource_downloads is ENFORCED in the database for resource files (via 032's storage policy and
-- resource_downloads_enabled()); the UI merely mirrors it. allow_teacher_exports only hides the Q Builder PDF/Word/Print
-- buttons: those files are generated in the teacher's browser from content the teacher already holds, so it is a UI
-- control, not copy prevention. Nothing here stops a viewer saving what is displayed.
--
-- Uses a SEPARATE small view (not a redefinition of platform_settings_public) so the existing public view,
-- whose live definition has not been read, is not touched.
-- ROLLBACK: 025_export_controls_settings_rollback.sql
-- IDEMPOTENT: yes.
-- =====================================================================================================
begin;
alter table public.platform_settings
  add column if not exists allow_resource_downloads boolean not null default true,
  add column if not exists allow_teacher_exports    boolean not null default true;

create or replace view public.platform_export_policy as
  select allow_resource_downloads, allow_teacher_exports
  from public.platform_settings where id = 1;
-- Owner-rights view on purpose (same model as platform_settings_public): exposes two booleans only.
revoke all on public.platform_export_policy from public, anon;
grant select on public.platform_export_policy to authenticated;

-- Server-side switch for RESOURCE FILES: used by the storage policy in 032, so when an admin turns downloads off the
-- files stop being signable/readable for students and teachers (admins keep their own policy). Defaults to true.
create or replace function public.resource_downloads_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select allow_resource_downloads from public.platform_settings where id = 1), true)
$$;
revoke all on function public.resource_downloads_enabled() from public, anon;
grant execute on function public.resource_downloads_enabled() to authenticated;
commit;
