\set ON_ERROR_STOP on
create or replace function pg_temp.expect_fail(sql text, pattern text) returns text language plpgsql as $$
begin
  execute sql;
  return 'NOT-FAILED: ' || sql;
exception when others then
  if sqlerrm ~* pattern then return 'ok   (' || left(sqlerrm, 60) || ')'; else return 'WRONG-ERR: ' || sqlerrm; end if;
end $$;
-- build a tree as admin
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', false);
set role authenticated;
insert into resource_folders (id,parent_id,audience,name,slug,sort_order) values
 ('b0000000-0000-0000-0000-00000000000a', (select id from resource_folders where slug='study-materials'),'student','Chemistry','chemistry',10),
 ('b0000000-0000-0000-0000-00000000000b','b0000000-0000-0000-0000-00000000000a','student','Structure','structure',10);
select 'admin insert depth 3: ok';
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values ('b0000000-0000-0000-0000-00000000000b','student','TooDeep','toodeep')$$, 'at most 3');
select pg_temp.expect_fail($$update resource_folders set parent_id='b0000000-0000-0000-0000-00000000000b' where slug='study-materials'$$, 'cycle|at most 3');
select pg_temp.expect_fail($$update resource_folders set parent_id='b0000000-0000-0000-0000-00000000000a' where id='b0000000-0000-0000-0000-00000000000a'$$, 'own parent');
select pg_temp.expect_fail($$update resource_folders set parent_id='b0000000-0000-0000-0000-00000000000b' where id='b0000000-0000-0000-0000-00000000000a'$$, 'cycle');
select pg_temp.expect_fail($$update resource_folders set parent_id=(select id from resource_folders where slug='ib-documents') where slug='study-materials'$$, 'at most 3');
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values (null,'student','ib documents','other')$$, 'unique|duplicate');
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values (null,'student','x/y','xy')$$, 'check');
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values (null,'student','Bad Slug','Bad Slug')$$, 'check');
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug,access_tier) values (null,'student','Gold','gold','gold')$$, 'check');
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values ((select id from resource_folders where slug='ib-resources'),'student','Wrong aud','wrong')$$, 'does not fit');
select pg_temp.expect_fail($$update resource_folders set audience='teacher' where id='b0000000-0000-0000-0000-00000000000a'$$, 'does not fit|different audience');
select pg_temp.expect_fail($$delete from resource_folders where slug='study-materials'$$, 'foreign key|violates');
select pg_temp.expect_fail($$delete from resource_folders where id='b0000000-0000-0000-0000-00000000000a'$$, 'foreign key|violates');
-- same name allowed in another audience / another parent
insert into resource_folders (parent_id,audience,name,slug) values (null,'teacher','Chemistry','chemistry');
-- resource in folder blocks deletion
update resources set folder_id='b0000000-0000-0000-0000-00000000000b' where title='r1';
select pg_temp.expect_fail($$delete from resource_folders where id='b0000000-0000-0000-0000-00000000000b'$$, 'foreign key|violates');
-- a leaf (empty) deletes fine
insert into resource_folders (id,parent_id,audience,name,slug) values ('b0000000-0000-0000-0000-00000000000c',null,'both','Tmp','tmp');
delete from resource_folders where id='b0000000-0000-0000-0000-00000000000c';
-- audience widen: 'both' parent allows both child kinds; narrowing with a different child is refused
insert into resource_folders (id,parent_id,audience,name,slug) values ('b0000000-0000-0000-0000-00000000000d',null,'both','Shared','shared'),
  ('b0000000-0000-0000-0000-00000000000e','b0000000-0000-0000-0000-00000000000d','teacher','TeachKid','teachkid');
select pg_temp.expect_fail($$update resource_folders set audience='student' where id='b0000000-0000-0000-0000-00000000000d'$$, 'different audience');
reset role;
-- RLS
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002', false);
set role authenticated;
select 'student sees: ' || string_agg(name, ', ' order by name) from resource_folders;
select pg_temp.expect_fail($$insert into resource_folders (parent_id,audience,name,slug) values (null,'student','Hack','hack')$$, 'row-level security');
update resource_folders set name='Hacked' where slug='ib-documents';
select 'student update touched rows (expect 0): ' || (select count(*) from resource_folders where name='Hacked');
reset role;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000003', false);
set role authenticated;
select 'teacher sees: ' || string_agg(name, ', ' order by name) from resource_folders;
reset role;
select set_config('request.jwt.claim.sub','', false);
set role authenticated;
select 'no-user sees (expect 0): ' || count(*) from resource_folders;
reset role;
select 'admin sees (expect all): ' || count(*) from (select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001', false)) x, lateral (select 1 from resource_folders) y;
-- updated_at trigger
select 'updated_at advances: ' || (select (updated_at > created_at)::text from resource_folders where slug='ib-documents');
