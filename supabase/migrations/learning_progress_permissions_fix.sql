-- e-Lab incremental fix: authenticated access to Learn progress tables.
-- RLS remains authoritative: users can only access rows allowed by the
-- existing own-progress / own-attempt policies.
grant usage on schema public to authenticated;
grant select, insert, update on table public.learning_progress to authenticated;
grant select, insert on table public.concept_attempts to authenticated;
alter table public.learning_progress enable row level security;
alter table public.concept_attempts enable row level security;
notify pgrst, 'reload schema';
