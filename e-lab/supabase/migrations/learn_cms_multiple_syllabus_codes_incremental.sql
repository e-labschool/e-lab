-- e-Lab Learn CMS: allow one lesson to map to multiple syllabus concepts.
-- Safe incremental migration. Existing lesson_code is retained as the display/legacy code.
alter table public.learn_pages
  add column if not exists syllabus_codes text[] not null default '{}'::text[];

comment on column public.learn_pages.syllabus_codes is
  'Admin-selected e-Lab/IBDP curriculum display codes covered by this lesson; used to map Learn progress to existing learning_progress concept ids.';
