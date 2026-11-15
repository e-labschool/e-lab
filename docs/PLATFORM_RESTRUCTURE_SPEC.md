# e-Lab.school — Platform restructure (Premium-ready, everything free for now)

Source: product discussion with the site owner (2026-11-14/15). Mockups: docs/mockups/ (00 landing page, 01-09 app screens). The mockups are illustrations; names, numbers and thumbnails are examples.

## Decisions
1. EVERYTHING IS FREE FOR NOW. No Premium will be introduced until the site has reach. While the master switch is off: no Premium badges, locks, plan cards, "Plans" pricing section, "Notify me" boxes, upgrade prompts or locked-content screens appear anywhere. Nothing is gated, nothing changes for existing users.
2. Build everything Premium-READY: every content item (simulation, folder, resource, lesson) has a `tier` (demo | free | premium) and all access decisions go through src/lib/access/accessPolicy.js (pure policy; UI only). Turning Premium on later = admin setting + changing item tiers + the DB enforcement phases in docs/security-plan/ — not a component rewrite. Admin screens (simulation access, folders) are built now with the tier controls, with the Premium wording kept understated while the switch is off.
3. Multiple concurrent login sessions allowed; no session limits.
4. Teacher role never grants Premium or confidential school privileges. Teacher form fields still TO BE CONFIRMED (do not invent them).
5. No production changes without approval: SQL migrations are written as drafts only (docs/security-plan style) and never executed; code must work BEFORE the migration is applied (graceful fallback) and after.
6. Preserve every existing feature, lesson, simulation, student progress, route and look & feel. Keep NMR/IR/MS/Structure modules untouched.
