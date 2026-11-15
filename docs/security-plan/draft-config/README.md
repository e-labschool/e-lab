# draft-config (NOT APPLIED)

| File | Replaces | Notes |
|---|---|---|
| `vercel.proposed.json` | `/vercel.json` | Adds security headers, immutable caching for hashed assets, `no-cache` index.html. CSP is **Report-Only**. |
| `vite.build-block.proposed.js` | `/vite.config.js` | Adds `build.sourcemap: false`. |

## How each CSP origin was derived (from the code, not guessed)
* `script-src 'self'`: built `dist/index.html` has exactly one `<script type=module src=/assets/...>`; no inline scripts found in the build. No `eval`/`new Function` found in `dist/assets/*.js` (checked by grep), so `'unsafe-eval'` is not requested.
* `style-src 'unsafe-inline' https://fonts.googleapis.com`: `index.html` loads Google Fonts CSS; React inline `style=` attributes and lesson rich-text `style=` need `'unsafe-inline'` (weaker, but unavoidable without refactoring).
* `font-src https://fonts.gstatic.com`: same Google Fonts link.
* `img-src/media-src/connect-src` Supabase host: `VITE_SUPABASE_URL` (public storage URLs today, signed URLs later; REST/RPC; `wss://` for realtime). Real project ref is not in the repo docs I was given; it is `<PROJECT_REF>`.
* `connect-src https://cdn.jsdelivr.net`: the bundle contains `cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver` (troika 3D text pulls font data at runtime). Confirm in staging whether it fires; drop it if never reported.
* `frame-src` YouTube/Vimeo: `LearnBlockRenderer` video embeds (`toEmbedVideoUrl`).
* `worker-src blob:`: three/troika use blob workers (verify in staging; report-only will show).
* `cdnjs.cloudflare.com` appears in the jsPDF chunk (pdfobject helper) but is only used by `output('pdfobjectnewwindow')`; not allowed.
* `frame-ancestors` is **ignored in Report-Only**, hence the enforced `X-Frame-Options: DENY`. When CSP is enforced, add `frame-ancestors 'none'`.
* Violation reporting endpoint (`report-uri`/`report-to`) is an **open question** (see DECISIONS); until chosen, read violations in the browser console during the staging soak.
* HSTS `includeSubDomains` is a decision: omit it if any sibling subdomain is not HTTPS-ready. Do not add `preload` without a deliberate decision (hard to undo).
* **Untested here**: no headers were served or measured; Vercel was not touched. The JSON was only syntax-checked.
Replace `<PROJECT_REF>` before use. Vercel's JSON schema may reject unknown keys, so this file contains none.
