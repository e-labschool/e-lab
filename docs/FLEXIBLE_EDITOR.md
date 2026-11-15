# Flexible lesson editor and question stem placement

No database migration. No new service. Everything is stored inside JSON columns that already exist.

## 1. Data format

### Lessons: `learn_blocks.content.layout`

```json
{ "v": 1, "span": 5, "row": "r-<firstBlockId>", "align": "start|center|end", "position": "left|right", "mobile": "default|first|last" }
```

- Blocks with no `layout` key are legacy. They are never rewritten just by opening them. A lesson in which no block has layout renders the exact legacy DOM (`<div class="mt-6 space-y-5">`), proved by `scripts/test-learn-layout-render.mjs` against `scripts/fixtures/learn-legacy-snapshot.json`, which was generated from the original renderer before any edit.
- Grid: 12 columns. `span` presets are 3, 4, 5, 6, 7, 8, 12 (1/4, 1/3, 5/12, 1/2, 7/12, 2/3, full).
- A row is a run of ADJACENT blocks that share the same `row` id. `row` is stored only for rows with 2 or more blocks (max 4 cells, `MAX_ROW_CELLS`). The row id is `r-<id of the first block>`.
- "Wrap" (beside vs above/below) is derived from row membership; it is not stored.
- The default layout is removed on save, so a block you never laid out stays layout-free.
- Types in `FULL_ONLY` (page_break, check_understanding, worked_example, practical, data_graph, compare_contrast) are always full width. `MIN_SPAN` per type stops blocks being squeezed too narrow (simulation 6, image 3, ...).
- Malformed or unknown layout values are normalised, never thrown (`normalizeLayout`, `normalizeBlocks`).

### Questions: `questions.visual_data.placement`

```json
{ "side": "above|below|left|right", "width": "third|half|twothirds|full" }
```

Optional. Absent or invalid means the legacy layout for each view. It lives next to the existing visual (`visual_data`), so it travels into `question_versions` snapshots with no change to marking, `question_secrets` or stored answers.

## 2. How rendering collapses

- Lessons (`LearnBlocksLayout`): rows are CSS grids. Side-by-side applies only when the lesson column is at least 640px wide (container query `lb`, so it follows the column, not the screen). Below that every row is one column, in document order, unless a block has `mobile: first|last`. Print stacks and avoids breaking inside a cell. `prefers-reduced-motion` turns transitions off.
- Editor canvas: threshold 480px (container `lbe`), because the canvas shares the screen with two side panels. Preview mode uses the real 640px rule. Phone/Tablet/Desktop buttons resize the preview frame.
- Question stems: threshold 480px (container `lbs`), because stems sit in a modal or the solve panel. Below it the visual stacks first, then the text. Options and answer inputs are always outside the stem row.
- Simulation blocks keep their shell, fullscreen and "Open in new tab". Images and videos fill their cell (`inCell`).

## 3. Editor

Open a lesson in Admin, Learn Content. Add `?editor=classic` for the old list.

- Palette (existing block types plus presets Image + text, Text + image, Three columns), canvas with 12-column guides, Edit layout / Preview, Phone / Tablet / Desktop, snap to grid, right settings panel (width, position, wrapping, vertical alignment, on-phones order, duplicate, delete), outline with drag-reorder, collapse/expand, search.
- Pointer drag (mouse, pen, touch) with a visible drop zone: left or right quarter of a block = beside it, top or bottom half = before or after, empty end area = end. Escape cancels. Dragging the edge handle resizes with snap to presets.
- Keyboard: Alt+Arrow moves a block, Alt+Shift+Left/Right narrows/widens, Enter opens the content panel, arrows on the resize handle. Every move or resize has a button too. Changes are announced in an `aria-live` region.
- Undo/redo: Ctrl/Cmd+Z, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z, limit 100. Presets undo as one step. Content undo keeps the current layout.
- Saving: layout writes are debounced (400 ms), flushed before Save/Publish and on leaving, with the existing unsaved-changes warning.

Questions: Admin, Question Bank, edit a question: "Stem placement" (position and width buttons with a live preview), a "Duplicate question" button (also `?from=<id>`, opens as a draft), a sticky section nav, collapsible sections. The bank list has a question-text column, a placement badge, and Preview / Duplicate actions.

## 4. Code map and how to extend

- `src/lib/blockLayout.js`: pure model and operations (`setSpan`, `placeBeside`, `moveBefore/After/Up/Down/Left/Right`, `ungroup`, `setAlign`, `setPosition`, `setMobile`, `insertAfter`, `removeBlock`, `applyPresetRow`, `toLinear`, `validateLayout`, `buildRows`, `segmentBlocks`, `collapsedOrder`). Every op returns the same array reference when it is a no-op.
- `src/lib/blockLayoutOps.js`: `runLayoutOp` (name, id, argument), `opForKey`, `dropZone`, `applyDrop`, undo snapshots, persistence diff.
- `src/components/learn/LearnBlocksLayout.jsx`: renderer. `src/pages/admin/learn/editor/*`: workspace, sidebar, settings panel, drag hook.
- `src/lib/questionLayout.js`, `src/components/questions/QuestionStemLayout.jsx`: question placement.

New block type: add it to the block renderer as before. To limit its width, add it to `FULL_ONLY` or give it a `MIN_SPAN` in `blockLayout.js`. If it should fill its cell, honour the `inCell` prop. New layout operation: add it to `blockLayout.js` as a pure function, register it in `runLayoutOp`, add a test in `scripts/test-block-layout.mjs`.

## 5. Limits

- Rows are at most 4 cells; blocks in a row stay adjacent; there is no free 2D placement or overlap, and no vertical spanning.
- No `section` grouping was built (outline, collapse and search cover organisation).
- Questions use a single placement option on the visual, not a grid. Parts, options and answer inputs are not repositionable. Bulk select and bulk move/tag/delete were not built. The bank's existing filters (search, topic code, concept, level, paper, type, difficulty, status) were already present and were left as they were.
- Layout of an older lesson changes only after someone edits it. Two admins editing the same lesson overwrite each other, as before.

## 6. Tests

`npm run test:flexible-editor` (part of `npm test`): layout model, legacy identity, renderer, editor (jsdom, keyboard path), question placement.
`npm run verify:flexible-editor`: Chromium with Supabase mocked through `page.route`; saves screenshots to `$TMPDIR/flexible-editor-shots`.
