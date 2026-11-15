-- =====================================================================================================
-- 010_resource_folders_rollback.sql   --   DRAFT / NOT APPLIED / DATABASE
--
-- *** DO NOT RUN WITHOUT OWNER APPROVAL. ***
-- Undoes 010_resource_folders.sql: drops resources.folder_id, the resource_folders table (with its policies,
-- indexes, triggers) and the guard function.
--
-- WHAT IS PRESERVED : resources rows, resources.category (never modified by 010), every storage object and
--                     file_path.  The app falls back to the four legacy categories automatically.
-- WHAT IS LOST      : the folder tree itself, and each resource's folder placement beyond its category.
--                     If the admin created custom folders, this script REFUSES to run unless you first
--                     export them (select * from public.resource_folders;) and then opt in with:
--                         set app.rollback_confirm = 'yes';
--                     in the same SQL-editor session, before running this script.
-- Idempotent: yes.
-- =====================================================================================================
begin;

do $$
declare
  v_custom int := 0;
begin
  if to_regclass('public.resource_folders') is not null then
    select count(*) into v_custom from public.resource_folders
     where not (parent_id is null and slug in ('ib-documents', 'study-materials', 'ib-resources', 'worksheets-other'));
    if v_custom > 0 and coalesce(current_setting('app.rollback_confirm', true), '') <> 'yes' then
      raise exception '% custom folder(s) exist. Export them, then run: set app.rollback_confirm = ''yes''; and re-run this script.', v_custom;
    end if;
  end if;
end $$;

drop index if exists public.resources_folder_id_idx;
alter table public.resources drop column if exists folder_id;      -- also drops the FK
drop table if exists public.resource_folders;                       -- drops its policies, triggers and indexes
drop function if exists public.resource_folders_guard();

commit;
