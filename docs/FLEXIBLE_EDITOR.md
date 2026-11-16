# Flexible lesson editor, content review and reuse

No database migration. No new table. Everything is stored inside JSON columns that already exist. Teacher-facing steps for guide updates: `docs/CONTENT_REUSE_GUIDE.md`.

## 1. One data model, two views

`learn_blocks.content.layout` (per block). A lesson is **Canvas** when any block has `col` and `gr`; otherwise **Classic**.

```json
Classic (v1, unchanged): { "v":1, "span":5, "row":"r-<firstBlockId>", "align":"start|center|end", "position":"left|center|right", "mobile":"default|first|last" }
Canvas  (v2):            { "v":2, "span":6, "col":7, "gr":3, "rs":4, "align":"start", "mobile":"default" }
Editor only (Classic):   content.ui = { "h": 6 }     preview height in rows (1 row = 28px); never read by the student renderer
```

- Blocks with no `layout` are legacy: the exact legacy DOM (`<div class="mt-6 space-y-5">`), proved by `scripts/test-learn-layout-render.mjs` against the frozen snapshot. Opening a lesson never writes to it.
- Grid: 12 columns. `col` 1-12, `span` = column span, `gr` = grid row (1+), `rs` = height in rows. Min widths per type (`MIN_SPAN`); `FULL_ONLY` types (page break, check understanding, worked example, practical, data graph, compare/contrast) are always 12 wide.
- Both shapes are read at any time. `placements()` repairs overlapping / out-of-range / missing positions deterministically (sweep in reading order, push down). Malformed data is normalised, never thrown.
- Switching view converts the whole lesson (`toCanvas`, `toClassic`), keeps every block's content, is ONE undo step, and rows / widths / order survive a round trip (tested). Classic `mobile` is kept in canvas data but only Classic uses it; the canvas keeps one extra detail: row `position` (left/centre/right) is re-derived from columns.
- The stored block order always equals reading order (top to bottom, left to right), so page breaks and pagination stay correct.

## 2. How students see it

- Classic: unchanged 12-column rows, one column below 640px (container query `lb`).
- Canvas: one CSS grid (`.lb-grid`). Each block gets `grid-column` from `col/span` and `grid-row` from the placements with empty row bands compacted, **natural height, full content** (the editor tile is only a preview). Below 640px the cells stack in reading order. `rs` only sizes the editor tile.
- Teacher pages that reuse `LearnBlocksLayout` get the same behaviour.

## 3. Editor

- Slim toolbar: **Classic | Canvas**, **Add block** (menu: types, presets, block library), **Undo / Redo**, **Preview as student**, **More** (collapse all, library, snap, canvas overlap mode, preview width, search, lesson shortcuts).
- Tiles are small rectangles: type icon, tag chips (codes, `v2025`, Review, HL), the first lines only (text is truncated to 220 characters in the DOM, CSS clamps to 3 lines and fades), thumbnail for image, simulation name, question count. Double-click or Enter opens the **drawer** with the unchanged block editors plus "Tags and review". The selected tile shows a mini toolbar: edit, duplicate, width presets, collapse, delete, and a More menu (hide, tags, library, review flag, move/size buttons).
- Classic: grip drag reorders (drop on a block's left/right quarter = beside, top/bottom = before/after). Drag the right edge to narrow or widen: narrowing a full-width block lets the next block flow beside it (`setSpanFlow`); widening pushes neighbours back to their own row. Drag the bottom edge for the preview height.
- Canvas: drag the grip to move, edges to resize. Drops snap to the nearest free slot (default) or push following blocks down (More menu). Width stops at obstacles; extra height pushes followers down. Blocks never overlap (random-operation tests).
- Keyboard (tile focused): Arrow = move (Classic: up/down reorder, left/right inside a row; Canvas: one column / row, followers pushed), Shift+Arrow = resize (Left/Right width, Up/Down height), Enter or F2 = edit, Delete = remove (Ctrl+Z restores), Space = collapse, Ctrl+Z / Ctrl+Y undo/redo. Alt+Arrow still works. Every change is announced in an `aria-live` region with the new position. The resize handles are keyboard focusable too.
- Phones (<640px): a simple linear list with Move up / Move down buttons (Canvas reorders by re-flowing the grid, keeping widths).
- Saving: layout and height writes are debounced (400 ms) and flushed before Save/Publish and on leaving. Undo/redo limit 100; content undo keeps the current layout.
- `?editor=list` (or `classic`, the old URL) opens the plain list editor.

## 4. Review and reuse (Admin, Learn Content, Content overview)

Listing (type, first line, words, images, simulation, questions), search over all lesson text with jump-to-block, filters (topic, status, syllabus code, guide version, needs review), per-lesson and per-block metadata, **Review mode**, **Duplicate as new guide version**, **Export / Import with dry run**, **Block library**. Storage table is in the guide. Limits: manual Check Your Understanding questions are not copied or exported; imports never overwrite; the library is per browser.

Question bank: the list has "Guide version" (existing `syllabus_version`) and "Needs review" (tag `needs-review`) filters. Stem placement is unchanged.

## 5. Code map

`src/lib/blockLayout.js` (classic model, `setSpanFlow`), `blockCanvas.js` (canvas model, conversions, renderer plan), `blockLayoutOps.js` (named ops for both views, keys, undo snapshots), `learnMeta.js` (metadata, summaries, filters, search), `learnReuse.js` (export/import validation, duplicate plan, library), `learnReuseService.js` (Supabase calls), `src/components/learn/LearnBlocksLayout.jsx` (renderer), `src/pages/admin/learn/editor/*` (workspace, tile, drawer, library panel, menu), `ContentOverview.jsx`, `CompactLesson.jsx`. New block type: add it to the registry; give it a `MIN_SPAN` / `FULL_ONLY` entry and a default height in `blockCanvas.js` `DEFAULT_ROWS` if needed.

## 6. Tests

`npm run test:flexible-editor` (part of `npm test`): classic model, canvas + reuse model (random operations, conversion round trips, export/import, duplicate), renderer + legacy identity, editor and overview (jsdom, keyboard, pointer events with stubbed geometry), question placement. `npm run verify:flexible-editor`: Chromium with Supabase mocked through `page.route`, 1366x768 / 390x844, light and dark; screenshots in `$TMPDIR/flexible-editor-shots`, plus `docs/mockups/11-editor-classic.png` and `12-editor-canvas.png`.
