#!/usr/bin/env node
// Pure tests for src/lib/blockLayout.js:  node scripts/test-block-layout.mjs
import assert from "node:assert/strict";
import * as L from "../src/lib/blockLayout.js";
import * as O from "../src/lib/blockLayoutOps.js";

let n = 0;
const t = (name, fn) => { fn(); n += 1; console.log("  ok  ", name); };
const mk = (id, type = "rich_text", content = {}) => ({ id, block_type: type, content: { html: `<p>${id}</p>`, ...content }, position: 0, visible: true });
const ids = (bs) => bs.map((b) => b.id);
const lay = (bs, id) => L.getLayout(bs.find((b) => b.id === id));
const base = () => [mk("a"), mk("b", "image"), mk("c"), mk("d", "key_idea"), mk("e", "simulation", { simulationId: "x" })];
const strip = (b) => { const c = { ...b.content }; delete c.layout; return { ...b, content: c }; };

console.log("blockLayout");

t("legacy blocks: one flow segment, rows are solo full width, nothing normalised", () => {
  const bs = base();
  assert.equal(L.hasAnyLayout(bs), false);
  const seg = L.segmentBlocks(bs);
  assert.equal(seg.length, 1); assert.equal(seg[0].kind, "flow"); assert.deepEqual(ids(seg[0].blocks), ids(bs));
  assert.equal(L.normalizeBlocks(bs), bs);
  assert.deepEqual(ids(L.collapsedOrder(bs, 300)), ids(bs));
  assert.equal(L.validateLayout(bs).valid, true);
  assert.deepEqual(L.buildRows(bs).map((r) => [r.cells.length, r.total, r.offset]), bs.map(() => [1, 12, 0]));
});

t("malformed / hostile layout data never throws and is ignored or clamped", () => {
  const junk = [null, undefined, 5, "x", [], [1], true, {}, { span: "abc" }, { span: -4 }, { span: 99 }, { span: 7.6 }, { span: NaN }, { row: 12 }, { row: "" }, { row: "x".repeat(500) }, { align: "diagonal", position: 3, mobile: {} }, { v: 99, extra: { deep: [1] } }, { span: 5, row: "r1" }];
  for (const j of junk) {
    const bs = [mk("a", "rich_text", { layout: j }), mk("b", "image", { layout: j }), mk("c", "page_break", { layout: j })];
    assert.doesNotThrow(() => { L.buildRows(bs); L.segmentBlocks(bs); L.collapsedOrder(bs, 100); L.normalizeBlocks(bs); L.validateLayout(bs); L.setSpan(bs, "a", 6); L.placeBeside(bs, "a", "b", "left"); });
    for (const b of bs) { const l = L.getLayout(b); if (l) { assert.ok(Number.isInteger(l.span) && l.span >= 1 && l.span <= 12); } }
    assert.equal(L.getLayout(bs[2]), null, "page_break never has a layout");
  }
  assert.equal(L.getLayout(mk("a", "rich_text", { layout: { span: 99 } })), null, "span 99 clamps to 12 => default => no layout");
  assert.equal(L.getLayout(mk("a", "rich_text", { layout: { span: 7.6 } })).span, 8);
  // a non-array blocks argument
  assert.doesNotThrow(() => { L.buildRows(null); L.segmentBlocks(undefined); L.hasAnyLayout(null); });
  // block with content null / string
  assert.doesNotThrow(() => L.buildRows([{ id: "z", block_type: "rich_text", content: null }, { id: "y", block_type: "rich_text", content: "str" }]));
});

t("placeBeside builds an image 5 / text 7 row and keeps order + content", () => {
  const bs = base();
  const r = L.placeBeside(bs, "b", "c", "left");
  assert.deepEqual(ids(r).sort(), ids(bs).sort());
  assert.equal(r.length, bs.length);
  const rows = L.buildRows(r);
  const row = rows.find((x) => x.cells.length === 2);
  assert.deepEqual(row.cells.map((c) => c.block.id), ["b", "c"]);
  assert.deepEqual(row.cells.map((c) => c.span), [5, 7]);
  assert.equal(L.getWrap(r, "b"), "beside"); assert.equal(L.getWrap(r, "a"), "stack");
  assert.deepEqual(r.map(strip), r.map((b) => strip(bs.find((o) => o.id === b.id))));
  assert.equal(L.validateLayout(r).valid, true);
  // right side
  const r2 = L.placeBeside(bs, "a", "b", "right");
  assert.deepEqual(L.buildRows(r2).find((x) => x.cells.length === 2).cells.map((c) => c.block.id), ["b", "a"]);
});

t("segments: plain blocks around a row stay in flow segments", () => {
  const r = L.placeBeside(base(), "b", "c", "left");
  const seg = L.segmentBlocks(r);
  assert.deepEqual(seg.map((s) => s.kind), ["flow", "row", "flow"]);
  assert.deepEqual(ids(seg[0].blocks), ["a"]); assert.deepEqual(ids(seg[2].blocks), ["d", "e"]);
});

t("setSpan inside a row: neighbour fills, clamps to minimums", () => {
  let r = L.placeBeside(base(), "b", "c", "left");
  r = L.setSpan(r, "b", 4);
  assert.deepEqual(L.buildRows(r).find((x) => x.cells.length === 2).cells.map((c) => c.span), [4, 8]);
  r = L.setSpan(r, "b", 12);
  const row = L.buildRows(r).find((x) => x.cells.length === 2);
  assert.equal(row.total, 12); assert.ok(row.cells.every((c) => c.span >= 3));
  assert.equal(L.setSpan(r, "nope", 4), r);
  const solo = L.setSpan(base(), "a", 6);
  assert.equal(lay(solo, "a").span, 6);
  assert.equal(L.setSpan(solo, "a", 12).find((b) => b.id === "a").content.layout, undefined, "back to 12 => layout removed (legacy)");
});

t("widen / narrow step through presets, or by 1 column when snapping is off", () => {
  let r = L.setSpan(base(), "a", 6);
  r = L.widen(r, "a"); assert.equal(lay(r, "a").span, 7);
  r = L.narrow(r, "a"); r = L.narrow(r, "a"); assert.equal(lay(r, "a").span, 5);
  r = L.widen(r, "a", { snap: false }); assert.equal(lay(r, "a").span, 6);
  const full = base(); assert.equal(L.widen(full, "a"), full, "already full: same reference (no-op)");
  let m = L.narrow(base(), "a"); m = L.narrow(m, "a"); m = L.narrow(m, "a"); m = L.narrow(m, "a"); m = L.narrow(m, "a"); m = L.narrow(m, "a");
  assert.equal(lay(m, "a").span, 3, "cannot go below the minimum preset");
  assert.equal(lay(L.setSpan(base(), "e", 2), "e").span, 6, "simulation minimum is 6");
});

t("row limits: at most 4 cells, full-only blocks never join a row", () => {
  let r = base().concat([mk("f"), mk("g")]);
  r = L.placeBeside(r, "b", "a", "right");
  r = L.placeBeside(r, "c", "a", "right");
  r = L.placeBeside(r, "d", "a", "right");
  const four = L.buildRows(r).find((x) => x.cells.length >= 3);
  assert.ok(four.cells.length <= 4 && four.total <= 12);
  const before = r;
  r = L.placeBeside(r, "f", "a", "right"); r = L.placeBeside(r, "g", "a", "right");
  assert.ok(L.buildRows(r).every((x) => x.cells.length <= 4 && x.total <= 12));
  const withBreak = [mk("a"), mk("pb", "page_break"), mk("cq", "check_understanding"), mk("w", "worked_example")];
  assert.equal(L.placeBeside(withBreak, "a", "pb", "left"), withBreak);
  assert.equal(L.placeBeside(withBreak, "cq", "a", "left"), withBreak);
  assert.equal(L.placeBeside(withBreak, "a", "w", "left"), withBreak);
  assert.equal(L.setSpan(withBreak, "w", 6), withBreak);
  assert.ok(before);
});

t("moveUp / moveDown / moveLeft / moveRight / ungroup / moveBefore / moveAfter", () => {
  let r = L.placeBeside(base(), "b", "c", "left"); // a | [b c] | d | e
  assert.deepEqual(ids(r), ["a", "b", "c", "d", "e"]);
  assert.equal(L.moveUp(base(), "a").length, 5);
  const first = base(); assert.equal(L.moveUp(first, "a"), first, "first block can't move up");
  const last = base(); assert.equal(L.moveDown(last, "e"), last);
  assert.deepEqual(ids(L.moveDown(base(), "a")), ["b", "a", "c", "d", "e"]);
  assert.deepEqual(ids(L.moveUp(base(), "c")), ["a", "c", "b", "d", "e"]);
  // swapping rows keeps a shared row together
  const down = L.moveDown(r, "a"); assert.deepEqual(ids(down), ["b", "c", "a", "d", "e"]); assert.equal(L.getWrap(down, "b"), "beside");
  // moving a member out of its row
  const out = L.moveDown(r, "b"); assert.equal(L.getWrap(out, "b"), "stack"); assert.equal(L.getWrap(out, "c"), "stack"); assert.deepEqual(ids(out), ["a", "c", "b", "d", "e"]);
  const out2 = L.moveUp(r, "c"); assert.deepEqual(ids(out2), ["a", "c", "b", "d", "e"]);
  // left/right swap inside the row
  const sw = L.moveRight(r, "b"); assert.deepEqual(ids(sw), ["a", "c", "b", "d", "e"]); assert.equal(L.getWrap(sw, "b"), "beside");
  assert.equal(L.moveLeft(r, "b"), r, "leftmost cell cannot move left");
  assert.equal(L.moveRight(base(), "a").length, 5);
  const solo = base(); assert.equal(L.moveLeft(solo, "a"), solo); assert.equal(L.moveRight(solo, "a"), solo);
  // ungroup
  const ug = L.ungroup(r, "c"); assert.equal(L.getWrap(ug, "c"), "stack"); assert.equal(L.getWrap(ug, "b"), "stack"); assert.deepEqual(ids(ug), ids(r));
  assert.equal(lay(ug, "b"), null);
  // before / after
  assert.deepEqual(ids(L.moveBefore(base(), "e", "a")), ["e", "a", "b", "c", "d"]);
  assert.deepEqual(ids(L.moveAfter(base(), "a", "d")), ["b", "c", "d", "a", "e"]);
  assert.deepEqual(ids(L.moveAfter(r, "e", "b")), ["a", "b", "c", "e", "d"], "after a row, not inside it");
  assert.equal(L.moveBefore(base(), "a", "a").length, 5);
});

t("placeBesideNeighbour + setWrap (keyboard 'place beside')", () => {
  const bs = base();
  const r = L.placeBesideNeighbour(bs, "b", -1); // beside previous (a), on its right
  assert.deepEqual(L.buildRows(r).find((x) => x.cells.length === 2).cells.map((c) => c.block.id), ["a", "b"]);
  const r2 = L.placeBesideNeighbour(bs, "b", 1);
  assert.deepEqual(L.buildRows(r2).find((x) => x.cells.length === 2).cells.map((c) => c.block.id), ["b", "c"]);
  assert.equal(L.placeBesideNeighbour(bs, "a", -1), bs);
  assert.equal(L.getWrap(L.setWrap(bs, "e", "beside"), "e"), "beside", "last block falls back to previous neighbour");
  assert.equal(L.getWrap(L.setWrap(L.setWrap(bs, "b", "beside"), "b", "stack"), "b"), "stack");
  const pb = [mk("a"), mk("pb", "page_break")]; assert.equal(L.setWrap(pb, "a", "beside"), pb);
});

t("align / position / mobile order", () => {
  let r = L.placeBeside(base(), "b", "c", "left");
  r = L.setAlign(r, "b", "center"); assert.equal(lay(r, "b").align, "center");
  assert.equal(L.setAlign(r, "b", "bogus"), r);
  r = L.setMobile(r, "c", "first");
  assert.deepEqual(ids(L.collapsedOrder(r, 390)), ["a", "c", "b", "d", "e"]);
  assert.deepEqual(ids(L.collapsedOrder(r, 1000)), ["a", "b", "c", "d", "e"], "wide: mobile order ignored");
  assert.deepEqual(ids(L.collapsedOrder(r, L.COLLAPSE_WIDTH - 1)), ["a", "c", "b", "d", "e"]);
  assert.deepEqual(ids(L.collapsedOrder(r, L.COLLAPSE_WIDTH)), ["a", "b", "c", "d", "e"]);
  let p = L.setSpan(base(), "a", 6); p = L.setPosition(p, "a", "center");
  let row = L.buildRows(p)[0]; assert.equal(row.offset, 3); assert.equal(row.cells[0].start, 4);
  p = L.setPosition(p, "a", "right"); row = L.buildRows(p)[0]; assert.equal(row.cells[0].start, 7);
  p = L.setPosition(p, "a", "left"); row = L.buildRows(p)[0]; assert.equal(row.cells[0].start, null);
  const shared = L.setPosition(L.placeBeside(base(), "b", "c", "left"), "c", "right");
  assert.deepEqual(L.buildRows(shared).find((x) => x.cells.length === 2).cells.map((c) => c.start), [null, null], "full row has no offset");
});

t("insertAfter + presets + toLinear", () => {
  const r = L.placeBeside(base(), "b", "c", "left");
  const dup = { ...mk("b2", "image"), content: { ...mk("b2", "image").content, layout: { span: 5, row: "r-b" } } };
  const ins = L.insertAfter(r, dup, "c");
  assert.deepEqual(ids(ins), ["a", "b", "c", "b2", "d", "e"]); assert.equal(L.getWrap(ins, "b2"), "stack");
  assert.equal(L.insertAfter(base(), mk("n"), null).at(-1).id, "n");
  const p = L.applyPresetRow([mk("x", "image"), mk("y"), mk("z")], ["x", "y"], [5, 7]);
  assert.deepEqual(L.buildRows(p)[0].cells.map((c) => c.span), [5, 7]);
  const three = L.applyPresetRow([mk("x"), mk("y"), mk("z")], ["x", "y", "z"], [4, 4, 4]);
  assert.equal(L.buildRows(three).length, 1);
  assert.equal(L.applyPresetRow([mk("x")], ["x"], [12]).length, 1);
  const lin = L.toLinear(p); assert.equal(L.hasAnyLayout(lin), false); assert.deepEqual(lin.map((b) => b.content), base().slice(0, 0).concat(p.map((b) => strip(b).content)));
});

t("overflowing malformed row (sum > 12) is repaired, never overlaps", () => {
  const bs = [mk("a", "rich_text", { layout: { span: 9, row: "q" } }), mk("b", "rich_text", { layout: { span: 9, row: "q" } }), mk("c", "rich_text", { layout: { span: 9, row: "q" } })];
  assert.equal(L.validateLayout(bs).valid, false);
  const fixed = L.normalizeBlocks(bs);
  assert.equal(L.validateLayout(fixed).valid, true, JSON.stringify(L.validateLayout(fixed)));
  assert.ok(L.buildRows(bs).every((r) => r.total <= 12));
  // four simulations (min 6 each) cannot share a row: spill into extra rows, order kept
  const sims = ["a", "b", "c", "d"].map((i) => mk(i, "simulation", { layout: { span: 3, row: "s" } }));
  const f2 = L.normalizeBlocks(sims);
  assert.deepEqual(ids(f2), ["a", "b", "c", "d"]); assert.equal(L.validateLayout(f2).valid, true); assert.ok(L.buildRows(f2).every((r) => r.total <= 12));
  // non-adjacent members of the same row id are NOT merged
  const split = [mk("a", "rich_text", { layout: { span: 6, row: "q" } }), mk("m"), mk("b", "rich_text", { layout: { span: 6, row: "q" } })];
  assert.equal(L.validateLayout(split).valid, false);
  assert.equal(L.buildRows(split).length, 3);
  assert.equal(L.validateLayout(L.normalizeBlocks(split)).valid, true);
});

t("hidden/filtered members: a row with one visible member renders as that member", () => {
  const r = L.placeBeside(base(), "b", "c", "left");
  const visible = r.filter((b) => b.id !== "c");
  const rows = L.buildRows(visible);
  assert.equal(rows.length, 4); assert.ok(rows.every((x) => x.cells.length === 1));
});

t("normalizeBlocks is idempotent and JSON round-trips", () => {
  let r = L.placeBeside(base(), "b", "c", "left"); r = L.setSpan(r, "e", 8); r = L.setPosition(r, "e", "right");
  const once = L.normalizeBlocks(r);
  assert.equal(JSON.stringify(L.normalizeBlocks(once)), JSON.stringify(once));
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(r))), JSON.stringify(r));
  assert.equal(L.normalizeBlocks(once), once);
});

t("operations never mutate their input", () => {
  const bs = L.placeBeside(base(), "b", "c", "left");
  const snap = JSON.stringify(bs);
  for (const f of [(x) => L.setSpan(x, "b", 3), (x) => L.moveDown(x, "a"), (x) => L.moveUp(x, "c"), (x) => L.ungroup(x, "b"), (x) => L.placeBeside(x, "e", "b", "left"), (x) => L.toLinear(x), (x) => L.setMobile(x, "b", "last"), (x) => L.normalizeBlocks(x)]) f(bs);
  assert.equal(JSON.stringify(bs), snap);
});

t("removeBlock: neighbour absorbs columns; legacy lists just filter", () => {
  const r = L.placeBeside(base(), "b", "c", "left");
  const rm = L.removeBlock(r, "b");
  assert.deepEqual(ids(rm), ["a", "c", "d", "e"]); assert.equal(lay(rm, "c"), null, "lone survivor is full width again");
  assert.equal(L.validateLayout(rm).valid, true);
  assert.deepEqual(ids(L.removeBlock(base(), "a")), ["b", "c", "d", "e"]);
  assert.equal(L.removeBlock(base(), "zzz").length, 5);
  let three = L.applyPresetRow([mk("x"), mk("y"), mk("z")], ["x", "y", "z"], [4, 4, 4]);
  three = L.removeBlock(three, "y"); assert.equal(L.buildRows(three)[0].total, 12);
});

t("ops: messages, no-ops, keyboard mapping, drop zones, snapshots and persistence diff", () => {
  const bs = base();
  const up = O.runLayoutOp(bs, "up", "c"); assert.equal(up.changed, true); assert.match(up.message, /^Text moved up: row 2 of 5/);
  const top = O.runLayoutOp(bs, "up", "a"); assert.equal(top.changed, false); assert.match(top.message, /cannot move up/); assert.equal(top.blocks, bs);
  const w = O.runLayoutOp(L.setSpan(bs, "a", 6), "wider", "a"); assert.match(w.message, /made wider.*7 of 12 columns/);
  assert.equal(O.runLayoutOp(bs, "bogus", "a").changed, false); assert.equal(O.runLayoutOp(bs, "up", "nope").changed, false);
  assert.equal(O.opForKey({ altKey: true, key: "ArrowUp" }), "up");
  assert.equal(O.opForKey({ altKey: true, shiftKey: true, key: "ArrowRight" }), "wider");
  assert.equal(O.opForKey({ altKey: true, shiftKey: true, key: "ArrowUp" }), null);
  assert.equal(O.opForKey({ altKey: false, key: "ArrowUp" }), null); assert.equal(O.opForKey({ altKey: true, ctrlKey: true, key: "ArrowUp" }), null);
  assert.equal(O.dropZone(0.1, 0.5), "left"); assert.equal(O.dropZone(0.9, 0.5), "right"); assert.equal(O.dropZone(0.5, 0.2), "before"); assert.equal(O.dropZone(0.5, 0.8), "after");
  assert.equal(O.dropZone(0.1, 0.8, { allowSides: false }), "after"); assert.equal(O.dropZone(0.1, 0.1, { vertical: true }), "before");
  assert.deepEqual(ids(O.applyDrop(bs, "a", "d", "after")), ["b", "c", "d", "a", "e"]);
  assert.deepEqual(ids(O.applyDrop(bs, "a", "e", "end")), ["b", "c", "d", "e", "a"]);
  assert.equal(L.getWrap(O.applyDrop(bs, "b", "c", "left"), "b"), "beside");
  // snapshots: undo restores order + layouts, keeps content edits made since
  const moved = O.runLayoutOp(L.placeBeside(bs, "b", "c", "left"), "down", "a").blocks;
  const before = O.snapshotLayouts(bs), after = O.snapshotLayouts(moved);
  const edited = moved.map((b) => (b.id === "c" ? { ...b, content: { ...b.content, html: "<p>EDITED</p>" } } : b));
  const undone = O.applySnapshot(edited, before);
  assert.deepEqual(ids(undone), ids(bs)); assert.equal(L.hasAnyLayout(undone), false); assert.equal(undone.find((b) => b.id === "c").content.html, "<p>EDITED</p>");
  assert.deepEqual(ids(O.applySnapshot(undone, after)), ids(moved));
  assert.deepEqual(ids(O.applySnapshot(bs.slice(0, 3), before)), ["a", "b", "c"], "deleted blocks are skipped");
  const persisted = O.makePersisted(bs);
  assert.deepEqual(O.diffForPersist(persisted, bs), { orderChanged: false, changed: [], ids: ids(bs) });
  const d = O.diffForPersist(persisted, moved); assert.equal(d.orderChanged, true); assert.ok(d.changed.length >= 2);
  const kept = O.keepLayout({ html: "old", layout: { span: 3 } }, moved.find((b) => b.id === "b")); assert.equal(kept.html, "old"); assert.equal(kept.layout.span, 5);
  assert.equal("layout" in O.keepLayout({ html: "x", layout: { span: 3 } }, bs[0]), false);
});

// ---- randomised invariants --------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
t("randomised: 400 sequences x 80 operations keep ids, count, content and validity", () => {
  const TYPES = ["rich_text", "image", "key_idea", "video", "simulation", "definition", "page_break", "check_understanding", "worked_example", "real_life", "equation"];
  let ops = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const rand = rng(seed);
    const count = 2 + Math.floor(rand() * 11);
    let blocks = Array.from({ length: count }, (_, i) => mk(`b${i}`, TYPES[Math.floor(rand() * TYPES.length)], { keep: `k${i}` }));
    const origin = new Map(blocks.map((b) => [b.id, JSON.stringify(strip(b))]));
    // sometimes start from hostile stored data
    if (seed % 5 === 0) blocks = blocks.map((b) => (rand() < 0.5 ? { ...b, content: { ...b.content, layout: { span: Math.floor(rand() * 20) - 3, row: rand() < 0.5 ? "same" : `r${Math.floor(rand() * 3)}`, align: rand() < 0.3 ? "x" : "center", mobile: rand() < 0.3 ? "first" : "zzz" } } } : b));
    blocks = L.normalizeBlocks(blocks);
    assert.equal(L.validateLayout(blocks).valid, true, `seed ${seed} normalised start: ${JSON.stringify(L.validateLayout(blocks))}`);
    const pick = () => blocks[Math.floor(rand() * blocks.length)].id;
    for (let k = 0; k < 80; k += 1) {
      const id = pick(); const other = pick(); const r = rand();
      let next;
      if (r < 0.10) next = L.placeBeside(blocks, id, other, rand() < 0.5 ? "left" : "right");
      else if (r < 0.20) next = L.setSpan(blocks, id, 1 + Math.floor(rand() * 12));
      else if (r < 0.28) next = L.widen(blocks, id, { snap: rand() < 0.5 });
      else if (r < 0.36) next = L.narrow(blocks, id, { snap: rand() < 0.5 });
      else if (r < 0.43) next = L.moveUp(blocks, id);
      else if (r < 0.50) next = L.moveDown(blocks, id);
      else if (r < 0.56) next = L.moveLeft(blocks, id);
      else if (r < 0.62) next = L.moveRight(blocks, id);
      else if (r < 0.68) next = L.moveBefore(blocks, id, other);
      else if (r < 0.74) next = L.moveAfter(blocks, id, other);
      else if (r < 0.78) next = L.ungroup(blocks, id);
      else if (r < 0.83) next = L.placeBesideNeighbour(blocks, id, rand() < 0.5 ? -1 : 1);
      else if (r < 0.87) next = L.setWrap(blocks, id, rand() < 0.5 ? "beside" : "stack");
      else if (r < 0.90) next = L.setAlign(blocks, id, ["start", "center", "end"][Math.floor(rand() * 3)]);
      else if (r < 0.93) next = L.setPosition(blocks, id, ["left", "center", "right"][Math.floor(rand() * 3)]);
      else if (r < 0.96) next = L.setMobile(blocks, id, ["default", "first", "last"][Math.floor(rand() * 3)]);
      else if (r < 0.98) next = L.applyPresetRow(blocks, [id, other], [5, 7]);
      else next = L.normalizeBlocks(blocks);
      blocks = next; ops += 1;
      assert.equal(blocks.length, count, `seed ${seed} op ${k}: count`);
      assert.deepEqual(ids(blocks).slice().sort(), Array.from({ length: count }, (_, i) => `b${i}`).sort(), `seed ${seed} op ${k}: ids`);
      const v = L.validateLayout(blocks);
      assert.equal(v.valid, true, `seed ${seed} op ${k}: ${JSON.stringify(v.errors)}`);
      for (const b of blocks) assert.equal(JSON.stringify(strip(b)), origin.get(b.id), `seed ${seed} op ${k}: content of ${b.id} changed`);
      const rows = L.buildRows(blocks);
      assert.ok(rows.every((x) => x.total <= 12 && x.cells.length <= 4 && x.offset >= 0 && x.offset + x.total <= 12), `seed ${seed} op ${k}: rows`);
      assert.equal(rows.reduce((s, x) => s + x.cells.length, 0), count);
      assert.deepEqual(ids(L.collapsedOrder(blocks, 100)).slice().sort(), ids(blocks).slice().sort());
      // full-only blocks are always alone
      for (const x of rows) if (x.cells.some((c) => L.isFullOnly(c.block.block_type))) assert.equal(x.cells.length, 1);
    }
    // finally: toLinear restores a legacy-looking lesson with the original order of the final arrangement
    const lin = L.toLinear(blocks);
    assert.equal(L.hasAnyLayout(lin), false);
    assert.deepEqual(ids(lin), ids(blocks));
  }
  console.log(`        (${ops} random operations)`);
});

console.log(`\n${n} blockLayout tests passed`);
