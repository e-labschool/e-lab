-- Rollback for 019_secplan_support.sql -- DRAFT / NOT APPLIED.
-- DANGER: this deletes the snapshots every other rollback depends on. Run it LAST, after all other rollbacks.
-- Before running, export the snapshot tables:  select * from secplan.acl_snapshot;  etc. and store them offline.
drop schema if exists secplan cascade;
