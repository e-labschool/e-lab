// Canvas arrangement of Learn lesson blocks (no React, no DOM, no Supabase).
//
// SAME data model as blockLayout.js, one more shape of `content.layout`:
//   classic (v1): { v:1, span, row?, align, position, mobile }   linear order + rows of adjacent blocks
//   canvas  (v2): { v:2, span, col, gr, rs, align, mobile }      col 1-12, gr = grid row (>=1), rs = height in rows
// A lesson is "canvas" when ANY block carries `col` + `gr`. Both shapes are readable at any time; switching view
// converts the whole lesson deterministically (toCanvas / toClassic) and keeps every block's content untouched.
//
// Invariants (checked by validateCanvas and the random-operation tests):
//   - blocks never overlap, stay inside columns 1..12, are at least minSpanFor(type) wide (full-only types are 12 wide)
//   - every operation returns the SAME array when it is a no-op
// Students: the renderer maps placements to a CSS grid with NATURAL height (see canvasGrid) and stacks in reading order
// (top-to-bottom, left-to-right) below 640px. `rs` is only a size hint for the editor and for relative row spans.
import { GRID_COLUMNS, MAX_ROW_SPAN, DEFAULT_ROW_SPAN, CANVAS_VERSION, MAX_ROW_CELLS, getLayout, minSpanFor, isFullOnly, withLayout, buildRows, _internals } from "./blockLayout.js";

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

const DEFAULT_ROWS = { page_break: 1, topic_link: 2, equation: 3, key_idea: 3, definition: 3, check_understanding: 3, image: 6, video: 6, simulation: 6, molecule_3d: 6, data_graph: 6 };
export const defaultRows = (type) => DEFAULT_ROWS[type] ?? DEFAULT_ROW_SPAN;

// ---------------------------------------------------------------- editor-only preview height (classic): content.ui.h
export function getUiHeight(block) {
  const h = Number(block?.content?.ui?.h);
  return Number.isFinite(h) ? clamp(Math.round(h), 1, MAX_ROW_SPAN) : defaultRows(block?.block_type);
}
function withUiHeight(block, h) {
  const content = isObj(block.content) ? { ...block.content } : {};
  const ui = isObj(content.ui) ? { ...content.ui } : {};
  if (h === defaultRows(block.block_type) || !Number.isFinite(h)) delete ui.h; else ui.h = clamp(Math.round(h), 1, MAX_ROW_SPAN);
  if (Object.keys(ui).length) content.ui = ui; else delete content.ui;
  return { ...block, content };
}
/** Classic view: change one block's preview height (editor-only; the student page is unaffected). */
export function setUiHeight(blocks, id, h) {
  const b = (blocks || []).find((x) => x.id === id);
  if (!b || getUiHeight(b) === clamp(Math.round(h), 1, MAX_ROW_SPAN)) return blocks;
  return blocks.map((x) => (x.id === id ? withUiHeight(x, clamp(Math.round(h), 1, MAX_ROW_SPAN)) : x));
}

// ---------------------------------------------------------------- reading
export const canvasLayoutOf = (block) => { const l = getLayout(block); return l && l.col ? l : null; };
export const isCanvas = (blocks) => (blocks || []).some((b) => canvasLayoutOf(b));

const overlap = (a, b) => a.col < b.col + b.span && b.col < a.col + a.span && a.gr < b.gr + b.rs && b.gr < a.gr + a.rs;
const byPos = (a, b) => a.gr - b.gr || a.col - b.col || a.i - b.i;
const bottomOf = (pls) => pls.reduce((m, p) => Math.max(m, p.gr + p.rs), 1);

/** The resolved, overlap-free placements of a canvas lesson, in the input order. Idempotent on valid data; repairs
 * overlapping / out-of-range / missing placements deterministically (sweep in reading order, push down on collision). */
export function placements(blocks) {
  const list = blocks || [];
  const valid = []; const missing = [];
  list.forEach((b, i) => {
    const l = canvasLayoutOf(b);
    if (l) valid.push({ id: b.id, i, col: l.col, span: l.span, gr: l.gr, rs: l.rs });
    else missing.push({ id: b.id, i, col: 1, span: GRID_COLUMNS, gr: 0, rs: getUiHeight(b) });
  });
  const placed = [];
  for (const p of [...valid].sort(byPos)) {
    const q = { ...p };
    while (placed.some((o) => overlap(q, o))) q.gr += 1;
    placed.push(q);
  }
  for (const p of missing) {
    const q = { ...p, gr: bottomOf(placed) };
    placed.push(q);
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return list.map((b) => { const p = byId.get(b.id); return { id: p.id, col: p.col, span: p.span, gr: p.gr, rs: p.rs }; });
}

/** Blocks in reading order: top to bottom, then left to right. */
export function readingOrder(blocks) {
  const pl = new Map(placements(blocks).map((p, i) => [p.id, { ...p, i }]));
  return [...(blocks || [])].sort((a, b) => byPos(pl.get(a.id), pl.get(b.id)));
}

/** Student rendering plan: cells in reading order with row lines compacted (empty bands removed) so natural heights
 * never leave holes:  [{ block, col, span, r, rs }]  (r = first CSS grid row, rs = rows spanned). */
export function canvasGrid(blocks) {
  const pls = placements(blocks);
  const byId = new Map((blocks || []).map((b) => [b.id, b]));
  const lines = [...new Set(pls.flatMap((p) => [p.gr, p.gr + p.rs]))].sort((a, b) => a - b);
  const kept = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (pls.some((p) => p.gr <= lines[i] && p.gr + p.rs >= lines[i + 1])) kept.push([lines[i], lines[i + 1]]);
  }
  const cells = pls.map((p, i) => {
    const r = kept.filter(([s]) => s < p.gr).length + 1;
    const rEnd = kept.filter(([, e]) => e <= p.gr + p.rs).length + 1;
    return { block: byId.get(p.id), col: p.col, span: p.span, r, rs: Math.max(1, rEnd - r), gr: p.gr, i };
  });
  return cells.sort((a, b) => a.gr - b.gr || a.col - b.col || a.i - b.i).map(({ gr: _g, i: _i, ...c }) => c);
}

function applyPlacements(blocks, pls) {
  const by = new Map(pls.map((p) => [p.id, p]));
  let changed = false;
  const next = blocks.map((b) => {
    const p = by.get(b.id);
    if (!p) return b;
    const cur = canvasLayoutOf(b);
    if (cur && cur.col === p.col && cur.span === p.span && cur.gr === p.gr && cur.rs === p.rs) return b;
    changed = true;
    return withLayout(b, { span: p.span, col: p.col, gr: p.gr, rs: p.rs, align: cur?.align ?? "start", mobile: cur?.mobile ?? "default" });
  });
  // keep the stored block order (learn_blocks.position) equal to reading order, so page breaks / pagination stay correct
  return changed ? readingOrder(next) : blocks;
}

// ---------------------------------------------------------------- conversions
/** Classic (rows) -> canvas. Rows stack top to bottom; cells keep their columns. Legacy lessons become full-width stacks. */
export function toCanvas(blocks) {
  const rows = buildRows(blocks || []);
  const out = new Map();
  let y = 1;
  for (const row of rows) {
    let col = row.offset + 1;
    let h = 1;
    for (const cell of row.cells) {
      const rs = getUiHeight(cell.block);
      h = Math.max(h, rs);
      out.set(cell.block.id, withLayout(withoutUiHeight(cell.block), { span: cell.span, col, gr: y, rs, align: cell.align, mobile: cell.mobile }));
      col += cell.span;
    }
    y += h;
  }
  return (blocks || []).map((b) => out.get(b.id) ?? b);
}
const withoutUiHeight = (b) => (b.content?.ui?.h !== undefined ? withUiHeight(b, defaultRows(b.block_type)) : b);

/** Canvas -> classic. Reading order becomes the block order; blocks that start on the same grid row (and fit) form a row. */
export function toClassic(blocks) {
  const list = blocks || [];
  if (!isCanvas(list)) return list;
  const pls = new Map(placements(list).map((p) => [p.id, p]));
  const ordered = readingOrder(list);
  const rows = [];
  let cur = null;
  for (const b of ordered) {
    const p = pls.get(b.id);
    const l = canvasLayoutOf(b);
    const plain = withLayout(withUiHeight(b, p.rs), null);
    const cell = { block: plain, span: p.span, align: l?.align ?? "start", mobile: l?.mobile ?? "default", position: "left", rowId: null };
    if (cur && cur.gr === p.gr && cur.cells.length < MAX_ROW_CELLS && !isFullOnly(b.block_type) && !isFullOnly(cur.cells[0].block.block_type) && cur.end <= p.col) {
      cur.cells.push(cell); cur.end = p.col + p.span; cur.last = p;
    } else {
      cur = { gr: p.gr, rowId: null, position: "left", cells: [cell], first: p, last: p, end: p.col + p.span };
      rows.push(cur);
    }
  }
  for (const row of rows) {
    const total = row.cells.reduce((s, c) => s + c.span, 0);
    row.position = row.first.col === 1 || total >= GRID_COLUMNS ? "left" : row.end === GRID_COLUMNS + 1 ? "right" : "center";
    if (row.cells.length > 1) row.rowId = "tmp";
  }
  return _internals.rowsToBlocks(rows);
}

/** Greedy left-to-right flow of `list` into canvas rows, keeping each block's width and height. */
export function flowPlace(list) {
  let col = 1; let y = 1; let h = 0;
  return list.map((b) => {
    const l = canvasLayoutOf(b);
    const span = isFullOnly(b.block_type) ? GRID_COLUMNS : l?.span ?? GRID_COLUMNS;
    const rs = l?.rs ?? getUiHeight(b);
    if (col + span > GRID_COLUMNS + 1 || isFullOnly(b.block_type)) { y += h; col = 1; h = 0; }
    const nb = withLayout(b, { span, col, gr: y, rs, align: l?.align ?? "start", mobile: l?.mobile ?? "default" });
    col += span; h = Math.max(h, rs);
    if (isFullOnly(b.block_type)) { y += h; col = 1; h = 0; }
    return nb;
  });
}

// ---------------------------------------------------------------- placement search
function nearestFree(others, want) {
  if (!others.some((o) => overlap(want, o))) return want;
  const bottom = bottomOf(others) + 1;
  let best = null;
  for (let gr = Math.max(1, want.gr - 60); gr <= bottom; gr += 1) {
    for (let col = 1; col <= GRID_COLUMNS - want.span + 1; col += 1) {
      const cand = { ...want, col, gr };
      if (others.some((o) => overlap(cand, o))) continue;
      const cost = (col - want.col) ** 2 + (gr - want.gr) ** 2;
      if (!best || cost < best.cost || (cost === best.cost && (gr < best.gr || (gr === best.gr && col < best.col)))) best = { cost, gr, col };
    }
  }
  return best ? { ...want, col: best.col, gr: best.gr } : { ...want, col: 1, gr: bottom };
}

/** Put `target` where it is and push every colliding block down (cascading, in reading order). Returns all placements. */
function pushPlace(others, target) {
  const placed = [target];
  for (const o of others.map((p, i) => ({ ...p, i })).sort(byPos)) {
    const q = { id: o.id, col: o.col, span: o.span, gr: o.gr, rs: o.rs };
    while (placed.some((p) => overlap(q, p))) q.gr += 1;
    placed.push(q);
  }
  return placed;
}

const find = (pls, id) => pls.find((p) => p.id === id);
const blockOf = (blocks, id) => (blocks || []).find((b) => b.id === id);

/** Move to column `col`, grid row `gr`. collision: "nearest" (snap to the nearest free slot) | "push" (push followers down). */
export function moveTo(blocks, id, col, gr, { collision = "nearest" } = {}) {
  if (!isCanvas(blocks)) return blocks;
  const pls = placements(blocks);
  const me = find(pls, id);
  if (!me || !Number.isFinite(col) || !Number.isFinite(gr)) return blocks;
  const want = { ...me, col: clamp(Math.round(col), 1, GRID_COLUMNS - me.span + 1), gr: Math.max(1, Math.round(gr)) };
  const others = pls.filter((p) => p.id !== id);
  const result = collision === "push" ? pushPlace(others, want) : [...others, nearestFree(others, want)];
  return applyPlacements(blocks, result);
}

/** Resize to `span` columns and/or `rs` rows. Never overlaps: "nearest" stops WIDTH at the first obstacle, "push" also pushes followers sideways-blocked blocks down; extra height always pushes followers down. */
export function resizeTo(blocks, id, { span, rs, collision = "nearest" } = {}) {
  if (!isCanvas(blocks)) return blocks;
  const pls = placements(blocks);
  const me = find(pls, id);
  const b = blockOf(blocks, id);
  if (!me || !b) return blocks;
  const min = minSpanFor(b.block_type);
  let sp = span === undefined ? me.span : clamp(Math.round(span), min, GRID_COLUMNS - me.col + 1);
  let h = rs === undefined ? me.rs : clamp(Math.round(rs), 1, MAX_ROW_SPAN);
  if (isFullOnly(b.block_type)) sp = GRID_COLUMNS;
  const others = pls.filter((p) => p.id !== id);
  if (collision === "push") return applyPlacements(blocks, pushPlace(others, { ...me, span: sp, rs: h }));
  // width stops at the first obstacle; height never does (there is always room below), followers are pushed down
  const fitsW = (s) => !others.some((o) => overlap({ ...me, span: s, rs: h }, o));
  let s2 = sp;
  while (s2 > me.span && !fitsW(s2)) s2 -= 1;
  return applyPlacements(blocks, pushPlace(others, { ...me, span: s2, rs: h }));
}

/** Keyboard step: move by whole columns / rows (followers are pushed down so the move always succeeds when in range). */
export function nudge(blocks, id, dc, dr) {
  const me = find(placements(blocks), id);
  if (!me) return blocks;
  return moveTo(blocks, id, me.col + dc, me.gr + dr, { collision: "push" });
}
/** Keyboard resize: grow/shrink by columns / rows (stops at obstacles instead of pushing). */
export function growBy(blocks, id, dspan, drs) {
  const me = find(placements(blocks), id);
  if (!me) return blocks;
  return resizeTo(blocks, id, { span: me.span + dspan, rs: me.rs + drs, collision: "nearest" });
}
export function setSpanCanvas(blocks, id, span) { return resizeTo(blocks, id, { span, collision: "nearest" }); }

/** Insert a new block under `afterId` (or at the bottom), full width, pushing followers down. */
export function insertAfter(blocks, newBlock, afterId) {
  const list = blocks || [];
  const pls = placements(list);
  const after = afterId ? find(pls, afterId) : null;
  const gr = after ? after.gr + after.rs : bottomOf(pls);
  const nb = withLayout({ ...newBlock, content: isObj(newBlock.content) ? { ...newBlock.content } : {} }, { span: GRID_COLUMNS, col: 1, gr, rs: getUiHeight(newBlock), align: "start", mobile: "default" });
  const at = afterId ? list.findIndex((b) => b.id === afterId) : -1;
  const next = [...list]; next.splice(at < 0 ? next.length : at + 1, 0, nb);
  return moveTo(next, nb.id, 1, gr, { collision: "push" });
}
export function removeBlock(blocks, id) { return (blocks || []).some((b) => b.id === id) ? blocks.filter((b) => b.id !== id) : blocks; }

/** Phone list: swap with the previous/next block in reading order and re-flow the canvas (widths and heights are kept). */
export function moveReading(blocks, id, dir) {
  const order = readingOrder(blocks);
  const i = order.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return blocks;
  [order[i], order[j]] = [order[j], order[i]];
  return flowPlace(order);
}

export function validateCanvas(blocks) {
  const errors = [];
  const list = blocks || [];
  const ls = list.map((b) => ({ b, l: canvasLayoutOf(b) }));
  const seen = new Set();
  for (const { b, l } of ls) {
    if (seen.has(b.id)) errors.push(`duplicate id ${b.id}`);
    seen.add(b.id);
    if (!l) { errors.push(`block ${b.id}: no canvas placement`); continue; }
    if (l.col < 1 || l.col + l.span > GRID_COLUMNS + 1) errors.push(`block ${b.id}: outside the 12 columns`);
    if (l.span < minSpanFor(b.block_type)) errors.push(`block ${b.id}: below minimum width`);
    if (l.gr < 1 || l.rs < 1) errors.push(`block ${b.id}: bad row`);
  }
  const ps = ls.filter((x) => x.l).map(({ b, l }) => ({ id: b.id, col: l.col, span: l.span, gr: l.gr, rs: l.rs }));
  for (let i = 0; i < ps.length; i += 1) for (let j = i + 1; j < ps.length; j += 1) if (overlap(ps[i], ps[j])) errors.push(`blocks ${ps[i].id} and ${ps[j].id} overlap`);
  return { valid: errors.length === 0, errors };
}

export function describeCanvas(blocks, id) {
  const pls = placements(blocks);
  const me = find(pls, id);
  if (!me) return "";
  const beside = pls.filter((p) => p.id !== id && p.gr < me.gr + me.rs && me.gr < p.gr + p.rs).length;
  const order = readingOrder(blocks).findIndex((b) => b.id === id) + 1;
  return `position ${order} of ${pls.length}, columns ${me.col} to ${me.col + me.span - 1} of 12, grid row ${me.gr}, ${me.rs} rows tall${beside ? `, ${beside} beside it` : ", on its own rows"}`;
}

export { CANVAS_VERSION };
