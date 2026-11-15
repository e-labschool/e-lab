-- DRAFT -- DO NOT RUN WITHOUT APPROVAL.  Rolls back 002_simulation_access.sql.
-- All overrides are lost; the app returns to the catalogue defaults (every simulation free, nothing extra featured).
drop table if exists public.simulation_access;
