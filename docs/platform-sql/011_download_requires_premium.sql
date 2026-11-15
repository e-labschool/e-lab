-- ============================================================================
-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Never executed by the app or by any script.
-- e-Lab: third site switch, "Downloads are Premium-only".  Requires 001_site_access_config.sql to have been applied.
--
-- Same mechanism as 001: one extra non-secret boolean on the singleton public.platform_settings row (admin-only
-- writes through the existing is_admin() RLS), exposed to every visitor through platform_settings_public.
--   download_requires_premium  default false = downloads stay free.  It has an effect ONLY while premium_enabled is
--                              also true (src/lib/access/accessPolicy.js checkAction).  Viewing in the browser is never
--                              affected by it.
--
-- UI policy only, NOT enforcement: see docs/RESOURCE_VIEW_DOWNLOAD.md and docs/security-plan/ (phases 025 / 032 for the
-- server-side download switch and entitlement policies).
--
-- The app works BEFORE and AFTER this runs: until the column exists the app reads the two older columns only, treats
-- the switch as off, and /admin/simulations shows the new switch disabled with a notice.
-- CREATE OR REPLACE VIEW may only append columns, so the existing eight keep their names and order.
-- ============================================================================

alter table public.platform_settings
  add column if not exists download_requires_premium boolean not null default false;

comment on column public.platform_settings.download_requires_premium is
  'When true AND premium_enabled, downloading resource files needs Premium (viewing stays free).  UI policy only, not enforcement.';

create or replace view public.platform_settings_public as
select
  platform_name,
  tagline,
  allow_student_registration,
  allow_teacher_registration,
  maintenance_mode,
  maintenance_message,
  premium_enabled,
  require_login_for_simulations,
  download_requires_premium
from public.platform_settings
where id = 1;

grant select on public.platform_settings_public to anon, authenticated;
