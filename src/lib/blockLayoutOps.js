// Named layout operations used by the Learn editor's buttons, keyboard shortcuts and
// drag-and-drop, each returning { blocks, changed, message } where `message` is the text
// announced to screen readers (aria-live). Pure: no React / DOM.
import * as L from "./blockLayout.js";

const LABEL = {
  rich_text: "Text", image: "Image", video: "Video", equation: "Equation", molecule_3d: "3D molecule", simulation: "Simulation",
  key_idea: "Key idea", definition: "Definition", common_mistake: "Common mistake", real_life: "Real-life connection",
  worked_example: "Worked example", data_graph: "Data graph", compare_contrast: "Compare and contrast", reveal_think: "Reveal and think",
  practical: "Practical", page_break: "Page break", check_understanding: "Check your understanding", topic_link: "Linked topic",
};
export const blockLabel = (block) => LABEL[block?.block_type] ?? "Block";

const OPS = {
  up: { fn: (b, id) => L.moveUp(b, id), verb: "move up" },
  down: { fn: (b, id) => L.moveDown(b, id), verb: "move down" },
  left: { fn: (b, id) => L.moveLeft(b, id), verb: "move left (only possible inside a shared row)" },
  right: { fn: (b, id) => L.moveRight(b, id), verb: "move right (only possible inside a shared row)" },
  wider: { fn: (b, id, a) => L.widen(b, id, a), verb: "get wider" },
  narrower: { fn: (b, id, a) => L.narrow(b, id, a), verb: "get narrower" },
  span: { fn: (b, id, a) => L.setSpan(b, id, a?.span), verb: "change width" },
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
};

export function runLayoutOp(blocks, name, id, arg) {
  const op = OPS[name];
  const block = (blocks || []).find((b) => b.id === id);
  if (!op || !block) return { blocks, changed: false, message: "" };
  const label = blockLabel(block);
  const next = op.fn(blocks, id, arg);
  if (next === blocks) return { blocks, changed: false, message: `${label} cannot ${op.verb} any further.` };
  const verbDone = { up: "moved up", down: "moved down", left: "moved left", right: "moved right", wider: "made wider", narrower: "made narrower" }[name] ?? "updated";
  return { blocks: next, changed: true, message: `${label} ${verbDone}: ${L.describePlacement(next, id)}.` };
}

/** Key handling for a selected block. Alt+Arrow = move, Alt+Shift+Left/Right = narrower/wider. */
export function opForKey(e) {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.shiftKey) { if (e.key === "ArrowLeft") return "narrower"; if (e.key === "ArrowRight") return "wider"; return null; }
  return { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }[e.key] ?? null;
}

/** Which drop zone a pointer is over: left/right edge => place beside, top/bottom half => before/after. */
export function dropZone(fx, fy, { allowSides = true, vertical = false } = {}) {
  if (!vertical && allowSides) { if (fx < 0.25) return "left"; if (fx > 0.75) return "right"; }
  return fy < 0.5 ? "before" : "after";
}
export function applyDrop(blocks, movingId, targetId, zone) {
  if (zone === "left" || zone === "right") return L.placeBeside(blocks, movingId, targetId, zone);
  if (zone === "before") return L.moveBefore(blocks, movingId, targetId);
  if (zone === "after") return L.moveAfter(blocks, movingId, targetId);
  if (zone === "end") { const last = blocks[blocks.length - 1]; return last && last.id !== movingId ? L.moveAfter(blocks, movingId, last.id) : blocks; }
  return blocks;
}

// ---- history snapshots (layout + order only; content edits have their own entries) ----
export const snapshotLayouts = (blocks) => (blocks || []).map((b) => ({ id: b.id, layout: b.content?.layout ?? null }));
export function applySnapshot(blocks, snap) {
  const byId = new Map((blocks || []).map((b) => [b.id, b]));
  const order = snap.map((s) => s.id).filter((id) => byId.has(id));
  const rest = (blocks || []).filter((b) => !order.includes(b.id));
  const lay = new Map(snap.map((s) => [s.id, s.layout]));
  return [...order.map((id) => byId.get(id)), ...rest].map((b) => {
    if (!lay.has(b.id)) return b;
    const content = { ...(b.content && typeof b.content === "object" ? b.content : {}) };
    const l = lay.get(b.id);
    if (l) content.layout = l; else delete content.layout;
    return { ...b, content };
  });
}
/** What has to be written to the database to bring `persisted` up to date with `blocks`. */
export function diffForPersist(persisted, blocks) {
  const ids = blocks.map((b) => b.id);
  const orderChanged = ids.length !== persisted.order.length || ids.some((id, i) => id !== persisted.order[i]);
  const changed = blocks.filter((b) => JSON.stringify(b.content?.layout ?? null) !== persisted.layouts.get(b.id));
  return { orderChanged, changed, ids };
}
export function makePersisted(blocks) {
  return { order: blocks.map((b) => b.id), layouts: new Map(blocks.map((b) => [b.id, JSON.stringify(b.content?.layout ?? null)])) };
}
/** Keep the CURRENT layout when restoring an older content snapshot (content undo must not undo layout). */
export function keepLayout(content, current) {
  const next = { ...(content && typeof content === "object" ? content : {}) };
  const l = current?.content?.layout;
  if (l) next.layout = l; else delete next.layout;
  return next;
}
