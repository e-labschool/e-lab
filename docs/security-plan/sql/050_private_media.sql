-- =====================================================================================================
-- 050_private_media.sql   --   DRAFT / NOT APPLIED / STORAGE+DATABASE (production) / risk: MEDIUM
-- Phase P5a.  Adds PRIVATE buckets and the access rules for them.  It does NOT:
--   * change the visibility of learn-media or question-media,
--   * move, rename or delete any of the 217 existing files,
--   * rewrite any lesson block JSON.
-- Existing lessons keep media_mode='public' and keep rendering from the public URLs until an admin flips a SINGLE
-- lesson to 'private' (admin_set_lesson_media_mode), which is only allowed after every image of that lesson has been
-- COPIED into the private bucket and verified.  Flipping back to 'public' is instant (the public copy still exists
-- until the final, separately-approved deletion step).
--
-- HOW A PRIVATE LESSON IS SERVED: get_lesson_page returns media references as  storage://learn-media-private/<path>
-- (server-side rewrite below; stored JSON is untouched). The browser resolves them with createSignedUrls(ttl 600s).
-- createSignedUrl requires SELECT on storage.objects for the CALLER, so the policy below (lesson-access check
-- + expiry via can_read_lesson) is what actually authorises each file.
-- LISTING: a signed-in user can list only objects their policy lets them SELECT, i.e. paths of lessons they can
-- already read. Listing of other lessons is impossible; listing of your own lessons is not preventable with this
-- design (see plan: Option B Edge Function removes it at the cost of a function call per lesson).
--
-- PRECONDITIONS : 030 and 040 applied. P5 inventory (Q06/Q09/Q10) done. Backups taken. Copy script run on staging.
-- RISK          : Medium. Wrong policy => images 403 for private lessons only (public lessons unaffected).
-- ROLLBACK      : 050_private_media_rollback.sql
-- IDEMPOTENT    : yes.
-- =====================================================================================================
begin;
select secplan.snapshot_policies('050', 'storage', 'objects');

alter table public.learn_pages
  add column if not exists media_mode text not null default 'public' check (media_mode in ('public', 'private'));

-- ---- buckets (private) -----------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learn-media-private', 'learn-media-private', false, 104857600,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-media-private', 'question-media-private', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- ---- access helper used by the policies -----------------------------------------------------------------------
create or replace function public.can_read_media_path(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_page uuid;
begin
  if p_bucket = 'learn-media-private' then
    if p_name !~ '^lessons/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/' then return false; end if;
    v_page := substring(p_name from '^lessons/([0-9a-fA-F-]{36})/')::uuid;
    return public.can_read_lesson(v_page);                       -- active account + published + tier/expiry + SL/HL + audience
  elsif p_bucket = 'question-media-private' then
    -- Interim rule: same audience as the question bank rows today (any active signed-in account). Tighten when
    -- questions get a tier (open question in DECISIONS_AND_OPEN_QUESTIONS.md).
    return public.is_active_account() and public.has_entitlement('free');
  end if;
  return false;
end $$;
revoke all on function public.can_read_media_path(text, text) from public, anon;
grant execute on function public.can_read_media_path(text, text) to authenticated;

-- ---- storage policies --------------------------------------------------------------------------------------------
do $$ declare b text; begin
  foreach b in array array['learn-media-private', 'question-media-private'] loop
    execute format('drop policy if exists %I on storage.objects', 'Admins manage ' || b);
    execute format('create policy %I on storage.objects for all to authenticated using (bucket_id = %L and public.is_admin()) with check (bucket_id = %L and public.is_admin())',
                   'Admins manage ' || b, b, b);
    execute format('drop policy if exists %I on storage.objects', 'Entitled users read ' || b);
    execute format('create policy %I on storage.objects for select to authenticated using (bucket_id = %L and public.can_read_media_path(bucket_id, name))',
                   'Entitled users read ' || b, b);
  end loop;
end $$;

-- ---- server-side rewrite hook (replaces the identity stub from 040) ----------------------------------------------------
create or replace function public.rewrite_media_refs(p_page_id uuid, p_content jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_mode text;
begin
  select media_mode into v_mode from public.learn_pages where id = p_page_id;
  if v_mode is distinct from 'private' then return p_content; end if;
  return regexp_replace(p_content::text,
           'https?://[A-Za-z0-9.-]+/storage/v1/object/public/learn-media/',
           'storage://learn-media-private/', 'g')::jsonb;
end $$;
revoke all on function public.rewrite_media_refs(uuid, jsonb) from public, anon, authenticated;

-- ---- per-lesson cut-over (the ONLY way to set media_mode='private'), refuses unless all copies exist ----------------------
create or replace function public.admin_set_lesson_media_mode(p_page_id uuid, p_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_refs int; v_missing int;
begin
  if not public.is_admin() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if p_mode not in ('public', 'private') then raise exception 'Invalid mode'; end if;
  if p_mode = 'private' then
    with refs as (
      select distinct (regexp_matches(b.content::text, '/storage/v1/object/public/learn-media/([^"\s)\\]+)', 'g'))[1] as object_name
        from public.learn_blocks b where b.page_id = p_page_id)
    select count(*), count(*) filter (where not exists (
             select 1 from storage.objects o where o.bucket_id = 'learn-media-private' and o.name = refs.object_name))
      into v_refs, v_missing from refs;
    if v_missing > 0 then
      raise exception '% of % referenced images are not yet copied to learn-media-private', v_missing, v_refs;
    end if;
  end if;
  update public.learn_pages set media_mode = p_mode where id = p_page_id;
  perform public.write_admin_audit('lesson_media_mode', null, jsonb_build_object('page_id', p_page_id, 'mode', p_mode));
  return jsonb_build_object('page_id', p_page_id, 'mode', p_mode, 'images_checked', coalesce(v_refs, 0));
end $$;
revoke all on function public.admin_set_lesson_media_mode(uuid, text) from public, anon;
grant execute on function public.admin_set_lesson_media_mode(uuid, text) to authenticated;

commit;
