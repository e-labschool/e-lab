# Resource View / Download

Every place a resource file is listed (student + teacher Resources rows, search results, the legacy `ResourceCard`, and the admin Resources list) has two separate actions, from one component, `src/components/resources/ResourceActions.jsx`:

| Action | Control | Behaviour |
| --- | --- | --- |
| **View** | eye, name `View <title> in a new tab` | PDF, PNG/JPEG/GIF/WebP and plain text open in a NEW tab through a short-lived signed URL (no download parameter, so the browser displays it). External link: opens the link in a new tab (never signed). |
| **Download** | download icon, name `Download <title>` | Signed URL created with the download file name (`createSignedUrl(path, ttl, { download })`), so storage answers `Content-Disposition: attachment`. No tab opens. Not shown for external links. |

Logic lives in `src/lib/resourceActions.js` (pure helpers + `viewResource` / `downloadResource`); `getResourceSignedUrl(path, { download })` in `resourceService.js` is still the only signing call. Locked/unpublished resources behave as before (lock indicator, no actions). The admin list passes its own view of the row (never locked), so the admin can check any upload.

## Behaviour details
* **Popup blockers:** the new tab is opened synchronously inside the click (blank), then pointed at the signed URL when it arrives. `window.open(..., "noopener")` returns no handle, so the opener is cut manually (`tab.opener = null`) and navigation happens through a `rel="noopener noreferrer"` anchor inside the tab (no Referer reaches storage). If the browser still blocks the tab the user gets a plain message. On failure the blank tab is closed again.
* **Errors:** signing/storage errors become sentences (not found, no permission, offline, generic); raw errors are never shown. Only `http(s)` external links are ever linked/opened.
* **Types a browser cannot show (PPT/DOC/XLS, SVG/HTML, anything else):** the eye stays focusable but its name says preview is not available; clicking shows "This file type can't be previewed in the browser - download it instead" with a "Download instead" button. Nothing is signed. The private URL is **never** sent to Google / Microsoft Office viewers. If downloads are locked (below) the message omits the download offer.
* States: spinner + `aria-busy` while signing; double clicks are ignored. Targets are 44px on phones (40px on desktop; the compact admin variant is 44px on phones, 32px on desktop).

## Premium-ready (everything is free today)
`accessPolicy.js` adds `checkAction(item, 'view' | 'download', ctx)`:
* `view` = `checkAccess` (unchanged).
* `download` needs view first; then it needs a Premium entitlement **only when `premiumEnabled` AND `downloadRequiresPremium` are both literally `true`** (items with tier `demo` stay downloadable). Teacher/admin roles never grant it. Unknown actions are denied. In any other configuration download is allowed for everyone who may view.
* `showDownloadLock`, `lockedActionCopy('download', reason)` for the UI.

Switch: **Admin -> Simulation access -> "Downloads are Premium-only"** (default off; works only with Premium on). Stored as `platform_settings.download_requires_premium`, read through `platform_settings_public`, via the same `accessConfigService`. Draft SQL: `docs/platform-sql/011_download_requires_premium.sql` (+ rollback), **never executed**; requires 001. Before it exists the switch is disabled with a notice, the other switches keep working, and reads fall back to "downloads free". When off the site looks exactly as before. When denied, the Download button shows a lock and opens a prompt in the style of the locked-simulation screen (viewing still works).

`ResourceBrowser` now takes the config from `AccessConfigProvider` (an explicit `accessConfig` prop still wins), so tiers and this switch follow the admin settings once Premium is on.

Not built (notes only): per-resource / per-folder download overrides (would need a nullable column such as `resources.download_tier`); the global switch plus existing tier rules is all there is.

## What is UI-only
* Hiding the Download button does **not** stop copying. A PDF/image open in a browser tab can be saved from the browser's own toolbar, and a signed URL is just a link to the file until it expires (10 minutes today). Anyone allowed to view can keep the bytes (also by screenshot or the network panel). Never describe this as copy protection.
* Real restriction needs server-side measures: a private bucket with entitlement-checked storage policies and short-lived URLs (`docs/security-plan/` **P3**, `032_resources_entitlement_policies`, which "respects the admin download switch"; **P2/P1f**, `025_export_controls_settings`: `allow_resource_downloads` and the UI patch for the `download=` in `ResourceCard`), and optionally a view-only renderer or per-user watermark (not planned; it would still not prevent screenshots). The `download_requires_premium` flag here is UI policy and would have to be mirrored by those server rules.

## Later options
* **Office files:** convert PPT/DOC/XLS to PDF at upload (server-side, e.g. an Edge Function) and store the PDF as the viewable rendition next to the original; then View works for every resource and Download keeps the original.
* Allow image uploads (`validateResourceFile` still accepts only PDF/DOCX/PPTX/XLSX); view already supports them.

## Tests
`npm run test:resource-actions` (in `npm test`; also `test:access-policy`, `test:resource-folders`), `npm run verify:resource-actions` (Chromium, mocked Supabase and storage, 1366x768 and 390x844, light and dark: new tab to the signed URL, download event, Premium lock prompt, admin list and switch).
