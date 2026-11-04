-- e-Lab: Admin-only question secrets read RPC (additive, NOT run)
-- Does not alter any existing table, RLS policy, or prior migration.
-- Grants no direct table access to question_secrets — this function is
-- the only path, and it checks public.is_admin() internally.

begin;

create or replace function public.get_admin_question_secrets(p_question_id text)
returns table (correct_answer_data jsonb, markscheme jsonb, explanation text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
    select qs.correct_answer_data, qs.markscheme, qs.explanation
    from public.question_secrets qs
    where qs.question_id = p_question_id;
end;
$$;

revoke all on function public.get_admin_question_secrets(text) from public;
revoke all on function public.get_admin_question_secrets(text) from anon;
grant execute on function public.get_admin_question_secrets(text) to authenticated;

commit;
