-- Rollback for 020_grants_hardening.sql -- DRAFT / NOT APPLIED.
-- Re-grants every privilege recorded by secplan.snapshot_acls('020'). Grants only; if you also want the exact
-- pre-state you can additionally revoke any grantee not in the snapshot (not needed to restore behaviour).
select secplan.restore_acls('020');
