# Teacher sign-up fields (School name + Professional field)

Teacher registration stays open with no manual approval. The TEACHER form on `/auth?role=teacher` (and the teacher profile page) collects two extra REQUIRED fields. The student form is unchanged (School stays optional, no professional field).

| Field | Control | Rules | Stored in |
| --- | --- | --- | --- |
| School name | text | required, whitespace trimmed/collapsed, 2-120 chars | `signUp` `options.data.school` -> the existing profiles trigger already copies it to `profiles.school` |
| Professional field | dropdown | required, one id from `PROFESSIONAL_FIELDS`; "Other" reveals an optional description (60 chars) | `user_metadata.professional_field` (+ `professional_field_other`) only |

No migration and no SQL: the trigger is unchanged and does not copy `professional_field`, so it lives in `user_metadata` only (same approach as `curricula`).

## Editing the list (PROPOSAL - owner to confirm)
Everything is in `src/data/teacherProfile.js` (`PROFESSIONAL_FIELDS`, limits, messages). Keep each `id` stable (it is what is stored); labels and order are free. Removing an entry is safe: accounts that stored it still show the stored id as plain text and must pick a current option when they next edit. Current proposal: Chemistry teacher, Science teacher, IB DP Coordinator, Head of Department / Faculty, Lab technician, Teaching assistant, Tutor / private educator, Student teacher / trainee, Other.

## Profile page
`ProfileCard` (teacher) shows School and Professional field, and edits both through the existing Edit Profile form. Saving writes `profiles.school` and, only when changed, `user_metadata.professional_field(_other)` via `updateUserMetadata`. Read order: school = `profiles.school`, then `user_metadata.school`; professional field = `user_metadata` only (older teachers show "Not provided yet"). Both fields are required on edit too, so an older teacher saving the form is asked to fill them in.

## NOT for access decisions
`user_metadata` is editable by the signed-in user, and these are free-text / self-declared. They are display and reporting hints only: they must never gate Premium, confidential school resources, roles or any entitlement. The teacher role grants nothing extra because of them.

## Accessibility
Visible labels with "(required)" for screen readers, `aria-required`, inline errors linked by `aria-describedby` + `aria-invalid`, focus moves to the first invalid field, error text meets 4.5:1 in light and dark.

## Tests
`npm run test:auth-signup` (jsdom: per-role form, required validation messages, Other text, payloads, profile view/edit, fallbacks; part of `npm test`). `npm run verify:teacher-signup` (Chromium, mocked Supabase, 320/390/1366/1920 wide, light + dark, screenshots). Not covered: live sign-up, the trigger copying `school`, real email.

## If admins ever need to filter by professional field
Draft a `profiles.professional_field` column and extend the trigger from `raw_user_meta_data`; not done here (no migration by design).
