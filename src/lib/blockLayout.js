// Pure layout model for Learn lesson blocks (no React, no DOM, no Supabase).
//
// Storage: each block keeps its optional layout INSIDE its existing `content`
// JSON as `content.layout` -- no migration, no new column. A block with no
// `content.layout` (every lesson saved before this module existed) is a
// full-width block in linear order, exactly as before.
//
//   content.layout = { v: 1, span?: 1-12, row?: string, align?: "start"|"center"|"end",
//                      position?: "left"|"center"|"right", mobile?: "default"|"first"|"last" }
//
// Model: the lesson is the linear block order (learn_blocks.position) PLUS an
// optional grouping of ADJACENT blocks into "rows" via a shared `row` id. A row
// is a 12-column grid line: each member occupies `span` columns, in block order.
// A block alone in its row is a "solo" row; its `position` places it
// left/centre/right when span < 12. `wrap` (beside vs above/below) is DERIVED:
// a block is "beside" exactly when it shares a row with another block.
//
// Every operation takes a block array and returns a NEW array (or the SAME
// reference when the operation is a no-op / not possible). Blocks are only
// ever re-ordered and have `content.layout` rewritten -- block ids, count and
// every other content field are preserved.

export const GRID_COLUMNS = 12;
export const SPAN_PRESETS = [3, 4, 5, 6, 7, 8, 12];
export const MAX_ROW_CELLS = 4;
// Below this CONTAINER width (px of the lesson column, not the viewport) all
// rows stack into one column. 640 keeps a 768px tablet (minus page padding)
// side-by-side and every phone stacked.
export const COLLAPSE_WIDTH = 640;
export const LAYOUT_VERSION = 1;

const ALIGNS = ["start", "center", "end"];
const POSITIONS = ["left", "center", "right"];
const MOBILES = ["default", "first", "last"];

// Block types that may never share a row.
const FULL_ONLY = new Set(["page_break", "check_understanding", "worked_example", "practical", "data_graph", "compare_contrast"]);
// Minimum columns per type (a simulation dashboard or a table is unusable squeezed).
const MIN_SPAN = { simulation: 6, molecule_3d: 4, video: 4, image: 3, key_idea: 3, definition: 3, rich_text: 3, real_life: 4, common_mistake: 3, reveal_think: 4, equation: 3, topic_link: 3 };

export const minSpanFor = (type) => (FULL_ONLY.has(type) ? GRID_COLUMNS : MIN_SPAN[type] ?? 3);
export const isFullOnly = (type) => FULL_ONLY.has(type);

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** Coerces untrusted stored layout data into a clean object, or null when the
 * result carries no information (=> block is a plain full-width block). */
export function normalizeLayout(raw, type) {
  if (!isObj(raw)) return null;
  if (FULL_ONLY.has(type)) return null;
  const min = minSpanFor(type);
  let span = Number(raw.span);
  span = Number.isFinite(span) ? clamp(Math.round(span), min, GRID_COLUMNS) : GRID_COLUMNS;
  const out = { v: LAYOUT_VERSION, span };
  if (typeof raw.row === "string" && raw.row.trim() && raw.row.length <= 80) out.row = raw.row;
  out.align = ALIGNS.includes(raw.align) ? raw.align : "start";
  out.position = POSITIONS.includes(raw.position) ? raw.position : "left";
  out.mobile = MOBILES.includes(raw.mobile) ? raw.mobile : "default";
  return isDefault(out) ? null : out;
}

function isDefault(l) {
  return !l || (l.span === GRID_COLUMNS && !l.row && l.align === "start" && l.position === "left" && l.mobile === "default");
}

/** The block's normalised layout, or null for a legacy/plain block. */
export function getLayout(block) {
  return normalizeLayout(block?.content?.layout, block?.block_type);
}

export const hasLayout = (block) => getLayout(block) !== null;
export const hasAnyLayout = (blocks) => (blocks || []).some(hasLayout);

function withLayout(block, layout) {
  const content = isObj(block.content) ? { ...block.content } : {};
  const clean = layout && !isDefault(layout) ? { v: LAYOUT_VERSION, span: layout.span, ...(layout.row ? { row: layout.row } : {}), align: layout.align, position: layout.position, mobile: layout.mobile } : null;
  if (clean) content.layout = clean; else delete content.layout;
  return { ...block, content };
}

// ------------------------------------------------------------------ rows
// Internal row: { cells: [{ block, span, align, mobile }], position }
function cellOf(block) {
  const l = getLayout(block);
  return { block, span: l?.span ?? GRID_COLUMNS, align: l?.align ?? "start", mobile: l?.mobile ?? "default", position: l?.position ?? "left", rowId: l?.row ?? null };
}

function toRows(blocks) {
  const rows = [];
  for (const block of blocks || []) {
    const cell = cellOf(block);
    const prev = rows[rows.length - 1];
    if (prev && cell.rowId && prev.rowId === cell.rowId && prev.cells.length < MAX_ROW_CELLS && !isFullOnly(block.block_type)) {
      prev.cells.push(cell);
    } else {
      rows.push({ rowId: cell.rowId, position: cell.position, cells: [cell] });
    }
  }
  rows.forEach(fitRow);
  return rows;
}

/** Makes the cells of one row fit 12 columns (never below each cell's minimum). */
function fitRow(row) {
  const cells = row.cells;
  if (cells.length === 1) { return; }
  for (const c of cells) c.span = Math.max(c.span, minSpanFor(c.block.block_type));
  let total = cells.reduce((s, c) => s + c.span, 0);
  let guard = 200;
  while (total > GRID_COLUMNS && guard-- > 0) {
    // shrink the widest cell that is still above its minimum
    let pick = null;
    for (const c of cells) if (c.span > minSpanFor(c.block.block_type) && (!pick || c.span > pick.span)) pick = c;
    if (!pick) break;
    pick.span -= 1; total -= 1;
  }
  if (total > GRID_COLUMNS) {
    // minimums alone overflow: spill trailing cells into following rows (handled by caller via splitOverflow)
    row.overflow = true;
  }
}

function splitOverflow(rows) {
  const out = [];
  for (const row of rows) {
    const spilled = [];
    while (row.cells.length > 1 && row.cells.reduce((s, c) => s + c.span, 0) > GRID_COLUMNS) {
      const spill = row.cells.pop();
      spill.span = GRID_COLUMNS; spill.rowId = null;
      spilled.unshift(spill);
    }
    out.push(row);
    for (const cell of spilled) out.push({ rowId: null, position: "left", cells: [cell] });
  }
  return out;
}

function rowsToBlocks(rows) {
  const flat = splitOverflow(rows);
  const out = [];
  for (const row of flat) {
    const multi = row.cells.length > 1;
    const rowId = multi ? `r-${row.cells[0].block.id}` : null;
    for (const c of row.cells) {
      const layout = {
        v: LAYOUT_VERSION,
        span: multi ? c.span : clamp(c.span, minSpanFor(c.block.block_type), GRID_COLUMNS),
        ...(rowId ? { row: rowId } : {}),
        align: c.align,
        position: row.position,
        mobile: c.mobile,
      };
      out.push(withLayout(c.block, layout));
    }
  }
  return out;
}

/** Public: the rows of a lesson, for rendering/inspection. */
export function buildRows(blocks) {
  const rows = splitOverflow(toRows(blocks));
  return rows.map((row, index) => {
    const total = row.cells.reduce((s, c) => s + c.span, 0);
    const free = Math.max(0, GRID_COLUMNS - total);
    const offset = row.position === "center" ? Math.floor(free / 2) : row.position === "right" ? free : 0;
    return {
      index,
      id: row.cells.length > 1 ? `r-${row.cells[0].block.id}` : `s-${row.cells[0].block.id}`,
      position: row.position,
      total,
      offset,
      cells: row.cells.map((c, i) => ({ block: c.block, span: c.span, align: c.align, mobile: c.mobile, start: i === 0 && offset > 0 ? offset + 1 : null })),
    };
  });
}

/** Renderer segments. Runs of plain (layout-less) blocks are returned as a
 * single "flow" segment so they keep rendering EXACTLY like before; blocks
 * with a layout become "row" segments. A lesson with no layout at all is one
 * flow segment (=> the legacy DOM). */
export function segmentBlocks(blocks) {
  const list = blocks || [];
  if (!hasAnyLayout(list)) return [{ kind: "flow", blocks: list }];
  const rows = buildRows(list);
  const segments = [];
  for (const row of rows) {
    const plain = row.cells.length === 1 && !hasLayout(row.cells[0].block);
    if (plain) {
      const last = segments[segments.length - 1];
      if (last && last.kind === "flow") last.blocks.push(row.cells[0].block);
      else segments.push({ kind: "flow", blocks: [row.cells[0].block] });
    } else {
      segments.push({ kind: "row", row });
    }
  }
  return segments;
}

/** What the CSS does below COLLAPSE_WIDTH, as a pure function (used by tests and docs). */
export function collapsedOrder(blocks, width = 0) {
  const rows = buildRows(blocks);
  if (width >= COLLAPSE_WIDTH) return rows.flatMap((r) => r.cells.map((c) => c.block));
  return rows.flatMap((r) => {
    const first = r.cells.filter((c) => c.mobile === "first");
    const mid = r.cells.filter((c) => c.mobile === "default");
    const last = r.cells.filter((c) => c.mobile === "last");
    return [...first, ...mid, ...last].map((c) => c.block);
  });
}

// ------------------------------------------------------------ operations
function locate(rows, id) {
  for (let r = 0; r < rows.length; r += 1) {
    const c = rows[r].cells.findIndex((x) => x.block.id === id);
    if (c >= 0) return { r, c };
  }
  return null;
}
const signature = (list) => JSON.stringify(list.map((b) => [b.id, b.content?.layout ?? null]));
/** Rebuilds the block list from rows; returns the ORIGINAL array when nothing changed. */
const commit = (blocks, rows) => {
  const next = rowsToBlocks(rows);
  return signature(next) === signature(blocks) ? blocks : next;
};

function takeOut(rows, id) {
  const loc = locate(rows, id);
  if (!loc) return null;
  const row = rows[loc.r];
  const [cell] = row.cells.splice(loc.c, 1);
  if (row.cells.length === 0) rows.splice(loc.r, 1);
  else if (row.cells.length === 1) { row.cells[0].span = GRID_COLUMNS; row.cells[0].rowId = null; }
  else {
    // give the freed columns to the neighbour so the row stays full
    const nb = row.cells[Math.max(0, loc.c - 1)];
    nb.span = Math.min(GRID_COLUMNS, nb.span + cell.span);
  }
  return { cell };
}

function soloCell(cell) {
  return { rowId: null, position: "left", cells: [{ ...cell, span: GRID_COLUMNS, rowId: null }] };
}

/** Sets one block's width (columns). In a shared row the neighbours give/take space. */
export function setSpan(blocks, id, span, { fill = true } = {}) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  const row = rows[loc.r];
  const cell = row.cells[loc.c];
  const min = minSpanFor(cell.block.block_type);
  const want = clamp(Math.round(Number(span)), min, GRID_COLUMNS);
  if (!Number.isFinite(want)) return blocks;
  if (row.cells.length === 1) {
    if (cell.span === want) return blocks;
    cell.span = want;
    return commit(blocks, rows);
  }
  const others = row.cells.filter((c) => c !== cell);
  const othersMin = others.reduce((s, c) => s + minSpanFor(c.block.block_type), 0);
  const next = Math.min(want, GRID_COLUMNS - othersMin);
  if (next < min || next === cell.span) return blocks;
  cell.span = next;
  let total = row.cells.reduce((s, c) => s + c.span, 0);
  // take overflow from right neighbours first, then left
  const order = [...row.cells.slice(loc.c + 1), ...row.cells.slice(0, loc.c).reverse()];
  for (const c of order) {
    if (total <= GRID_COLUMNS) break;
    const give = Math.min(c.span - minSpanFor(c.block.block_type), total - GRID_COLUMNS);
    c.span -= give; total -= give;
  }
  if (fill && total < GRID_COLUMNS) {
    const sink = row.cells[loc.c + 1] ?? row.cells[loc.c - 1];
    sink.span += GRID_COLUMNS - total;
  }
  return commit(blocks, rows);
}

function stepSpan(current, dir, snap, min) {
  if (!snap) return clamp(current + dir, min, GRID_COLUMNS);
  const presets = SPAN_PRESETS.filter((p) => p >= min);
  if (dir > 0) return presets.find((p) => p > current) ?? current;
  return [...presets].reverse().find((p) => p < current) ?? current;
}
export function widen(blocks, id, { snap = true } = {}) {
  const l = getLayout(blocks.find((b) => b.id === id));
  const cur = l?.span ?? GRID_COLUMNS;
  const b = blocks.find((x) => x.id === id);
  if (!b) return blocks;
  const next = stepSpan(cur, 1, snap, minSpanFor(b.block_type));
  return next === cur ? blocks : setSpan(blocks, id, next);
}
export function narrow(blocks, id, { snap = true } = {}) {
  const b = blocks.find((x) => x.id === id);
  if (!b) return blocks;
  const cur = getLayout(b)?.span ?? GRID_COLUMNS;
  const next = stepSpan(cur, -1, snap, minSpanFor(b.block_type));
  return next === cur ? blocks : setSpan(blocks, id, next);
}

/** Drop `id` beside `targetId` ("left" or "right" of it), joining the target's row. */
export function placeBeside(blocks, id, targetId, side = "right") {
  if (id === targetId) return blocks;
  const rows = toRows(blocks);
  const mover = blocks.find((b) => b.id === id);
  const target = blocks.find((b) => b.id === targetId);
  if (!mover || !target || isFullOnly(mover.block_type) || isFullOnly(target.block_type)) return blocks;
  const tLoc0 = locate(rows, targetId);
  const mLoc0 = locate(rows, id);
  if (tLoc0 && mLoc0 && tLoc0.r === mLoc0.r) {
    // already in the same row: just reorder within it
    const row = rows[tLoc0.r];
    const [cell] = row.cells.splice(mLoc0.c, 1);
    const ti = row.cells.findIndex((c) => c.block.id === targetId);
    row.cells.splice(side === "left" ? ti : ti + 1, 0, cell);
    return commit(blocks, rows);
  }
  const removed = takeOut(rows, id);
  if (!removed) return blocks;
  const tLoc = locate(rows, targetId);
  const row = rows[tLoc.r];
  if (row.cells.length >= MAX_ROW_CELLS) return blocks;
  const moverMin = minSpanFor(mover.block_type);
  const cell = removed.cell;
  const n = row.cells.length + 1;
  if (row.cells.length === 1) {
    const mediaFirst = ["image", "video", "molecule_3d"].includes(mover.block_type) && !["image", "video", "molecule_3d"].includes(target.block_type);
    const mSpan = mediaFirst ? 5 : 6;
    cell.span = Math.max(moverMin, mSpan);
    row.cells[0].span = GRID_COLUMNS - cell.span;
    if (row.cells[0].span < minSpanFor(target.block_type)) { row.cells[0].span = minSpanFor(target.block_type); cell.span = GRID_COLUMNS - row.cells[0].span; }
    if (cell.span < moverMin) return blocks;
  } else {
    const total = row.cells.reduce((s, c) => s + c.span, 0);
    const free = GRID_COLUMNS - total;
    if (free >= moverMin) { cell.span = Math.min(free, 4); }
    else {
      const base = Math.floor(GRID_COLUMNS / n);
      row.cells.forEach((c) => { c.span = base; });
      cell.span = GRID_COLUMNS - base * row.cells.length;
      if (cell.span < moverMin || row.cells.some((c) => c.span < minSpanFor(c.block.block_type))) return blocks;
    }
  }
  const ti = row.cells.findIndex((c) => c.block.id === targetId);
  row.cells.splice(side === "left" ? ti : ti + 1, 0, cell);
  return commit(blocks, rows);
}

/** Move `id` into its own full-width row immediately before/after the row containing `targetId`. */
function moveRelative(blocks, id, targetId, after) {
  if (id === targetId) return blocks;
  const rows = toRows(blocks);
  const tLoc = locate(rows, targetId);
  const mLoc = locate(rows, id);
  if (!tLoc || !mLoc) return blocks;
  if (tLoc.r === mLoc.r && rows[tLoc.r].cells.length === 1) return blocks;
  const targetRow = rows[tLoc.r];
  const removed = takeOut(rows, id);
  const idx = rows.indexOf(targetRow);
  const insertAt = idx < 0 ? rows.length : after ? idx + 1 : idx;
  rows.splice(insertAt, 0, soloCell(removed.cell));
  const out = commit(blocks, rows);
  return out;
}
export const moveBefore = (blocks, id, targetId) => moveRelative(blocks, id, targetId, false);
export const moveAfter = (blocks, id, targetId) => moveRelative(blocks, id, targetId, true);

/** Move up: out of a shared row (above it), else swap with the previous row. */
export function moveUp(blocks, id) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  const row = rows[loc.r];
  if (row.cells.length > 1) {
    const removed = takeOut(rows, id);
    rows.splice(rows.indexOf(row) < 0 ? loc.r : rows.indexOf(row), 0, soloCell(removed.cell));
    return commit(blocks, rows);
  }
  if (loc.r === 0) return blocks;
  [rows[loc.r - 1], rows[loc.r]] = [rows[loc.r], rows[loc.r - 1]];
  return commit(blocks, rows);
}
export function moveDown(blocks, id) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  const row = rows[loc.r];
  if (row.cells.length > 1) {
    const removed = takeOut(rows, id);
    const at = rows.indexOf(row);
    rows.splice(at < 0 ? loc.r + 1 : at + 1, 0, soloCell(removed.cell));
    return commit(blocks, rows);
  }
  if (loc.r === rows.length - 1) return blocks;
  [rows[loc.r + 1], rows[loc.r]] = [rows[loc.r], rows[loc.r + 1]];
  return commit(blocks, rows);
}
/** Swap with the left neighbour inside a shared row (no-op for a solo block or the first cell). */
export function moveLeft(blocks, id) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc || loc.c === 0) return blocks;
  const cells = rows[loc.r].cells;
  [cells[loc.c - 1], cells[loc.c]] = [cells[loc.c], cells[loc.c - 1]];
  return commit(blocks, rows);
}
export function moveRight(blocks, id) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc || loc.c >= rows[loc.r].cells.length - 1) return blocks;
  const cells = rows[loc.r].cells;
  [cells[loc.c + 1], cells[loc.c]] = [cells[loc.c], cells[loc.c + 1]];
  return commit(blocks, rows);
}

/** Put the block alone on a full-width row, keeping its place in the order. */
export function ungroup(blocks, id) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc || rows[loc.r].cells.length === 1) return blocks;
  const row = rows[loc.r];
  const removed = takeOut(rows, id);
  const at = rows.indexOf(row);
  rows.splice(at < 0 ? loc.r : (loc.c === 0 ? at : at + 1), 0, soloCell(removed.cell));
  return commit(blocks, rows);
}
/** Join the previous (dir=-1) or next (dir=1) row. Keyboard-friendly "place beside". */
export function placeBesideNeighbour(blocks, id, dir) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  const row = rows[loc.r];
  const nb = rows[loc.r + dir];
  if (!nb) return blocks;
  if (row.cells.length > 1) return blocks; // already beside something; use ungroup first
  const target = dir < 0 ? nb.cells[nb.cells.length - 1] : nb.cells[0];
  return placeBeside(blocks, id, target.block.id, dir < 0 ? "right" : "left");
}
/** Wrap setting: "beside" joins the next block (else the previous); "stack" ungroups. */
export function setWrap(blocks, id, mode) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  const shared = rows[loc.r].cells.length > 1;
  if (mode === "stack") return shared ? ungroup(blocks, id) : blocks;
  if (shared) return blocks;
  const next = placeBesideNeighbour(blocks, id, 1);
  return next !== blocks ? next : placeBesideNeighbour(blocks, id, -1);
}
export const getWrap = (blocks, id) => { const rows = toRows(blocks); const loc = locate(rows, id); return loc && rows[loc.r].cells.length > 1 ? "beside" : "stack"; };

function patchCell(blocks, id, fn) {
  const rows = toRows(blocks);
  const loc = locate(rows, id);
  if (!loc) return blocks;
  fn(rows[loc.r], rows[loc.r].cells[loc.c]);
  return commit(blocks, rows);
}
export const setAlign = (blocks, id, align) => (ALIGNS.includes(align) ? patchCell(blocks, id, (_r, c) => { c.align = align; }) : blocks);
export const setPosition = (blocks, id, position) => (POSITIONS.includes(position) ? patchCell(blocks, id, (r) => { r.position = position; }) : blocks);
export const setMobile = (blocks, id, mobile) => (MOBILES.includes(mobile) ? patchCell(blocks, id, (_r, c) => { c.mobile = mobile; }) : blocks);

/** Insert an already-created block (e.g. a duplicate) right after `afterId`'s row, full width. */
export function insertAfter(blocks, newBlock, afterId) {
  const base = { ...newBlock, content: isObj(newBlock.content) ? { ...newBlock.content } : {} };
  delete base.content.layout;
  const rows = toRows(blocks);
  const loc = afterId ? locate(rows, afterId) : null;
  rows.splice(loc ? loc.r + 1 : rows.length, 0, soloCell(cellOf(base)));
  return commit(blocks, rows);
}

/** Lay out `ids` (existing blocks, already adjacent or not) as one preset row. */
export const LAYOUT_PRESETS = {
  "image-text": { label: "Image + text", spans: [5, 7], types: ["image", "rich_text"] },
  "text-image": { label: "Text + image", spans: [7, 5], types: ["rich_text", "image"] },
  "three-columns": { label: "Three columns", spans: [4, 4, 4], types: ["rich_text", "rich_text", "rich_text"] },
};
export function applyPresetRow(blocks, ids, spans) {
  const present = ids.filter((id) => blocks.some((b) => b.id === id));
  if (present.length < 2 || present.length > MAX_ROW_CELLS || present.length !== spans.length || new Set(present).size !== present.length) return blocks;
  if (present.some((id) => isFullOnly(blocks.find((b) => b.id === id).block_type))) return blocks;
  if (spans.some((sp, i) => sp < minSpanFor(blocks.find((b) => b.id === present[i]).block_type) || sp > GRID_COLUMNS) || spans.reduce((a, b) => a + b, 0) > GRID_COLUMNS) return blocks;
  const rows = toRows(blocks);
  const cells = [];
  const first = locate(rows, present[0]);
  const placeholder = { rowId: null, position: "left", cells: [] };
  rows.splice(first.r, 0, placeholder); // keeps the preset where its first block was
  for (const id of present) {
    const removed = takeOut(rows, id);
    if (removed) cells.push(removed.cell);
  }
  cells.forEach((c, i) => { c.span = spans[i]; c.align = "start"; c.mobile = "default"; });
  rows.splice(rows.indexOf(placeholder), 1, { rowId: "tmp", position: "left", cells });
  return commit(blocks, rows);
}

/** Delete a block from the list; its row neighbour absorbs the freed columns. */
export function removeBlock(blocks, id) {
  if (!(blocks || []).some((b) => b.id === id)) return blocks;
  if (!hasAnyLayout(blocks)) return blocks.filter((b) => b.id !== id);
  const rows = toRows(blocks);
  if (!takeOut(rows, id)) return blocks;
  return rowsToBlocks(rows);
}

/** Remove every layout: back to the linear one-after-another lesson. */
export function toLinear(blocks) {
  return (blocks || []).map((b) => withLayout(b, null));
}
/** Normalise: rewrite every block's layout into canonical form (idempotent). */
export function normalizeBlocks(blocks) {
  if (!(blocks || []).some((b) => isObj(b?.content) && b.content.layout !== undefined)) return blocks;
  return commit(blocks, toRows(blocks));
}

/** Human description of where a block currently is (for aria-live announcements). */
export function describePlacement(blocks, id) {
  const rows = buildRows(blocks);
  for (const row of rows) {
    const i = row.cells.findIndex((c) => c.block.id === id);
    if (i >= 0) {
      const cell = row.cells[i];
      const beside = row.cells.length > 1 ? `, ${i + 1} of ${row.cells.length} beside each other` : ", on its own row";
      return `row ${row.index + 1} of ${rows.length}${beside}, ${cell.span} of 12 columns wide`;
    }
  }
  return "";
}

/** Structural validation. Valid input + any operation here must always stay valid. */
export function validateLayout(blocks) {
  const errors = [];
  const list = blocks || [];
  const seen = new Set();
  for (const b of list) { if (seen.has(b.id)) errors.push(`duplicate id ${b.id}`); seen.add(b.id); }
  // raw adjacency of row ids
  const rowSeen = new Map();
  let prevRow = null;
  for (const b of list) {
    const raw = b.content?.layout;
    const rid = isObj(raw) && typeof raw.row === "string" ? raw.row : null;
    if (rid) {
      if (rid !== prevRow && rowSeen.has(rid)) errors.push(`row ${rid} is split into non-adjacent parts`);
      rowSeen.set(rid, (rowSeen.get(rid) || 0) + 1);
    }
    prevRow = rid;
    if (isObj(raw) && raw.span !== undefined && !(Number.isInteger(raw.span) && raw.span >= 1 && raw.span <= GRID_COLUMNS)) errors.push(`block ${b.id}: span out of range`);
    if (isFullOnly(b.block_type) && rid) errors.push(`block ${b.id}: ${b.block_type} cannot share a row`);
  }
  const groups = new Map();
  for (const b of list) { const l = getLayout(b); if (l?.row) { if (!groups.has(l.row)) groups.set(l.row, []); groups.get(l.row).push(l); } }
  for (const [rid, ls] of groups) {
    const total = ls.reduce((s, l) => s + l.span, 0);
    if (total > GRID_COLUMNS) errors.push(`row ${rid}: spans sum to ${total} (> 12)`);
    if (ls.length > MAX_ROW_CELLS) errors.push(`row ${rid}: more than ${MAX_ROW_CELLS} blocks`);
    if (ls.length < 2) errors.push(`row ${rid}: single-member row id`);
  }
  for (const b of list) {
    const l = getLayout(b);
    if (l && l.span < minSpanFor(b.block_type)) errors.push(`block ${b.id}: below minimum width`);
  }
  return { valid: errors.length === 0, errors };
}
