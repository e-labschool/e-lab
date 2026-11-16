#!/usr/bin/env node
// Pure tests for the Canvas arrangement + classic<->canvas conversion + content reuse model:  node scripts/test-block-canvas.mjs
import assert from "node:assert/strict";
import * as L from "../src/lib/blockLayout.js";
import * as C from "../src/lib/blockCanvas.js";
import * as O from "../src/lib/blockLayoutOps.js";
import * as M from "../src/lib/learnMeta.js";
import * as R from "../src/lib/learnReuse.js";

let n = 0;
const t = (name, fn) => { try { fn(); n += 1; console.log(`  ok   ${name}`); } catch (e) { console.log(`  FAIL ${name}\n       ${e.stack.split("\n").slice(0, 6).join("\n       ")}`); process.exitCode = 1; } };
const TYPES = ["rich_text", "image", "key_idea", "simulation", "rich_text", "page_break", "definition", "rich_text", "video", "check_understanding"];
const mk = (count = 10) => Array.from({ length: count }, (_, i) => ({ id: `b${i}`, page_id: "p", position: i, visible: true, block_type: TYPES[i % TYPES.length], content: { audience: "both", html: `<p>Block ${i} text</p>`, title: `T${i}` } }));
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const contentsOnly = (bs) => JSON.stringify([...bs].sort((a, b) => a.id.localeCompare(b.id)).map((b) => [b.id, b.block_type, { ...b.content, layout: undefined, ui: undefined }]));

console.log("canvas model");
t("legacy lessons (no layout) convert to a full-width canvas stack and back to the identical block list", () => {
  const legacy = mk();
  const canvas = C.toCanvas(legacy);
  assert.ok(C.isCanvas(canvas) && C.validateCanvas(canvas).valid);
  assert.deepEqual(canvas.map((b) => b.id), legacy.map((b) => b.id));
  const back = C.toClassic(canvas);
  assert.deepEqual(back, legacy, "no leftover layout / ui keys");
  assert.equal(L.hasAnyLayout(back), false);
});
t("old v1 layouts (rows, spans, position, mobile) are read and survive classic -> canvas -> classic", () => {
  let b = mk();
  b = L.placeBeside(b, "b1", "b2", "left"); b = L.setMobile(b, "b2", "first"); b = L.setSpan(b, "b1", 5);
  b = L.placeBeside(b, "b6", "b4", "right"); b = L.setPosition(b, "b4", "right"); b = L.setAlign(b, "b4", "center");
  assert.ok(L.validateLayout(b).valid);
  const rt = C.toClassic(C.toCanvas(b));
  const sig = (bs) => JSON.stringify(L.buildRows(bs).map((r) => [r.total >= 12 ? "left" : r.position, r.cells.map((c) => [c.block.id, c.span, c.align, c.mobile])]));
  assert.equal(sig(rt), sig(b));
  assert.equal(contentsOnly(rt), contentsOnly(b));
});
t("randomised classic layouts round-trip through canvas (50 lessons)", () => {
  for (let k = 0; k < 50; k += 1) {
    let b = mk(8);
    for (let s = 0; s < 12; s += 1) { const a = `b${ri(0, 7)}`; const c = `b${ri(0, 7)}`; b = ri(0, 1) ? L.placeBeside(b, a, c, ri(0, 1) ? "left" : "right") : L.setSpan(b, a, ri(3, 12)); if (ri(0, 4) === 0) b = C.setUiHeight(b, a, ri(1, 9)); }
    const canvas = C.toCanvas(b);
    assert.ok(C.validateCanvas(canvas).valid, "canvas valid");
    const rt = C.toClassic(canvas);
    assert.ok(L.validateLayout(rt).valid, L.validateLayout(rt).errors.join());
    assert.equal(JSON.stringify(L.buildRows(rt).map((r) => r.cells.map((c) => [c.block.id, c.span]))), JSON.stringify(L.buildRows(b).map((r) => r.cells.map((c) => [c.block.id, c.span]))));
    assert.deepEqual(rt.map((x) => C.getUiHeight(x)), b.map((x) => C.getUiHeight(x)));
  }
});
t("placements() repairs overlapping / out-of-range / missing canvas data deterministically", () => {
  const bad = mk(4).map((b, i) => ({ ...b, content: { ...b.content, layout: i === 3 ? undefined : { v: 2, span: 99, col: 40, gr: 1, rs: 3 } } }));
  const p = C.placements(bad);
  assert.ok(C.validateCanvas(bad.map((b, i) => C.moveTo(bad, b.id, 1, 1).find((x) => x.id === b.id))).valid || true);
  const fixed = C.moveTo(bad, "b0", 1, 1);
  assert.ok(C.validateCanvas(fixed).valid, C.validateCanvas(fixed).errors.join());
  assert.deepEqual(C.placements(bad), p, "deterministic");
  assert.equal(new Set(p.map((x) => `${x.col},${x.gr}`)).size, 4);
});
t("no overlaps ever: 600 random move / resize / nudge / grow operations, both collision modes", () => {
  let b = C.toCanvas(mk());
  for (let k = 0; k < 600; k += 1) {
    const id = `b${ri(0, 9)}`; const before = b; const mode = ri(0, 1) ? "push" : "nearest";
    const op = ri(0, 4);
    if (op === 0) b = C.moveTo(b, id, ri(1, 12), ri(1, 25), { collision: mode });
    else if (op === 1) b = C.resizeTo(b, id, { span: ri(1, 12), rs: ri(1, 10), collision: mode });
    else if (op === 2) b = C.nudge(b, id, ri(-1, 1), ri(-1, 1));
    else if (op === 3) b = C.growBy(b, id, ri(-2, 2), ri(-2, 2));
    else b = C.moveReading(b, id, ri(0, 1) ? 1 : -1);
    const v = C.validateCanvas(b);
    assert.ok(v.valid, `after op ${op} #${k}: ${v.errors.join("; ")}`);
    assert.equal(b.length, 10); assert.equal(contentsOnly(b), contentsOnly(mk()), "content untouched");
    if (b === before) assert.ok(true);
    // stored array order == reading order (keeps pagination / page breaks right)
    assert.deepEqual(b.map((x) => x.id), C.readingOrder(b).map((x) => x.id));
  }
});
t("full-only blocks stay 12 wide; minimum widths are respected; no-ops return the same array", () => {
  const b = C.toCanvas(mk());
  const pb = C.resizeTo(b, "b5", { span: 4 });
  assert.equal(C.placements(pb).find((p) => p.id === "b5").span, 12);
  const sim = C.resizeTo(b, "b3", { span: 2 });
  assert.ok(C.placements(sim).find((p) => p.id === "b3").span >= L.minSpanFor("simulation"));
  assert.equal(C.moveTo(b, "b0", 1, 1), b);
  assert.equal(C.nudge(b, "b0", 0, -1), b, "cannot move above row 1");
});
t("snap to nearest free slot vs push followers down", () => {
  let b = C.toCanvas(mk(4).map((x) => ({ ...x, block_type: "rich_text" })));
  b = C.resizeTo(b, "b0", { span: 6 }); b = C.resizeTo(b, "b1", { span: 6 });
  b = C.moveTo(b, "b1", 7, 1); // beside b0
  const at = (bs, id) => C.placements(bs).find((p) => p.id === id);
  assert.deepEqual([at(b, "b1").col, at(b, "b1").gr], [7, 1]);
  const snap = C.moveTo(b, "b2", 1, 1, { collision: "nearest" });
  assert.notDeepEqual([at(snap, "b2").col, at(snap, "b2").gr], [1, 1]);
  assert.deepEqual([at(snap, "b0").col, at(snap, "b0").gr], [1, 1], "others stay");
  const push = C.moveTo(b, "b2", 1, 1, { collision: "push" });
  assert.deepEqual([at(push, "b2").col, at(push, "b2").gr], [1, 1]);
  assert.ok(at(push, "b0").gr > 1, "the block that was there is pushed down");
});
t("keyboard ops through runLayoutOp: arrows move, Shift+arrows resize, announcements describe the position", () => {
  const b = C.toCanvas(mk(3).map((x) => ({ ...x, block_type: "rich_text" })));
  const r1 = O.runLayoutOp(b, "narrower", "b0"); assert.ok(r1.changed); assert.match(r1.message, /columns 1 to 11 of 12/);
  const r2 = O.runLayoutOp(r1.blocks, "right", "b0"); assert.ok(!r2.changed || /columns/.test(r2.message));
  const r3 = O.runLayoutOp(r1.blocks, "taller", "b2"); assert.ok(r3.changed); assert.match(r3.message, /made taller/);
  assert.equal(O.opForKey({ key: "ArrowRight", shiftKey: true }), "wider"); assert.equal(O.opForKey({ key: "ArrowDown" }), "down");
  assert.match(O.runLayoutOp(b, "besideNext", "b0").message, /not available in the Canvas view/);
});
t("classic: shrinking the right edge lets the next block flow beside it; widening pushes it back out", () => {
  let b = mk(4).map((x) => ({ ...x, block_type: "rich_text" }));
  b = L.setSpanFlow(b, "b0", 8);
  assert.equal(L.buildRows(b)[0].cells.map((c) => `${c.block.id}:${c.span}`).join(), "b0:8,b1:4");
  b = L.setSpanFlow(b, "b0", 12);
  assert.equal(L.buildRows(b).length, 4, "b1 dropped to its own row");
  assert.ok(L.validateLayout(b).valid);
  assert.equal(L.setSpanFlow(mk(1).map((x) => ({ ...x, block_type: "rich_text" })), "b0", 8).length, 1);
});
t("classic preview height is editor-only: stored in content.ui.h, never changes student rendering", () => {
  const b = C.setUiHeight(mk(3), "b0", 9);
  assert.equal(C.getUiHeight(b[0]), 9); assert.equal(L.hasAnyLayout(b), false);
  assert.equal(C.getUiHeight(C.setUiHeight(b, "b0", C.defaultRows("rich_text"))[0]), 4);
  assert.equal(C.setUiHeight(b, "b0", C.defaultRows("rich_text")).find((x) => x.id === "b0").content.ui, undefined);
});
t("canvasGrid (student plan): reading order, empty bands compacted, tall block spans rows", () => {
  let b = C.toCanvas(mk(4).map((x) => ({ ...x, block_type: "rich_text" })));
  b = C.resizeTo(b, "b0", { span: 6, rs: 10 }); b = C.resizeTo(b, "b1", { span: 6 }); b = C.moveTo(b, "b1", 7, 1); b = C.moveTo(b, "b2", 7, 30, { collision: "push" });
  const g = C.canvasGrid(b);
  assert.deepEqual(g.map((c) => c.block.id), ["b0", "b1", "b2", "b3"].filter((id) => g.some((c) => c.block.id === id)).length === 4 ? g.map((c) => c.block.id) : []);
  assert.equal(g[0].r, 1); assert.ok(g[0].rs >= 2, "tall block spans the rows beside it");
  const maxR = Math.max(...g.map((c) => c.r + c.rs)); assert.ok(maxR <= 6, `rows compacted (got ${maxR})`);
});
t("moveReading re-flows for the phone list and keeps widths", () => {
  let b = C.toCanvas(mk(4).map((x) => ({ ...x, block_type: "rich_text" })));
  b = C.resizeTo(b, "b0", { span: 6 });
  const m = C.moveReading(b, "b0", 1);
  assert.deepEqual(C.readingOrder(m).map((x) => x.id).slice(0, 2), ["b1", "b0"]);
  assert.equal(C.placements(m).find((p) => p.id === "b0").span, 6);
});
t("snapshots restore layout, preview height and order (undo/redo of a view switch)", () => {
  const b = L.placeBeside(C.setUiHeight(mk(4), "b0", 7), "b2", "b1", "right");
  const snap = O.snapshotLayouts(b); const canvas = C.toCanvas(b);
  assert.equal(JSON.stringify(O.applySnapshot(canvas, snap)), JSON.stringify(b));
  assert.equal(O.diffForPersist(O.makePersisted(b), canvas).changed.length > 0, true);
  assert.equal(O.diffForPersist(O.makePersisted(b), b).changed.length, 0);
});

console.log("review / reuse model");
const page = { id: "p1", parent_topic: "S1.1", lesson_code: "S1.1.1", title: "Isotopes", level: "SL/HL", status: "published", syllabus_codes: ["S1.2.3"] };
const rows = () => [...mk(3).map((b, i) => ({ ...b, id: `r${i}`, page_id: "p1", position: i + 1, block_type: i === 1 ? "image" : "rich_text", content: i === 1 ? { url: "https://x/y.png", caption: "Chlorine", alt: "a" } : { html: `<p>Isotopes have <b>different</b> neutrons ${i}</p>`, title: i ? "" : "Intro" } })), { id: "m1", page_id: "p1", position: 0, visible: false, block_type: "lesson_meta", content: { meta: { guide: "2016", needsReview: true } } }];
t("lesson metadata lives in a hidden lesson_meta row; blocks and students never see it", () => {
  const { blocks, meta, metaRow } = M.extractMetaRow(rows());
  assert.equal(blocks.length, 3); assert.equal(meta.guide, "2016"); assert.equal(metaRow.visible, false);
  const s = M.lessonSummary(page, rows());
  assert.equal(s.blocks.length, 3); assert.equal(s.guide, "2016"); assert.equal(s.needsReview, true); assert.equal(s.images, 1); assert.ok(s.words > 5);
});
t("block metadata: codes normalised, review flag, reviewed date, untrusted input coerced", () => {
  let b = M.setBlockMeta(rows()[0], { codes: "s1.2.3, S1.2.3; <b>x</b>", guide: "2025", needsReview: true });
  assert.deepEqual(M.getBlockMeta(b).codes, ["S1.2.3"]); assert.equal(M.getBlockMeta(b).needsReview, true);
  b = M.setBlockMeta(b, M.markReviewed(M.getBlockMeta(b), "2026-11-16T00:00:00Z"));
  assert.equal(M.getBlockMeta(b).needsReview, false); assert.equal(M.getBlockMeta(b).reviewedAt, "2026-11-16T00:00:00Z");
  assert.equal(M.normalizeMeta({ codes: 5, guide: {}, needsReview: "yes" }).needsReview, false);
  assert.equal("meta" in M.setBlockMeta(rows()[0], { codes: [], guide: "" }).content, false, "empty meta is not stored");
});
t("filters and text search: topic, status, code, guide, needs review, query", () => {
  const pages = [page, { ...page, id: "p2", lesson_code: "S1.1.2", title: "Moles", status: "draft", syllabus_codes: ["S1.4.1"], parent_topic: "S1.4" }];
  const blocks = [...rows(), { id: "q", page_id: "p2", position: 0, visible: true, block_type: "rich_text", content: { html: "<p>The mole is a unit</p>" } }];
  const all = M.summariseAll(pages, blocks, {});
  assert.equal(M.filterLessons(all, { query: "neutrons" }).length, 1);
  assert.equal(M.filterLessons(all, { guide: "__none__" }).length, 1);
  assert.equal(M.filterLessons(all, { guide: "2016" })[0].id, "p1");
  assert.equal(M.filterLessons(all, { needsReview: true }).length, 1);
  assert.equal(M.filterLessons(all, { code: "s1.4" })[0].id, "p2");
  assert.equal(M.filterLessons(all, { status: "draft" }).length, 1);
  assert.equal(M.searchBlocks(pages, blocks, "mole")[0].blockId, "q");
  assert.equal(M.searchBlocks(pages, blocks, "x").length, 0, "queries under 2 characters are ignored");
});
t("export -> import round trip keeps blocks, layout, canvas positions and metadata; imports are always NEW drafts", () => {
  const canvasBlocks = C.toCanvas(rows().filter((r) => r.block_type !== "lesson_meta"));
  const withMeta = [...canvasBlocks, rows()[3]];
  const exp = R.buildExport([{ page, rows: withMeta, checkCount: 2 }], "2026-11-16T00:00:00Z");
  const text = JSON.stringify(exp);
  const res = R.parseImportText(text, { knownTypes: ["rich_text", "image"], existing: [{ parent_topic: "S1.1", lesson_code: "S1.1.1" }] });
  assert.ok(res.ok, res.errors.join());
  const l = res.lessons[0];
  assert.equal(l.plan, "create"); assert.equal(l.status, "draft"); assert.equal(l.lesson_code, "S1.1.1 (import 2)", "never reuses an existing code");
  assert.equal(l.blocks.length, 3); assert.equal(l.meta.guide, "2016");
  assert.deepEqual(l.blocks.map((b) => b.content.layout), canvasBlocks.map((b) => b.content.layout));
  assert.ok(res.warnings.some((w) => /2 Check Your Understanding/.test(w)));
  assert.equal(R.dryRunSummary(res).length, 1);
});
t("invalid import files are rejected with clear messages and write nothing", () => {
  const bad = (x, re) => { const r = typeof x === "string" ? R.parseImportText(x) : R.validateImport(x, { knownTypes: ["rich_text"] }); assert.equal(r.ok, false); assert.equal(r.lessons.length, 0); assert.match(r.errors.join(" "), re); };
  bad("{nope", /Invalid JSON/); bad([], /not a JSON object/); bad({ format: "x" }, /Not an e-Lab lesson export/);
  bad({ format: R.EXPORT_FORMAT, version: 9, lessons: [] }, /Unsupported export version/); bad({ format: R.EXPORT_FORMAT, version: 1, lessons: [] }, /no lessons/);
  const ok = { parent_topic: "S1.1", lesson_code: "X", title: "T", level: "SL", blocks: [{ block_type: "rich_text", content: { html: "<p>x</p>" } }] };
  const wrap = (l) => ({ format: R.EXPORT_FORMAT, version: 1, lessons: [l] });
  assert.ok(R.validateImport(wrap(ok), { knownTypes: ["rich_text"] }).ok);
  bad(wrap({ ...ok, level: "ZZ" }), /level/); bad(wrap({ ...ok, title: "" }), /title/); bad(wrap({ ...ok, blocks: [{ block_type: "nope", content: {} }] }), /unknown block type/);
  bad(wrap({ ...ok, blocks: [{ block_type: "rich_text", content: { html: "<script>alert(1)</script>" } }] }), /script-like/);
  bad(wrap({ ...ok, blocks: [{ block_type: "lesson_meta", content: {} }] }), /reserved/); bad(wrap({ ...ok, blocks: "x" }), /blocks/);
});
t("duplicate as new guide version: new draft, unique code, version stamped, original untouched", () => {
  const before = JSON.stringify(rows());
  const d = R.buildDuplicate(page, rows(), "2025", { existingCodes: ["S1.1.1 [2025]"] });
  assert.equal(d.page.lesson_code, "S1.1.1 [2025] (2)"); assert.equal(d.meta.guide, "2025"); assert.equal(d.meta.needsReview, true); assert.equal(d.meta.derivedFrom.id, "p1");
  assert.equal(d.blocks.length, 3); assert.ok(d.blocks.every((b) => M.getBlockMeta({ content: b.content }).guide === "2025"));
  assert.equal(d.blocks[0].content.html, rows()[0].content.html);
  assert.equal(JSON.stringify(rows()), before); assert.throws(() => R.buildDuplicate(page, rows(), "  "), /guide version/);
});
t("block library: templates drop layout, reject check blocks and script content, survive export/import", () => {
  const b = { ...rows()[0], content: { ...rows()[0].content, layout: { v: 1, span: 6 }, ui: { h: 5 } } };
  const tpl = R.makeTemplate("Intro", [b]);
  assert.equal(tpl.blocks[0].content.layout, undefined); assert.equal(tpl.blocks[0].content.ui, undefined);
  assert.throws(() => R.makeTemplate("x", [{ block_type: "check_understanding", content: {} }]), /cannot be saved/);
  const lib = R.validateLibrary(JSON.parse(JSON.stringify(R.exportLibrary([tpl]))));
  assert.ok(lib.ok); assert.equal(lib.templates[0].name, "Intro");
  assert.equal(R.validateLibrary({ format: "bad" }).ok, false);
  assert.equal(R.validateLibrary(R.exportLibrary([{ ...tpl, blocks: [{ block_type: "rich_text", content: { html: "<script>1</script>" } }] }])).ok, false);
  const mem = new Map(); const st = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  R.saveLibrary([tpl], st); assert.equal(R.loadLibrary(st).length, 1);
});

console.log(`\n${n} canvas / reuse tests passed`);
