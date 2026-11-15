-- =====================================================================================================
-- 060_simulation_data_services.sql   --   DRAFT SKELETON / NOT APPLIED / DATABASE / risk: LOW (empty tables)
-- Phase P6.  Server-side homes for (a) entitlement-gated proprietary datasets and (b) confidential challenge answers.
-- It creates EMPTY structures and two read/check functions. It moves NO data and changes NO engine: an engine only
-- stops carrying a dataset/answer in its public JavaScript when that engine is refactored to call these functions AND
-- the data is deleted from src/ (per-engine work, scoped in plan section P6, optional, after P5).
--
-- HONEST LIMITS: engine code (physics, rendering, data transforms) stays in public bundles. Only data and answers
-- that are NOT needed to render the question can move.  A server round trip cannot be used for per-frame work.
-- Dependencies: 030 (has_entitlement), 040 (content_access_log, security_limit).
-- ROLLBACK: 060_simulation_data_services_rollback.sql    IDEMPOTENT: yes.
-- =====================================================================================================
begin;

create table if not exists public.simulation_datasets (
  id            uuid primary key default gen_random_uuid(),
  simulation_id text not null,
  dataset_key   text not null,
  version       int  not null default 1,
  access_tier   text not null default 'premium' check (access_tier in ('public', 'free', 'premium')),
  payload       jsonb not null,
  created_at    timestamptz not null default now(),
  unique (simulation_id, dataset_key, version)
);
create table if not exists public.simulation_challenge_keys (
  simulation_id text not null,
  challenge_key text not null,
  answer        jsonb not null,
  explanation   jsonb,
  primary key (simulation_id, challenge_key)
);
alter table public.simulation_datasets enable row level security;
alter table public.simulation_challenge_keys enable row level security;
revoke all on public.simulation_datasets, public.simulation_challenge_keys from public, anon, authenticated;
-- No SELECT policy for non-admins on either table: the API can only reach them through the functions below,
-- same model as question_secrets.
grant select, insert, update, delete on public.simulation_datasets, public.simulation_challenge_keys to authenticated;
drop policy if exists "Admins manage simulation datasets" on public.simulation_datasets;
create policy "Admins manage simulation datasets" on public.simulation_datasets for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage challenge keys" on public.simulation_challenge_keys;
create policy "Admins manage challenge keys" on public.simulation_challenge_keys for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_simulation_dataset(p_simulation text, p_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  d record;
  v_uid uuid := auth.uid();
  v_surrogate uuid := md5(p_simulation || ':' || p_key)::uuid;
  v_recent int;
begin
  select access_tier, payload, version into d from public.simulation_datasets
   where simulation_id = p_simulation and dataset_key = p_key order by version desc limit 1;
  if not found or not public.has_entitlement(d.access_tier) then
    return jsonb_build_object('ok', false, 'error', case when public.current_tier() = 'anon' then 'sign_in_required' else 'not_available' end);
  end if;
  if v_uid is not null and public.current_tier() <> 'admin' then
    select count(*) into v_recent from public.content_access_log where user_id = v_uid and kind = 'dataset' and at > now() - interval '1 hour';
    if v_recent >= public.security_limit('dataset_reads_per_hour', 120) then
      insert into public.security_events (user_id, event_type, details) values (v_uid, 'dataset_rate_limited', jsonb_build_object('reads_last_hour', v_recent));
      return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_after_seconds', 300);
    end if;
    insert into public.content_access_log (user_id, page_id, kind) values (v_uid, v_surrogate, 'dataset');
  end if;
  return jsonb_build_object('ok', true, 'version', d.version, 'data', d.payload);
end $$;
revoke all on function public.get_simulation_dataset(text, text) from public;
grant execute on function public.get_simulation_dataset(text, text) to anon, authenticated;   -- anon only succeeds for access_tier='public'

-- Generic exact-match checker. Engines whose grading needs feedback (e.g. Structure Investigation conflict messages)
-- need an Edge Function instead (see plan P6); this covers 'pick the right option' style challenges.
create or replace function public.check_simulation_answer(p_simulation text, p_challenge text, p_answer jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare k record; v_uid uuid := auth.uid(); v_recent int;
begin
  if v_uid is null or not public.is_active_account() then return jsonb_build_object('ok', false, 'error', 'sign_in_required'); end if;
  select count(*) into v_recent from public.content_access_log where user_id = v_uid and kind = 'answer_check' and at > now() - interval '1 minute';
  if v_recent >= public.security_limit('answer_checks_per_minute', 30) then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.content_access_log (user_id, page_id, kind) values (v_uid, md5(p_simulation || ':' || p_challenge)::uuid, 'answer_check');
  select answer, explanation into k from public.simulation_challenge_keys where simulation_id = p_simulation and challenge_key = p_challenge;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- The key is never returned. Explanation is returned only after an answer has been submitted (reveal-after-attempt).
  return jsonb_build_object('ok', true, 'correct', (k.answer = p_answer), 'explanation', k.explanation);
end $$;
revoke all on function public.check_simulation_answer(text, text, jsonb) from public, anon;
grant execute on function public.check_simulation_answer(text, text, jsonb) to authenticated;

insert into public.security_limits (key, value, description) values
  ('dataset_reads_per_hour', 120, 'PROPOSED. get_simulation_dataset calls per account per hour'),
  ('answer_checks_per_minute', 30, 'PROPOSED. check_simulation_answer calls per account per minute')
on conflict (key) do nothing;
commit;
