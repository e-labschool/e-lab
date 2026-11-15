-- =====================================================================================================
-- staging_acceptance_tests.sql   --   DRAFT / NOT APPLIED to any real database
-- Self-cleaning acceptance tests for the phases in docs/security-plan/SECURITY_IMPLEMENTATION_PLAN.md.
--
-- WHERE TO RUN : a Supabase STAGING project (branch or separate project) as the postgres role in the SQL editor,
--                AFTER the phase being tested has been applied there. NEVER on production.
-- SAFETY       : every section is  begin; ... rollback;  -- it seeds fake users/lessons inside the transaction and
--                rolls everything back, so no row survives. It inserts into auth.users directly (test emails use the
--                reserved .invalid TLD). If your staging project rejects that insert, create the 9 test users via the
--                dashboard instead and replace the UUIDs in pg_temp.seed().
-- OUTPUT       : one NOTICE per check ('PASS Tn.m ...'); a failed check raises an exception and aborts that section.
-- NOT EXECUTED BY THE AUTHOR against Supabase. It WAS executed against a throwaway local PostgreSQL 16 with stub
-- auth/storage schemas (see plan, 'What was and was not verified').  Local success does not prove Supabase behaviour
-- (PostgREST error mapping, Storage API signing and listing, Auth hooks, JWT claim shapes) -- sections marked [API]
-- list manual steps for exactly those.
-- =====================================================================================================

-- ---- seed helpers (session-level; survive across the sections below) ----------------------------------------------
create or replace function pg_temp.as_user(p_uid uuid, p_aal text default 'aal1') returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated', 'aal', p_aal)::text, true);
  execute 'set local role authenticated';
end $f$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
end $f$;

create or replace function pg_temp.seed() returns void language plpgsql as $f$
declare
  u_admin   uuid := 'a0000000-0000-0000-0000-000000000001'; u_sl      uuid := 'a0000000-0000-0000-0000-000000000002';
  u_hl      uuid := 'a0000000-0000-0000-0000-000000000003'; u_teacher uuid := 'a0000000-0000-0000-0000-000000000004';
  u_susp    uuid := 'a0000000-0000-0000-0000-000000000005'; u_prem    uuid := 'a0000000-0000-0000-0000-000000000006';
  u_expired uuid := 'a0000000-0000-0000-0000-000000000007'; u_sched   uuid := 'a0000000-0000-0000-0000-000000000008';
  u_school  uuid := 'a0000000-0000-0000-0000-000000000009';
  l_public uuid := 'b0000000-0000-0000-0000-000000000001'; l_free uuid := 'b0000000-0000-0000-0000-000000000002';
  l_prem   uuid := 'b0000000-0000-0000-0000-000000000003'; l_hl   uuid := 'b0000000-0000-0000-0000-000000000004';
  l_draft  uuid := 'b0000000-0000-0000-0000-000000000005'; l_teach uuid := 'b0000000-0000-0000-0000-000000000006';
  org uuid := 'c0000000-0000-0000-0000-000000000001';
  rec record;
begin
  for rec in select * from (values
      (u_admin, 'admin', 'student', 'active'), (u_sl, 'student', 'SL', 'active'), (u_hl, 'student', 'HL', 'active'),
      (u_teacher, 'teacher', null, 'active'), (u_susp, 'student', 'HL', 'suspended'), (u_prem, 'student', 'SL', 'active'),
      (u_expired, 'student', 'SL', 'active'), (u_sched, 'student', 'SL', 'active'), (u_school, 'teacher', null, 'active')
    ) v(id, role, level, status) loop
    insert into auth.users (id, email, raw_user_meta_data) values (rec.id, 'sec-plan-test-' || right(rec.id::text, 2) || '@example.invalid', jsonb_build_object('full_name', 'Test user', 'role', 'student')) on conflict (id) do nothing;
    insert into public.profiles (id, email, full_name, role, level, status)
    values (rec.id, 'sec-plan-test-' || right(rec.id::text, 2) || '@example.invalid', 'Test ' || rec.role, case when rec.role = 'admin' then 'student' else rec.role end, rec.level, rec.status)
    on conflict (id) do update set role = excluded.role, level = excluded.level, status = excluded.status;
  end loop;
  update public.profiles set role = 'admin' where id = u_admin;     -- postgres session: guard trigger allows (no JWT)

  insert into public.learn_pages (id, parent_topic, lesson_code, title, level, status, access_tier, audience_scope) values
    (l_public, 'T1', 'p', 'Public demo', 'SL/HL', 'published', 'public', 'all'),
    (l_free,   'T1', 'f', 'Free lesson', 'SL/HL', 'published', 'free', 'all'),
    (l_prem,   'T1', 'm', 'Premium lesson', 'SL/HL', 'published', 'premium', 'all'),
    (l_hl,     'T1', 'h', 'HL only lesson', 'HL', 'published', 'free', 'all'),
    (l_draft,  'T1', 'd', 'Draft lesson', 'SL/HL', 'draft', 'free', 'all'),
    (l_teach,  'T1', 't', 'Teacher-only lesson', 'SL/HL', 'published', 'free', 'teacher');
  insert into public.learn_blocks (page_id, block_type, content, position) values
    (l_free, 'rich_text', jsonb_build_object('html', '<p>shared</p>', 'imageUrl', 'https://ref.supabase.co/storage/v1/object/public/learn-media/lessons/' || l_free || '/b1/a.png'), 0),
    (l_free, 'rich_text', jsonb_build_object('html', '<p>HL extra</p>', 'audience', 'hl'), 1),
    (l_prem, 'rich_text', jsonb_build_object('html', '<p>premium</p>', 'imageUrl', 'https://ref.supabase.co/storage/v1/object/public/learn-media/lessons/' || l_prem || '/b1/p.png'), 0),
    (l_public, 'rich_text', jsonb_build_object('html', '<p>demo</p>'), 0),
    (l_hl, 'rich_text', jsonb_build_object('html', '<p>hl</p>'), 0);
  -- entitlement fixtures via the EXISTING admin table (exercises the user_access -> entitlements bridge)
  insert into public.user_access (user_id, plan, starts_at, expires_at) values
    (u_prem, 'premium', now() - interval '1 day', now() + interval '30 days'),
    (u_expired, 'premium', now() - interval '60 days', now() - interval '1 day'),
    (u_sched, 'premium', now() + interval '7 days', now() + interval '60 days');
  insert into public.organizations (id, name) values (org, 'Test School');
  insert into public.organization_members (organization_id, user_id) values (org, u_school);
  insert into public.organization_entitlements (organization_id, expires_at) values (org, now() + interval '90 days');
end $f$;

-- =====================================================================================================
-- P2  grants / profiles guard / question-media   (run after 019,020,021,022)
-- =====================================================================================================
begin;
select pg_temp.seed();
do $$
declare n int; ok boolean; threw boolean;
begin
  -- T2.1 anon cannot read lesson tables or profiles
  perform pg_temp.as_anon();
  begin select count(*) into n from public.learn_pages; threw := false; exception when insufficient_privilege then threw := true; end;
  reset role; assert threw, 'T2.1 anon must be denied on learn_pages (got rows or no error)'; raise notice 'PASS T2.1 anon denied on learn_pages';
  -- T2.2 anon CAN read the curated settings view
  perform pg_temp.as_anon();
  select count(*) into n from public.platform_settings_public; reset role;
  raise notice 'PASS T2.2 anon can read platform_settings_public (rows=%)', n;
  -- T2.3 anon has no EXECUTE on definer RPCs, but keeps is_admin (needed inside policies)
  assert not has_function_privilege('anon', 'public.publish_learn_page(uuid)', 'EXECUTE'), 'T2.3 anon must not execute publish_learn_page';
  assert has_function_privilege('anon', 'public.is_admin()', 'EXECUTE'), 'T2.3 anon keeps is_admin (policy evaluation)';
  assert has_function_privilege('authenticated', 'public.mark_learn_check_answers(uuid,jsonb)', 'EXECUTE'), 'T2.3 authenticated keeps marking RPC';
  raise notice 'PASS T2.3 function grants';
  -- T2.4 trigger functions are not callable through the API
  assert not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'), 'T2.4 handle_new_user must not be API-callable';
  raise notice 'PASS T2.4 trigger functions not executable by authenticated';
  -- T2.5 a student cannot change own role/status (guard trigger holds even if a column GRANT is added by mistake)
  grant update (role, status) on public.profiles to authenticated;                    -- simulate the accident
  perform pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
  begin update public.profiles set role = 'admin' where id = 'a0000000-0000-0000-0000-000000000002'; threw := false;
  exception when others then threw := true; end;
  reset role; assert threw, 'T2.5 student must not be able to set role=admin'; raise notice 'PASS T2.5 role escalation blocked by guard';
  perform pg_temp.as_user('a0000000-0000-0000-0000-000000000002');
  update public.profiles set school = 'Edited School' where id = 'a0000000-0000-0000-0000-000000000002'; get diagnostics n = row_count; reset role;
  assert n = 1, 'T2.5b student may still edit own school'; raise notice 'PASS T2.5b ordinary profile edits still work';
  -- T2.6 admin RPC path still changes role (guard allows admins)
  perform pg_temp.as_user('a0000000-0000-0000-0000-000000000001');
  update public.profiles set status = 'suspended' where id = 'a0000000-0000-0000-0000-000000000009'; get diagnostics n = row_count; reset role;
  raise notice 'PASS T2.6 admin may update status (rows=%)', n;
  -- T2.7 profiles INSERT revoked
  assert not has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'T2.7 authenticated must not INSERT profiles';
  raise notice 'PASS T2.7 profiles INSERT revoked';
end $$;
-- [API] T2.8 signup still works: create a TEST user through the app/Auth API on staging and confirm a profiles row appears (proves
--       revoking EXECUTE on trigger functions did not break on_auth_user_created).  T2.9 fetch an existing question-media public
--       URL with curl BEFORE and AFTER 022: HTTP 200 both times; list the bucket as anon: denied.
rollback;

-- =====================================================================================================
-- P3  entitlements   (run after 030, 032)
-- =====================================================================================================
begin;
select pg_temp.seed();
do $$
declare t text; ok boolean; n int;
  u_sl uuid := 'a0000000-0000-0000-0000-000000000002'; u_prem uuid := 'a0000000-0000-0000-0000-000000000006';
  u_exp uuid := 'a0000000-0000-0000-0000-000000000007'; u_sched uuid := 'a0000000-0000-0000-0000-000000000008';
  u_susp uuid := 'a0000000-0000-0000-0000-000000000005'; u_teacher uuid := 'a0000000-0000-0000-0000-000000000004';
  u_school uuid := 'a0000000-0000-0000-0000-000000000009'; u_admin uuid := 'a0000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.as_user(u_prem);    select public.current_tier() into t; reset role; assert t = 'premium', 'T3.1 active premium -> premium, got ' || t;
  perform pg_temp.as_user(u_exp);     select public.current_tier() into t; reset role; assert t = 'free',    'T3.2 EXPIRED premium -> free, got ' || t;
  perform pg_temp.as_user(u_sched);   select public.current_tier() into t; reset role; assert t = 'free',    'T3.3 SCHEDULED premium -> free until start, got ' || t;
  perform pg_temp.as_user(u_susp);    select public.current_tier() into t; reset role; assert t = 'inactive','T3.4 suspended -> inactive, got ' || t;
  perform pg_temp.as_user(u_teacher); select public.current_tier() into t; reset role; assert t = 'free',    'T3.5 TEACHER ROLE ALONE -> free (no premium), got ' || t;
  perform pg_temp.as_user(u_school);  select public.current_tier() into t; reset role; assert t = 'school',  'T3.6 teacher in entitled org -> school, got ' || t;
  perform pg_temp.as_user(u_admin);   select public.current_tier() into t; reset role; assert t = 'admin',   'T3.7 admin, got ' || t;
  perform pg_temp.as_anon();          select public.current_tier() into t; reset role; assert t = 'anon',    'T3.8 anon, got ' || t;
  raise notice 'PASS T3.1-3.8 tier resolution';

  -- T3.9 revocation is immediate; T3.10 expiry is evaluated per call (move expiry into the past inside the transaction)
  update public.entitlements set revoked_at = now() where user_id = u_prem;
  perform pg_temp.as_user(u_prem); select public.current_tier() into t; reset role; assert t = 'free', 'T3.9 revoked -> free';
  update public.entitlements set revoked_at = null, expires_at = now() - interval '1 second' where user_id = u_prem;
  perform pg_temp.as_user(u_prem); select public.current_tier() into t; reset role; assert t = 'free', 'T3.10 expiry takes effect immediately';
  raise notice 'PASS T3.9-3.10 revocation and expiry';

  -- T3.11 users cannot write entitlements, directly or via user_access
  perform pg_temp.as_user(u_sl);
  begin insert into public.entitlements (user_id, tier) values (u_sl, 'premium'); ok := false; exception when others then ok := true; end;
  reset role; assert ok, 'T3.11 student must not insert entitlements';
  perform pg_temp.as_user(u_sl);
  begin insert into public.user_access (user_id, plan) values (u_sl, 'premium'); ok := false; exception when others then ok := true; end;
  reset role; assert ok, 'T3.11b student must not insert user_access';
  perform pg_temp.as_user(u_sl);
  begin perform public.admin_grant_entitlement(u_sl, 'premium', now() + interval '1 day'); ok := false; exception when others then ok := true; end;
  reset role; assert ok, 'T3.11c student must not call admin_grant_entitlement';
  raise notice 'PASS T3.11 entitlement writes are admin-only';

  -- T3.12 user_metadata is ignored: a JWT claiming premium in user_metadata changes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', u_sl, 'role', 'authenticated', 'user_metadata', json_build_object('plan', 'premium', 'role', 'admin'))::text, true);
  execute 'set local role authenticated'; select public.current_tier() into t; reset role;
  assert t = 'free', 'T3.12 user_metadata must not influence tier'; raise notice 'PASS T3.12 metadata ignored';

  -- T3.13 lesson matrix via can_read_lesson
  perform pg_temp.as_user(u_sl);
  assert     public.can_read_lesson('b0000000-0000-0000-0000-000000000002'), 'T3.13 free student reads free lesson';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000003'), 'T3.13 free student blocked from premium lesson';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000004'), 'T3.13 SL student blocked from HL-only lesson';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000005'), 'T3.13 draft not readable';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000006'), 'T3.13 teacher-only lesson hidden from student';
  reset role;
  perform pg_temp.as_user(u_teacher);
  assert     public.can_read_lesson('b0000000-0000-0000-0000-000000000004'), 'T3.14 teacher sees HL lesson (existing rule kept)';
  assert     public.can_read_lesson('b0000000-0000-0000-0000-000000000006'), 'T3.14 teacher sees teacher-only lesson';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000003'), 'T3.14 TEACHER does not get premium lesson';
  reset role;
  update public.entitlements set expires_at = now() + interval '1 day' where user_id = u_prem;
  perform pg_temp.as_user(u_prem);
  assert public.can_read_lesson('b0000000-0000-0000-0000-000000000003'), 'T3.15 premium reads premium lesson'; reset role;
  perform pg_temp.as_user(u_school);
  assert public.can_read_lesson('b0000000-0000-0000-0000-000000000003'), 'T3.16 school member reads premium lesson'; reset role;
  perform pg_temp.as_anon();
  assert     public.can_read_lesson('b0000000-0000-0000-0000-000000000001'), 'T3.17 anon reads public demo';
  assert not public.can_read_lesson('b0000000-0000-0000-0000-000000000002'), 'T3.17 anon blocked from free lesson'; reset role;
  raise notice 'PASS T3.13-3.17 lesson access matrix';
end $$;
rollback;

begin;                                                    -- resources: teacher role vs premium vs school-specific
select pg_temp.seed();
insert into public.resources (id, title, resource_type, category, audience, status, access_tier, is_locked, file_path, organization_id)
select gen_random_uuid(), x.title, 'worksheet', 'Other', 'teacher', 'published', x.tier, false, x.path, x.org
from (values ('free teacher res','free','t/free.pdf', null::uuid), ('premium teacher res','premium','t/prem.pdf', null::uuid),
             ('school-only res','free','t/school.pdf','c0000000-0000-0000-0000-000000000001'::uuid)) x(title, tier, path, org);
do $$
declare n int; u_t uuid := 'a0000000-0000-0000-0000-000000000004'; u_s uuid := 'a0000000-0000-0000-0000-000000000009';
begin
  perform pg_temp.as_user(u_t);  select count(*) into n from public.resources where status = 'published'; reset role;
  assert n = 1, 'T3.18 plain teacher sees ONLY the free teacher resource, saw ' || n; raise notice 'PASS T3.18 teacher role != premium != school';
  perform pg_temp.as_user(u_s);  select count(*) into n from public.resources where status = 'published'; reset role;
  assert n = 3, 'T3.19 teacher in entitled org sees free + premium(via school) + school-only, saw ' || n; raise notice 'PASS T3.19 school entitlement';
end $$;
-- T3.20 admin download switch is enforced at the STORAGE layer (needs 025 + 032)
insert into storage.buckets (id, name, public) values ('resources', 'resources', false) on conflict do nothing;
insert into storage.objects (bucket_id, name) values ('resources', 't/free.pdf');
do $$
declare n int; u_t uuid := 'a0000000-0000-0000-0000-000000000004';
begin
  perform pg_temp.as_user(u_t); select count(*) into n from storage.objects where bucket_id = 'resources'; reset role;
  assert n = 1, 'T3.20 downloads enabled (default): teacher can read the free teacher file, saw ' || n;
  update public.platform_settings set allow_resource_downloads = false where id = 1;
  perform pg_temp.as_user(u_t); select count(*) into n from storage.objects where bucket_id = 'resources'; reset role;
  assert n = 0, 'T3.20b downloads switched off: file unreadable for teachers, saw ' || n;
  raise notice 'PASS T3.20 admin download switch enforced in storage policy';
end $$;
rollback;

-- =====================================================================================================
-- P4  lesson delivery   (run after 040;  the "direct reads are closed" checks need 041)
-- =====================================================================================================
begin;
select pg_temp.seed();
do $$
declare r jsonb; n int; u_sl uuid := 'a0000000-0000-0000-0000-000000000002'; u_hl uuid := 'a0000000-0000-0000-0000-000000000003';
  u_t uuid := 'a0000000-0000-0000-0000-000000000004'; u_susp uuid := 'a0000000-0000-0000-0000-000000000005';
  u_prem uuid := 'a0000000-0000-0000-0000-000000000006'; u_admin uuid := 'a0000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.as_anon();
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000001'); assert (r->>'ok')::boolean, 'T4.1 anon reads public demo'; 
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002'); assert r->>'error' = 'sign_in_required', 'T4.2 anon free lesson -> sign_in_required: ' || r::text;
  reset role;
  perform pg_temp.as_user(u_sl);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002');
  assert (r->>'ok')::boolean and jsonb_array_length(r->'blocks') = 1, 'T4.3 SL student gets 1 block (HL-audience block removed): ' || r::text;
  assert not (r->'page' ? 'created_by'), 'T4.3b created_by not returned';
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000003'); assert r->>'error' = 'not_available', 'T4.4 free student, premium lesson';
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000004'); assert r->>'error' = 'not_available', 'T4.5 SL student, HL lesson';
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000005'); assert r->>'error' = 'not_available', 'T4.6 draft lesson';
  r := public.get_lesson_page('b0000000-0000-0000-0000-00000000ffff'); assert r->>'error' = 'not_available', 'T4.6b unknown id looks identical to forbidden';
  reset role;
  perform pg_temp.as_user(u_hl);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002'); assert jsonb_array_length(r->'blocks') = 2, 'T4.7 HL student gets both blocks';
  reset role;
  perform pg_temp.as_user(u_susp);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002'); assert r->>'error' = 'account_inactive', 'T4.8 suspended account refused SERVER-SIDE';
  reset role;
  perform pg_temp.as_user(u_t);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000006'); assert (r->>'ok')::boolean, 'T4.9 teacher reads teacher-only lesson';
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000003'); assert r->>'error' = 'not_available', 'T4.9b teacher w/o entitlement: no premium';
  reset role;
  perform pg_temp.as_user(u_prem);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000003'); assert (r->>'ok')::boolean, 'T4.10 premium reads premium lesson';
  reset role;
  raise notice 'PASS T4.1-4.10 authorisation matrix';

  -- T4.11 catalogue: no content, locked flag, HL hidden from SL, anon sees only demo
  perform pg_temp.as_user(u_sl);
  select count(*) into n from public.list_lesson_catalog(); assert n = 3, 'T4.11 SL catalogue = public+free+premium(locked), got ' || n;
  assert (select locked from public.list_lesson_catalog() where id = 'b0000000-0000-0000-0000-000000000003'), 'T4.11b premium lesson shown as locked';
  reset role;
  perform pg_temp.as_anon(); select count(*) into n from public.list_lesson_catalog(); reset role; assert n = 1, 'T4.11c anon catalogue = demo only, got ' || n;
  raise notice 'PASS T4.11 catalogue';

  -- T4.12 rate limit + audit event (thresholds lowered INSIDE this transaction only)
  update public.security_limits set value = 3 where key = 'lesson_distinct_hard_per_hour';
  insert into public.learn_pages (id, parent_topic, lesson_code, title, status) select ('d0000000-0000-0000-0000-00000000000' || g)::uuid, 'RL', 'x' || g, 'rl' || g, 'published' from generate_series(1, 5) g;
  perform pg_temp.as_user(u_sl);
  for n in 1..5 loop r := public.get_lesson_page(('d0000000-0000-0000-0000-00000000000' || n)::uuid); exit when r->>'error' = 'rate_limited'; end loop;
  reset role;
  assert r->>'error' = 'rate_limited', 'T4.12 5 distinct lessons with limit 3 must rate-limit, last=' || r::text;
  assert exists (select 1 from public.security_events where user_id = u_sl and event_type = 'lesson_rate_limited'), 'T4.12b event committed with the refusal';
  assert not exists (select 1 from information_schema.columns where table_name = 'content_access_log' and column_name in ('ip', 'user_agent', 'email')), 'T4.12c log has no personal columns';
  raise notice 'PASS T4.12 rate limit + audit event (privacy-minimal log)';
  -- T4.13 admins are not rate limited; logs/events unreadable by students
  perform pg_temp.as_user(u_sl);
  begin select count(*) into n from public.content_access_log; assert false, 'T4.13 student read access log'; exception when insufficient_privilege then null; end;
  select count(*) into n from public.security_events; reset role; assert n = 0, 'T4.13b student sees no security events';
  raise notice 'PASS T4.13 logs private';

  -- T4.14 (needs 041) direct table reads are closed for students, open for admin
  if not exists (select 1 from pg_policies where tablename = 'learn_blocks' and cmd = 'SELECT' and qual not like '%is_admin%') then
    perform pg_temp.as_user(u_sl); select count(*) into n from public.learn_blocks; reset role; assert n = 0, 'T4.14 student direct learn_blocks = 0, got ' || n;
    perform pg_temp.as_user(u_sl); select count(*) into n from public.learn_pages;  reset role; assert n = 0, 'T4.14b student direct learn_pages = 0, got ' || n;
    perform pg_temp.as_user(u_admin); select count(*) into n from public.learn_blocks; reset role; assert n > 0, 'T4.14c admin still reads blocks';
    raise notice 'PASS T4.14 direct reads closed (041 applied)';
  else raise notice 'SKIP T4.14 (041 not applied yet)'; end if;
end $$;
rollback;
-- [API] T4.15 PostgREST: call /rest/v1/rpc/get_lesson_page as a free test user for a premium id -> HTTP 200 body {"ok":false,"error":"not_available"};
--       as anon for a free lesson -> sign_in_required.  T4.16 with 041 applied: GET /rest/v1/learn_blocks?select=* with the user's JWT -> [] ;
--       T4.17 the full Learn flow in the app (sidebar, next/prev, check-your-understanding, syllabus links) with 041 applied.

-- =====================================================================================================
-- P5  private media   (run after 050)
-- =====================================================================================================
begin;
select pg_temp.seed();
insert into storage.buckets (id, name, public) values ('learn-media-private', 'learn-media-private', false) on conflict do nothing;
insert into storage.objects (bucket_id, name) values
  ('learn-media-private', 'lessons/b0000000-0000-0000-0000-000000000003/b1/p.png'),
  ('learn-media-private', 'lessons/b0000000-0000-0000-0000-000000000002/b1/a.png'),
  ('learn-media-private', 'lessons/not-a-uuid/x.png');
do $$
declare n int; r jsonb; ok boolean; u_sl uuid := 'a0000000-0000-0000-0000-000000000002'; u_prem uuid := 'a0000000-0000-0000-0000-000000000006'; u_admin uuid := 'a0000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.as_user(u_sl);
  select count(*) into n from storage.objects where bucket_id = 'learn-media-private'; reset role;
  assert n = 1, 'T5.1 free student sees ONLY free-lesson objects in the private bucket (listing is entitlement-scoped), saw ' || n;
  perform pg_temp.as_user(u_prem);
  select count(*) into n from storage.objects where bucket_id = 'learn-media-private'; reset role;
  assert n = 2, 'T5.2 premium student sees free+premium lesson objects (never the malformed path), saw ' || n;
  update public.entitlements set expires_at = now() - interval '1 second' where user_id = u_prem;
  perform pg_temp.as_user(u_prem); select count(*) into n from storage.objects where bucket_id = 'learn-media-private'; reset role;
  assert n = 1, 'T5.3 EXPIRED premium loses storage access to premium media immediately, saw ' || n;
  perform pg_temp.as_anon(); select count(*) into n from storage.objects where bucket_id = 'learn-media-private'; reset role;
  assert n = 0, 'T5.4 anon sees nothing in the private bucket';
  raise notice 'PASS T5.1-5.4 storage policies (expiry enforced at storage layer)';

  -- T5.5 flipping a lesson to private requires every referenced image to exist in the private bucket
  delete from storage.objects where name = 'lessons/b0000000-0000-0000-0000-000000000003/b1/p.png';     -- simulate a missing copy (done as postgres)
  perform pg_temp.as_user(u_admin);
  begin perform public.admin_set_lesson_media_mode('b0000000-0000-0000-0000-000000000002', 'private'); ok := true; exception when others then ok := false; end;
  assert ok, 'T5.5 lesson with copied image can be flipped';
  begin perform public.admin_set_lesson_media_mode('b0000000-0000-0000-0000-000000000003', 'private'); ok := true; exception when others then ok := false; end;
  reset role; assert not ok, 'T5.5b flip refused when a copy is missing';
  perform pg_temp.as_user(u_sl);
  begin perform public.admin_set_lesson_media_mode('b0000000-0000-0000-0000-000000000002', 'public'); ok := true; exception when others then ok := false; end;
  reset role; assert not ok, 'T5.5c student cannot flip';
  raise notice 'PASS T5.5 per-lesson cut-over guard';

  -- T5.6 rewritten refs: private lesson JSON carries storage:// refs and NO public URL; public lesson unchanged
  perform pg_temp.as_user(u_sl);
  r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002'); reset role;
  assert r::text like '%storage://learn-media-private/lessons/b0000000-0000-0000-0000-000000000002/b1/a.png%', 'T5.6 private lesson returns storage:// ref: ' || r::text;
  assert r::text not like '%/object/public/%', 'T5.6b no public URL in private lesson JSON';
  update public.learn_pages set media_mode = 'public' where id = 'b0000000-0000-0000-0000-000000000002';
  perform pg_temp.as_user(u_sl); r := public.get_lesson_page('b0000000-0000-0000-0000-000000000002'); reset role;
  assert r::text like '%/object/public/learn-media/%', 'T5.7 rollback to public mode restores original URLs (instant)';
  raise notice 'PASS T5.6-5.7 server-side rewrite and instant rollback';
end $$;
rollback;
-- [API] T5.8 with a real private-bucket test image: createSignedUrl(ttl 60) as an entitled test user -> 200; wait 70 s -> 400/403;
--       as a free user for a premium path -> error; list('lessons') as anon -> []; compare every image of every migrated lesson
--       (script draft-code/scripts/compare-lesson-images.mjs) before/after.

-- =====================================================================================================
-- P7 admin MFA flag (run after 070)      P8 teacher profile (run after 080)
-- =====================================================================================================
begin;
select pg_temp.seed();
do $$
declare ok boolean; u_admin uuid := 'a0000000-0000-0000-0000-000000000001';
begin
  perform pg_temp.as_user(u_admin, 'aal1'); ok := public.is_admin(); reset role; assert ok, 'T7.1 flag absent: aal1 admin still admin (no behaviour change)';
  insert into public.security_limits (key, value) values ('require_admin_mfa', 1);
  perform pg_temp.as_user(u_admin, 'aal1'); ok := public.is_admin(); reset role; assert not ok, 'T7.2 flag on: aal1 admin refused';
  perform pg_temp.as_user(u_admin, 'aal2'); ok := public.is_admin(); reset role; assert ok, 'T7.3 flag on: aal2 admin allowed';
  delete from public.security_limits where key = 'require_admin_mfa';
  perform pg_temp.as_user(u_admin, 'aal1'); ok := public.is_admin(); reset role; assert ok, 'T7.4 flag removed: instant rollback';
  raise notice 'PASS T7 MFA flag';
  update public.profiles set role = 'teacher' where id = 'a0000000-0000-0000-0000-000000000002';
  assert exists (select 1 from public.admin_audit_log where action = 'profile_role_status_change' and target = 'a0000000-0000-0000-0000-000000000002'), 'T7.5 role change audited';
  raise notice 'PASS T7.5 audit trigger';
end $$;
rollback;

begin;
select pg_temp.seed();
do $$
declare r jsonb; u_t uuid := 'a0000000-0000-0000-0000-000000000004'; u_sl uuid := 'a0000000-0000-0000-0000-000000000002'; n int;
begin
  perform pg_temp.as_user(u_sl); r := public.save_teacher_profile('Some School', '{}'); reset role;
  assert r->>'error' = 'not_a_teacher', 'T8.1 student cannot store teacher profile';
  perform pg_temp.as_user(u_t); r := public.save_teacher_profile('x', '{}'); reset role; assert r->>'error' = 'school_name_required', 'T8.2 school name required';
  perform pg_temp.as_user(u_t); r := public.save_teacher_profile('Example High School', '{}'); reset role;
  assert (r->>'ok')::boolean and (r->>'complete')::boolean, 'T8.3 saved, complete when no extra fields are configured: ' || r::text;
  -- configure a PLACEHOLDER dropdown inside the transaction only (these keys are test fixtures, NOT the agreed fields)
  insert into public.teacher_field_definitions (field_key, label, kind, required) values ('test_field', 'Test', 'select', true);
  insert into public.teacher_field_options (field_key, value, label) values ('test_field', 'a', 'A');
  perform pg_temp.as_user(u_t);
  r := public.save_teacher_profile('Example High School', '{"test_field":"zzz"}'); assert not (r->>'complete')::boolean, 'T8.4 invalid dropdown value rejected: ' || r::text;
  r := public.save_teacher_profile('Example High School', '{"test_field":"a"}');   assert (r->>'complete')::boolean, 'T8.5 valid dropdown value accepted';
  r := public.save_teacher_profile('Example High School', '{"test_field":"a","bogus":"1"}'); assert not (r->>'complete')::boolean, 'T8.6 unknown field rejected';
  select count(*) into n from public.teacher_profiles; reset role; assert n = 1, 'T8.7 teacher sees only own row';
  assert (select tier_rank(public.current_tier())) is not null, 'sanity';
  perform pg_temp.as_user(u_t); assert public.current_tier() = 'free', 'T8.8 saving a teacher profile grants nothing'; reset role;
  raise notice 'PASS T8 teacher profile metadata';
end $$;
rollback;
