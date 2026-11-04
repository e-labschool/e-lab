-- e-Lab: Resources premium-access enforcement (OPTIONAL — FUTURE)
--
-- DO NOT RUN THIS YET. It is provided now, as the brief requested,
-- purely so the enforcement path is designed and ready — running it
-- immediately changes what premium resources students/teachers can open,
-- with no payment system yet in place to have granted anyone premium
-- access legitimately.
--
-- Run this only when you are ready to actually start enforcing
-- access_tier on resource files (i.e. once Admin -> Access is being used
-- to grant real premium/school entitlements). Until then, resources with
-- access_tier = 'premium' behave exactly as they do today — visible per
-- the existing audience/status/is_locked rules, with access_tier as
-- inert metadata.
--
-- Depends on: resources-migration.sql (bucket, is_admin(), the
-- "Authorized users can read unlocked published resource files" policy)
-- and admin-access-migration.sql (user_access, user_access_overview).

-- Replaces the existing student/teacher read policy on storage.objects
-- with one that ALSO checks effective_plan for premium resources —
-- everything else about that policy (published, unlocked, audience
-- match) is unchanged.
drop policy if exists "Authorized users can read unlocked published resource files" on storage.objects;

create policy "Authorized users can read unlocked published resource files"
  on storage.objects for select
  using (
    bucket_id = 'resources'
    and exists (
      select 1 from public.resources r
      join public.profiles p on p.id = auth.uid()
      where r.file_path = storage.objects.name
        and r.status = 'published'
        and r.is_locked = false
        and (r.audience = 'both' or r.audience = p.role)
        and (
          r.access_tier = 'free'
          or exists (
            select 1 from public.user_access_overview uao
            where uao.user_id = auth.uid()
              and uao.effective_plan in ('premium', 'school')
          )
        )
    )
  );
