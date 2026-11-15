# Curricula and Premium locks

Everything is still FREE: the Premium master switch is OFF, nothing here changes what any visitor can open. No database migration is needed for either feature; no SQL was written (see "Why no SQL").

## 1. Lock toggle (replaces the Free/Premium dropdowns)

* `/admin/folders` (one toggle per folder, in the folder details and in "New folder") and `/admin/simulations` (one per row) use `src/components/admin/LockToggle.jsx`: a padlock button, `aria-pressed` = locked.
* locked = tier `premium`, unlocked = `free`. Write payloads are unchanged (`access_tier` on `resource_folders`; `{ sim_id, tier, featured }` on `simulation_access`). `accessPolicy.js`, the `demo` tier and the "most restrictive wins" folder rule are untouched. `demo` is no longer selectable in the UI; a simulation already saved as `demo` shows "Free demo" and reads as unlocked.
* Tooltip / description: "Lock for Premium" / "Unlock (free)". The accessible NAME stays constant ("Premium lock for <item>") so a screen reader never says "Unlock, pressed".
* Helper text on both pages: locks only take effect once Premium is switched on (master switch on Simulation access); right now everything is free for everyone.
* Folders: a locked folder's sub-folders and resources inherit it. Tree rows show "Premium" (own lock) or "via folder" (inherited); the details panel says "Locked via folder "X"" or how much sits inside. Unlocking a child of a locked folder does not open it.
* Tables missing / Supabase not connected: toggles are disabled, as the dropdowns were.

## 2. Curricula

`src/data/curricula.js` keeps its original `CURRICULA` export (student landing picker) and adds `PLATFORM_CURRICULA`: IB Diploma (DP), Cambridge IGCSE, Cambridge AS & A Level, Other. Status is honest: only **IB DP is `available`** (every lesson, question set and simulation syllabus code in the repo is IB DP Chemistry); the rest are `planned` and labelled "Content planned". A test fails when a non-IB curriculum map is registered, as a reminder to flip the status.

* Sign-up (`/auth`): required field, IB DP preselected so nobody is blocked (stated in the help text). Students choose one (radios), teachers one or more (checkboxes; the last one cannot be unticked). "Other" shows an optional free-text name (60 chars). No new teacher fields were added.
* Stored in Supabase `signUp` `options.data` (user_metadata): `curricula` (ids), `curriculum_other`, and the existing `curriculum` key now holds the readable text ("IB Diploma Programme" for the default, exactly as before), which the existing profiles trigger already copies into `profiles.curriculum`.
* Profile pages (`ProfileCard`, student and teacher): chip row; editable through the existing Edit Profile pattern. Saving writes `user_metadata` (`updateUserMetadata` in `AuthContext`) and `profiles.curriculum` (already self-editable). Older accounts fall back to parsing `profiles.curriculum`.
* Simulation catalogue: optional `curriculum` array. All live entries are `['ib-dp']` (backed by their IB syllabus codes); coming-soon entries are `[]`; no IGCSE / A Level mapping is claimed. `SimulationLibrary` shows a curriculum chip row only when more than one curriculum has live items (hidden today).

### Why no SQL
`user_metadata` carries the ids and the existing `profiles.curriculum` text column carries the readable value, so a `profiles.curricula` column would only add a migration. It would be better if admins ever need to filter or report users by curriculum in SQL; then draft `020_profile_curriculum.sql` (+ rollback) and have the trigger fill it from `raw_user_meta_data->'curricula'`.

### Caveat
`user_metadata` is editable by the signed-in user. It is used only for display and preference, never for access or entitlement.

## Tests
`npm run test:curricula-locks` (config, catalogue, library filter, lock toggle, admin simulations), plus additions in `test:auth-signup` (sign-up per role, metadata, profile chips/edit) and `test:resource-folders` (folder lock). `npm run verify:curricula-locks`: Chromium, mocked Supabase, 1366x768 and 390x844, light and dark (sign-up, profiles, both admin pages).
