-- ============================================================================
-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Never executed by the app or by any script.
-- e-Lab: site access config (two master switches).
--
-- Reuses the existing platform-settings mechanism (supabase/admin-settings-migration.sql):
--   * the singleton table public.platform_settings (id = 1), written only by admins (RLS: is_admin()),
--   * the curated view public.platform_settings_public, readable by anon + authenticated.
--
-- Adds two NON-SECRET display/behaviour flags.  Both default to false = "everything is free", which is exactly
-- today's behaviour, so applying this changes nothing for any user.
--   premium_enabled                 master switch for Premium chrome and gating (UI policy only, see below)
--   require_login_for_simulations   when true, non-demo simulations ask signed-out visitors to log in
--
-- SECURITY NOTE: these flags drive UI behaviour (src/lib/access/accessPolicy.js).  They are NOT enforcement.
-- Protecting actual Premium content needs the database phases in docs/security-plan/ (RLS + entitlement functions).
--
-- The app works BEFORE and AFTER this runs: until the columns exist the public read fails harmlessly and the app
-- falls back to DEFAULT_ACCESS_CONFIG (both false).
-- Apply in the Supabase SQL editor after review; roll back with 001_site_access_config_rollback.sql.
-- ============================================================================

alter table public.platform_settings
  add column if not exists premium_enabled boolean not null default false,
  add column if not exists require_login_for_simulations boolean not null default false;

comment on column public.platform_settings.premium_enabled is
  'Master switch.  false = everything is free and no Premium UI is shown.  UI policy only, not enforcement.';
comment on column public.platform_settings.require_login_for_simulations is
  'When true, non-demo simulations require a signed-in user (UI policy only).';

-- Existing admin RLS on platform_settings ("Admins can read/update platform settings") already covers the new
-- columns: no policy change needed.  Public read goes through the view, extended below.
-- CREATE OR REPLACE VIEW may only append columns, so the existing columns keep their names and order.
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

grant select on public.platform_settings_public to anon, authenticated;
