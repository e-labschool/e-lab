// Named layout operations used by the Learn editor's buttons, keyboard shortcuts and
// drag-and-drop, each returning { blocks, changed, message } where `message` is the text
// announced to screen readers (aria-live). Pure: no React / DOM.
import * as L from "./blockLayout.js";
import * as C from "./blockCanvas.js";

const LABEL = {
  rich_text: "Text", image: "Image", video: "Video", equation: "Equation", molecule_3d: "3D molecule", simulation: "Simulation",
  key_idea: "Key idea", definition: "Definition", common_mistake: "Common mistake", real_life: "Real-life connection",
  worked_example: "Worked example", data_graph: "Data graph", compare_contrast: "Compare and contrast", reveal_think: "Reveal and think",
  practical: "Practical", page_break: "Page break", check_understanding: "Check your understanding", topic_link: "Linked topic",
};
export const blockLabel = (block) => LABEL[block?.block_type] ?? "Block";

const stepSpanOf = (blocks, id, dir, snap = true) => {
  const b = blocks.find((x) => x.id === id);
  if (!b) return blocks;
  const cur = L.getLayout(b)?.span ?? L.GRID_COLUMNS;
  const min = L.minSpanFor(b.block_type);
  if (!snap) return L.setSpanFlow(blocks, id, Math.min(L.GRID_COLUMNS, Math.max(min, cur + dir)));
  const presets = L.SPAN_PRESETS.filter((p) => p >= min);
  const next = dir > 0 ? presets.find((p) => p > cur) : [...presets].reverse().find((p) => p < cur);
  return next == null || next === cur ? blocks : L.setSpanFlow(blocks, id, next);
};

// Classic arrangement: linear order + rows of adjacent blocks.
const OPS = {
  up: { fn: (b, id) => L.moveUp(b, id), verb: "move up" },
  down: { fn: (b, id) => L.moveDown(b, id), verb: "move down" },
  left: { fn: (b, id) => L.moveLeft(b, id), verb: "move left (only possible inside a shared row)" },
  right: { fn: (b, id) => L.moveRight(b, id), verb: "move right (only possible inside a shared row)" },
  wider: { fn: (b, id, a) => stepSpanOf(b, id, 1, a?.snap !== false), verb: "get wider" },
  narrower: { fn: (b, id, a) => stepSpanOf(b, id, -1, a?.snap !== false), verb: "get narrower" },
  span: { fn: (b, id, a) => L.setSpanFlow(b, id, a?.span), verb: "change width" },
  taller: { fn: (b, id) => C.setUiHeight(b, id, C.getUiHeight(b.find((x) => x.id === id) ?? {}) + 1), verb: "get taller" },
  shorter: { fn: (b, id) => C.setUiHeight(b, id, C.getUiHeight(b.find((x) => x.id === id) ?? {}) - 1), verb: "get shorter" },
  height: { fn: (b, id, a) => C.setUiHeight(b, id, a?.h), verb: "change height" },
  besidePrev: { fn: (b, id) => L.placeBesideNeighbour(b, id, -1), verb: "go beside the previous block" },
  besideNext: { fn: (b, id) => L.placeBesideNeighbour(b, id, 1), verb: "go beside the next block" },
  separate: { fn: (b, id) => L.ungroup(b, id), verb: "leave its row" },
  wrapBeside: { fn: (b, id) => L.setWrap(b, id, "beside"), verb: "sit beside another block" },
  wrapStack: { fn: (b, id) => L.setWrap(b, id, "stack"), verb: "sit above or below" },
  align: { fn: (b, id, a) => L.setAlign(b, id, a?.value), verb: "change vertical alignment" },
  position: { fn: (b, id, a) => L.setPosition(b, id, a?.value), verb: "change position" },
  mobile: { fn: (b, id, a) => L.setMobile(b, id, a?.value), verb: "change phone order" },
  before: { fn: (b, id, a) => L.moveBefore(b, id, a?.targetId), verb: "move there" },
  after: { fn: (b, id, a) => L.moveAfter(b, id, a?.targetId), verb: "move there" },
  beside: { fn: (b, id, a) => L.placeBeside(b, id, a?.targetId, a?.side), verb: "go beside that block" },
  reading: { fn: (b, id, a) => (a?.dir < 0 ? L.moveUp(b, id) : L.moveDown(b, id)), verb: "move" },
};
// Canvas arrangement: free placement on the 12-column grid, never overlapping.
const CANVAS_OPS = {
  up: { fn: (b, id) => C.nudge(b, id, 0, -1), verb: "move up" },
  down: { fn: (b, id) => C.nudge(b, id, 0, 1), verb: "move down" },
  left: { fn: (b, id) => C.nudge(b, id, -1, 0), verb: "move left" },
  right: { fn: (b, id) => C.nudge(b, id, 1, 0), verb: "move right" },
  wider: { fn: (b, id) => C.growBy(b, id, 1, 0), verb: "get wider" },
  narrower: { fn: (b, id) => C.growBy(b, id, -1, 0), verb: "get narrower" },
  taller: { fn: (b, id) => C.growBy(b, id, 0, 1), verb: "get taller" },
  shorter: { fn: (b, id) => C.growBy(b, id, 0, -1), verb: "get shorter" },
  span: { fn: (b, id, a) => C.resizeTo(b, id, { span: a?.span }), verb: "change width" },
  height: { fn: (b, id, a) => C.resizeTo(b, id, { rs: a?.h }), verb: "change height" },
  moveTo: { fn: (b, id, a) => C.moveTo(b, id, a?.col, a?.gr, { collision: a?.collision }), verb: "move there" },
  resizeTo: { fn: (b, id, a) => C.resizeTo(b, id, { span: a?.span, rs: a?.rs, collision: a?.collision }), verb: "resize" },
  align: { fn: (b, id, a) => L.setAlign(b, id, a?.value), verb: "change vertical alignment" },
  reading: { fn: (b, id, a) => C.moveReading(b, id, a?.dir < 0 ? -1 : 1), verb: "move" },
};

/** Where a block is, in words (for aria-live), in whichever arrangement the lesson uses. */
export const describeBlock = (blocks, id) => (C.isCanvas(blocks) ? C.describeCanvas(blocks, id) : L.describePlacement(blocks, id));

export function runLayoutOp(blocks, name, id, arg) {
  const canvas = C.isCanvas(blocks);
  const op = (canvas ? CANVAS_OPS : OPS)[name];
  const block = (blocks || []).find((b) => b.id === id);
  if (!block) return { blocks, changed: false, message: "" };
  if (!op) return { blocks, changed: false, message: `${blockLabel(block)}: that action is not available in the ${canvas ? "Canvas" : "Classic"} view.` };
  const label = blockLabel(block);
  const next = op.fn(blocks, id, arg);
  if (next === blocks) return { blocks, changed: false, message: `${label} cannot ${op.verb} any further.` };
  const verbDone = { up: "moved up", down: "moved down", left: "moved left", right: "moved right", wider: "made wider", narrower: "made narrower", taller: "made taller", shorter: "made shorter" }[name] ?? "updated";
  return { blocks: next, changed: true, message: `${label} ${verbDone}: ${describeBlock(next, id)}.` };
}

/** Key handling for a selected block. Arrow (or Alt+Arrow) = move, Shift+Arrow (or Alt+Shift+Arrow) = resize:
 * Left/Right = narrower/wider, Up/Down = shorter/taller. */
export function opForKey(e) {
  if (e.ctrlKey || e.metaKey) return null;
  if (e.shiftKey) return { ArrowLeft: "narrower", ArrowRight: "wider", ArrowUp: "shorter", ArrowDown: "taller" }[e.key] ?? null;
  return { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key] ?? null;
}

/** Which drop zone a pointer is over: left/right edge => place beside, top/bottom half => before/after. */
export function dropZone(fx, fy, { allowSides = true, vertical = false } = {}) {
  if (!vertical && allowSides) { if (fx < 0.25) return "left"; if (fx > 0.75) return "right"; }
  return fy < 0.5 ? "before" : "after";
}
export function applyDrop(blocks, movingId, targetId, zone) {
  if (C.isCanvas(blocks)) return blocks; // canvas drops use moveTo (runLayoutOp "moveTo")
  if (zone === "left" || zone === "right") return L.placeBeside(blocks, movingId, targetId, zone);
  if (zone === "before") return L.moveBefore(blocks, movingId, targetId);
  if (zone === "after") return L.moveAfter(blocks, movingId, targetId);
  if (zone === "end") { const last = blocks[blocks.length - 1]; return last && last.id !== movingId ? L.moveAfter(blocks, movingId, last.id) : blocks; }
  return blocks;
}

// ---- history snapshots (layout + preview height + order; content edits have their own entries) ----
export const snapshotLayouts = (blocks) => (blocks || []).map((b) => ({ id: b.id, layout: b.content?.layout ?? null, ui: b.content?.ui ?? null }));
export function applySnapshot(blocks, snap) {
  const byId = new Map((blocks || []).map((b) => [b.id, b]));
  const order = snap.map((s) => s.id).filter((id) => byId.has(id));
  const rest = (blocks || []).filter((b) => !order.includes(b.id));
  const lay = new Map(snap.map((s) => [s.id, s]));
  return [...order.map((id) => byId.get(id)), ...rest].map((b) => {
    if (!lay.has(b.id)) return b;
    const content = { ...(b.content && typeof b.content === "object" ? b.content : {}) };
    const { layout, ui } = lay.get(b.id);
    if (layout) content.layout = layout; else delete content.layout;
    if (ui) content.ui = ui; else delete content.ui;
    return { ...b, content };
  });
}
/** What is persisted about a block's arrangement (compare strings). */
export const layoutKey = (blockOrContent) => { const c = blockOrContent?.content ?? blockOrContent; return JSON.stringify([c?.layout ?? null, c?.ui ?? null]); };
/** What has to be written to the database to bring `persisted` up to date with `blocks`. */
export function diffForPersist(persisted, blocks) {
  const ids = blocks.map((b) => b.id);
  const orderChanged = ids.length !== persisted.order.length || ids.some((id, i) => id !== persisted.order[i]);
  const changed = blocks.filter((b) => layoutKey(b) !== persisted.layouts.get(b.id));
  return { orderChanged, changed, ids };
}
export function makePersisted(blocks) {
  return { order: blocks.map((b) => b.id), layouts: new Map(blocks.map((b) => [b.id, layoutKey(b)])) };
}
/** Keep the CURRENT layout when restoring an older content snapshot (content undo must not undo layout). */
export function keepLayout(content, current) {
  const next = { ...(content && typeof content === "object" ? content : {}) };
  for (const key of ["layout", "ui"]) {
    const v = current?.content?.[key];
    if (v) next[key] = v; else delete next[key];
  }
  return next;
}
/** Content without its arrangement keys (used when a deleted block is re-created by undo: it returns as a plain block). */
export function stripLayout(content) {
  const next = { ...(content && typeof content === "object" ? content : {}) };
  delete next.layout; delete next.ui;
  return next;
}
