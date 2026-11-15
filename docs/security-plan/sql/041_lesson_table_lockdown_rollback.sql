-- Rollback for 041_lesson_table_lockdown.sql -- DRAFT / NOT APPLIED. Restores the original direct-read policies.
begin;
select secplan.restore_policies('041', 'public', 'learn_pages');
select secplan.restore_policies('041', 'public', 'learn_blocks');
select secplan.restore_policies('041', 'public', 'learn_check_questions');
select secplan.restore_policies('041', 'public', 'learn_manual_questions');
commit;
