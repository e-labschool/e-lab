-- ============================================================================
-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Never executed by the app or by any script.
-- e-Lab: per-simulation access overrides (tier + featured flag).
--
-- The app's catalogue (src/data/simulationCatalogue.js) holds the DEFAULT tier ('free') for every simulation.  A row
-- here overrides that default for one simulation and/or marks it featured on the landing page.  No row = catalogue default.
--
-- Contents are non-secret display metadata (which tier a card shows, which simulations the landing page features), so
-- anyone may read; only admins (public.is_admin()) may write.  The tier here is NOT enforcement -- the simulation engines
-- are static front-end code; see docs/PLATFORM_ACCESS_MODEL.md.
--
-- The app works BEFORE and AFTER this runs: until the table exists the read fails harmlessly and catalogue defaults are
-- used; /admin/simulations shows a notice and disables its controls.
-- Depends on: public.is_admin() and public.set_updated_at() (both created by earlier migrations).
-- Roll back with 002_simulation_access_rollback.sql.
-- ============================================================================

create table if not exists public.simulation_access (
  sim_id      text primary key check (char_length(sim_id) between 1 and 80),
  tier        text not null default 'free' check (tier in ('demo', 'free', 'premium')),
  featured    boolean not null default false,
  updated_at  timestamptz not null default now()
);

comment on table public.simulation_access is
  'Per-simulation tier / featured overrides for the catalogue in src/data/simulationCatalogue.js.  Display metadata only.';

alter table public.simulation_access enable row level security;

create policy "Anyone can read simulation access"
  on public.simulation_access for select
  to anon, authenticated
  using (true);

create policy "Admins can insert simulation access"
  on public.simulation_access for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update simulation access"
  on public.simulation_access for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete simulation access"
  on public.simulation_access for delete
  to authenticated
  using (public.is_admin());

drop trigger if exists set_updated_at on public.simulation_access;
create trigger set_updated_at before update on public.simulation_access
  for each row execute function public.set_updated_at();
