-- =====================================================================================================
-- 040_lesson_delivery.sql   --   DRAFT / NOT APPLIED / DATABASE (production) / risk: MEDIUM
-- Phase P4a.  Narrow, authorised, rate-limited delivery of ONE lesson at a time, plus a metadata-only catalogue.
-- ADDITIVE: creates functions/tables only. It does NOT remove any existing read path (that is 041, applied only
-- after the app has been switched to these functions and verified), so the current site keeps working unchanged.
--
-- WHAT IS CHECKED on every get_lesson_page call (server-side, in this order):
--   valid session (anon allowed ONLY for access_tier='public' lessons) -> active account -> publication status ->
--   tier/expiry (has_entitlement) -> audience (teacher-only lessons) -> SL/HL level rule (same meaning as today)
--   -> per-account rate limit -> block-level HL audience filter.
-- WHAT IS RETURNED: the page fields the UI uses (not created_by) and the visible, permitted blocks of that ONE lesson,
--   up to p_limit blocks (default/max 400) with an offset. Never the lesson corpus, never draft/admin-only rows.
--
-- RATE LIMITING / ABUSE DETECTION (privacy-minimal): public.content_access_log stores (user_id, page_id, kind, at) ONLY --
--   no IP, no user-agent, no email, no content. Rows older than 30 days are pruned. Thresholds are rows in
--   public.security_limits (adjustable without redeploy).  THE DEFAULTS BELOW ARE PROPOSALS, NOT MEASURED VALUES.
--   Over-limit calls return {"ok":false,"error":"rate_limited",...} (NOT an exception, so the security_events row
--   that records it is committed).  Anonymous calls cannot be limited per account; limit what the 'public' tier contains.
--
-- PRECONDITIONS : 030 applied (can_read_lesson etc.).  Q28 reviewed (lesson counts) to sanity-check thresholds.
-- RISK          : Medium: replaces the bodies of two helper functions used by get_learn_check_items /
--                 mark_learn_check_answers (their old bodies are snapshotted in secplan.funcdef_snapshot).
-- ROLLBACK      : 040_lesson_delivery_rollback.sql
-- IDEMPOTENT    : yes.
-- =====================================================================================================
begin;

-- ---- 1. tunables ------------------------------------------------------------------------------------
create table if not exists public.security_limits (
  key         text primary key,
  value       int  not null check (value > 0),
  description text
);
insert into public.security_limits (key, value, description) values
  ('lesson_calls_per_minute',      20,  'PROPOSED. get_lesson_page calls per account per minute (burst guard)'),
  ('lesson_distinct_soft_per_hour', 40, 'PROPOSED. distinct lessons per hour that raise an audit event (no block)'),
  ('lesson_distinct_hard_per_hour', 80, 'PROPOSED. distinct lessons per hour after which reads are refused'),
  ('lesson_distinct_hard_per_day', 200, 'PROPOSED. distinct lessons per 24h after which reads are refused'),
  ('lesson_block_page_size',       400, 'max blocks returned per get_lesson_page call')
on conflict (key) do nothing;
alter table public.security_limits enable row level security;
revoke all on public.security_limits from public, anon, authenticated;
grant select on public.security_limits to authenticated;
drop policy if exists "Admins read security limits" on public.security_limits;
create policy "Admins read security limits" on public.security_limits for select to authenticated using (public.is_admin());

create or replace function public.security_limit(p_key text, p_default int) returns int
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from public.security_limits where key = p_key), p_default)
$$;
revoke all on function public.security_limit(text, int) from public, anon, authenticated;

-- ---- 2. privacy-minimal access log + audit events ---------------------------------------------------------------
create table if not exists public.content_access_log (
  id      bigint generated always as identity primary key,
  user_id uuid not null,                       -- pseudonymous account id only; deliberately no FK (survives account deletion rules)
  page_id uuid not null,
  kind    text not null default 'lesson' check (kind in ('lesson', 'denied', 'dataset', 'answer_check')),
  at      timestamptz not null default now()
);
create index if not exists content_access_log_user_at_idx on public.content_access_log (user_id, at desc);
create index if not exists content_access_log_at_idx on public.content_access_log (at);
alter table public.content_access_log enable row level security;
revoke all on public.content_access_log from public, anon, authenticated;       -- no policies: unreachable from the API

create table if not exists public.security_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  user_id    uuid,
  event_type text not null,
  details    jsonb not null default '{}'::jsonb      -- counts and thresholds only; never content or personal data
);
create index if not exists security_events_at_idx on public.security_events (at desc);
alter table public.security_events enable row level security;
revoke all on public.security_events from public, anon, authenticated;
grant select on public.security_events to authenticated;
drop policy if exists "Admins read security events" on public.security_events;
create policy "Admins read security events" on public.security_events for select to authenticated using (public.is_admin());

create or replace function public.prune_content_access_log(p_days int default 30) returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  delete from public.content_access_log where at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics n = row_count;
  delete from public.security_events where at < now() - interval '180 days';
  return n;
end $$;
revoke all on function public.prune_content_access_log(int) from public, anon, authenticated;
-- Schedule (only if Q21 shows pg_cron is available):  select cron.schedule('prune-content-access-log', '17 3 * * *', 'select public.prune_content_access_log(30)');

create or replace function public.admin_access_summary(p_hours int default 24)
returns table (user_id uuid, distinct_lessons bigint, calls bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  return query
    select l.user_id, count(distinct l.page_id), count(*), max(l.at)
      from public.content_access_log l
     where l.at > now() - make_interval(hours => least(greatest(p_hours, 1), 720)) and l.kind = 'lesson'
     group by l.user_id order by 2 desc limit 200;
end $$;
revoke all on function public.admin_access_summary(int) from public, anon;
grant execute on function public.admin_access_summary(int) to authenticated;

-- ---- 3. media reference rewrite hook (identity now; P5 redefines it) ---------------------------------------------
create or replace function public.rewrite_media_refs(p_page_id uuid, p_content jsonb) returns jsonb
language sql stable set search_path = '' as $$ select p_content $$;
revoke all on function public.rewrite_media_refs(uuid, jsonb) from public, anon, authenticated;

-- ---- 4. internal: rate limiter ------------------------------------------------------------------------------------
-- Returns NULL when allowed, otherwise a jsonb error object. Records the read when allowed.
create or replace function public.lesson_rate_check(p_page_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_min int; v_hour_distinct int; v_day_distinct int;
  v_l_min int := public.security_limit('lesson_calls_per_minute', 20);
  v_soft  int := public.security_limit('lesson_distinct_soft_per_hour', 40);
  v_hh    int := public.security_limit('lesson_distinct_hard_per_hour', 80);
  v_hd    int := public.security_limit('lesson_distinct_hard_per_day', 200);
begin
  if v_uid is null or public.current_tier() = 'admin' then return null; end if;
  select count(*) filter (where at > now() - interval '1 minute'),
         count(distinct page_id) filter (where at > now() - interval '1 hour' and page_id <> p_page_id),
         count(distinct page_id) filter (where page_id <> p_page_id)
    into v_min, v_hour_distinct, v_day_distinct
    from public.content_access_log
   where user_id = v_uid and kind = 'lesson' and at > now() - interval '1 day';

  if v_min >= v_l_min or v_hour_distinct >= v_hh or v_day_distinct >= v_hd then
    if not exists (select 1 from public.security_events where user_id = v_uid and event_type = 'lesson_rate_limited' and at > now() - interval '10 minutes') then
      insert into public.security_events (user_id, event_type, details)
      values (v_uid, 'lesson_rate_limited', jsonb_build_object('calls_last_minute', v_min, 'distinct_last_hour', v_hour_distinct, 'distinct_last_day', v_day_distinct));
    end if;
    return jsonb_build_object('ok', false, 'error', 'rate_limited', 'retry_after_seconds', 300);
  end if;

  if v_hour_distinct + 1 >= v_soft
     and not exists (select 1 from public.security_events where user_id = v_uid and event_type = 'lesson_volume_high' and at > now() - interval '1 hour') then
    insert into public.security_events (user_id, event_type, details)
    values (v_uid, 'lesson_volume_high', jsonb_build_object('distinct_last_hour', v_hour_distinct + 1, 'soft_threshold', v_soft));
  end if;

  insert into public.content_access_log (user_id, page_id, kind) values (v_uid, p_page_id, 'lesson');
  return null;
end $$;
revoke all on function public.lesson_rate_check(uuid) from public, anon, authenticated;

-- ---- 5. catalogue (metadata only; never blocks) ---------------------------------------------------------------------
create or replace function public.list_lesson_catalog(p_limit int default 500, p_offset int default 0)
returns table (id uuid, parent_topic text, lesson_code text, syllabus_codes text[], title text, level text,
               display_order int, display_order_sl int, display_order_hl int, access_tier text, locked boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tier text := public.current_tier();
  v_role text; v_level text;
begin
  if v_tier = 'inactive' then return; end if;
  select p.role, p.level into v_role, v_level from public.profiles p where p.id = auth.uid();
  return query
    select lp.id, lp.parent_topic, lp.lesson_code, lp.syllabus_codes, lp.title, lp.level,
           lp.display_order, lp.display_order_sl, lp.display_order_hl, lp.access_tier,
           not public.has_entitlement(lp.access_tier) as locked
      from public.learn_pages lp
     where (lp.status = 'published' or v_tier = 'admin')
       and (v_tier <> 'anon' or lp.access_tier = 'public')                                  -- anon: demo lessons only
       and (lp.audience_scope = 'all' or coalesce(v_role, '') in ('teacher', 'admin'))
       and (coalesce(v_role, 'student') <> 'student' or upper(coalesce(v_level, 'SL')) = 'HL' or upper(coalesce(lp.level, 'SL/HL')) <> 'HL')
     order by lp.parent_topic, lp.display_order, lp.id
     limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end $$;
revoke all on function public.list_lesson_catalog(int, int) from public;
grant execute on function public.list_lesson_catalog(int, int) to anon, authenticated;

-- ---- 6. the lesson itself ----------------------------------------------------------------------------------------------
create or replace function public.get_lesson_page(p_page_id uuid, p_offset int default 0, p_limit int default 400)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_limit  int := least(greatest(coalesce(p_limit, 400), 1), public.security_limit('lesson_block_page_size', 400));
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_tier   text := public.current_tier();
  v_role   text; v_level text;
  lp record; v_rl jsonb; v_blocks jsonb; v_total bigint;
begin
  -- can_read_lesson() is false for unknown ids too, so existence is never revealed to someone who may not read it.
  if not public.can_read_lesson(p_page_id) then
    if auth.uid() is not null and v_tier <> 'inactive' and exists (select 1 from public.learn_pages where id = p_page_id) then
      insert into public.content_access_log (user_id, page_id, kind) values (auth.uid(), p_page_id, 'denied');
    end if;
    return jsonb_build_object('ok', false, 'error', case when v_tier = 'anon' then 'sign_in_required'
                                                          when v_tier = 'inactive' then 'account_inactive'
                                                          else 'not_available' end);
  end if;

  if v_offset = 0 then                                   -- count a lesson once, not once per block page
    v_rl := public.lesson_rate_check(p_page_id);
    if v_rl is not null then return v_rl; end if;
  end if;

  select role, level into v_role, v_level from public.profiles where id = auth.uid();
  select id, parent_topic, lesson_code, syllabus_codes, title, level, access_tier into lp from public.learn_pages where id = p_page_id;

  with permitted as (
    select b.id, b.page_id, b.block_type, public.rewrite_media_refs(b.page_id, b.content) as content, b.position, b.visible,
           b.created_at, b.updated_at,
           row_number() over (order by b.position, b.id) as rn
      from public.learn_blocks b
     where b.page_id = p_page_id and b.visible
       and not (coalesce(v_role, 'student') = 'student' and upper(coalesce(v_level, 'SL')) <> 'HL'
                and lower(coalesce(b.content ->> 'audience', 'both')) = 'hl')
  )
  select coalesce(jsonb_agg(to_jsonb(p) - 'rn' order by p.rn) filter (where p.rn > v_offset and p.rn <= v_offset + v_limit), '[]'::jsonb),
         count(*)
    into v_blocks, v_total
    from permitted p;

  return jsonb_build_object(
    'ok', true,
    'page', jsonb_build_object('id', lp.id, 'parent_topic', lp.parent_topic, 'lesson_code', lp.lesson_code,
                               'syllabus_codes', lp.syllabus_codes, 'title', lp.title, 'level', lp.level, 'access_tier', lp.access_tier),
    'blocks', v_blocks,
    'total_blocks', v_total,
    'has_more', v_total > v_offset + v_limit,
    'next_offset', v_offset + v_limit);
end $$;
revoke all on function public.get_lesson_page(uuid, int, int) from public;
grant execute on function public.get_lesson_page(uuid, int, int) to anon, authenticated;

-- ---- 7. keep the Learn-check RPCs on the same rule (bodies replaced; old bodies snapshotted) ----------------------------
select secplan.snapshot_function('040', 'public.can_access_learn_page_for_current_user(uuid)'::regprocedure);
select secplan.snapshot_function('040', 'public.can_access_learn_check_for_current_user(uuid)'::regprocedure);

create or replace function public.can_access_learn_page_for_current_user(p_page_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_read_lesson(p_page_id)
     and exists (select 1 from public.learn_pages lp where lp.id = p_page_id and lp.status = 'published')   -- unchanged: drafts never markable
$$;
create or replace function public.can_access_learn_check_for_current_user(p_page_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_access_learn_page_for_current_user(p_page_id)
    and not exists (
      select 1 from public.learn_blocks b join public.profiles p on p.id = auth.uid()
       where b.page_id = p_page_id and b.block_type = 'check_understanding' and b.visible = true
         and p.role = 'student' and upper(coalesce(p.level, 'SL')) <> 'HL'
         and lower(coalesce(b.content ->> 'audience', 'both')) = 'hl')
$$;
revoke all on function public.can_access_learn_page_for_current_user(uuid), public.can_access_learn_check_for_current_user(uuid) from public, anon;
grant execute on function public.can_access_learn_page_for_current_user(uuid), public.can_access_learn_check_for_current_user(uuid) to authenticated;

commit;
