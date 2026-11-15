-- Rollback for 060_simulation_data_services.sql -- DRAFT / NOT APPLIED. Export both tables first if they ever held data.
begin;
drop function if exists public.check_simulation_answer(text, text, jsonb);
drop function if exists public.get_simulation_dataset(text, text);
drop table if exists public.simulation_challenge_keys;
drop table if exists public.simulation_datasets;
delete from public.security_limits where key in ('dataset_reads_per_hour', 'answer_checks_per_minute');
commit;
