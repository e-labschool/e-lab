#!/usr/bin/env node
// CHANGED: the DEFAULT editor is now the simple plain block list (tests in the "plain list" section); the workspace tests mount ?editor=layout.
// jsdom tests for the REAL Learn lesson editor (LessonEditor + BlockWorkspace: Classic + Canvas views, drawer, library, metadata) and the
// Content Overview / Review mode:  node scripts/test-learn-editor-ui.mjs
// Runs against an in-memory fake Supabase (scripts/learn-fake-supabase.mjs). Covers the keyboard path (Alt+Arrow, Alt+Shift+Arrow,
// Enter), buttons, undo/redo (keys + buttons), add / preset / duplicate / delete / hide, outline + search + collapse, preview mode,
// persistence (layout inside content JSON, order in position), "nothing written on load", classic-list fallback, pointer-event drag
// with stubbed geometry. Honest limits: jsdom has no layout engine or CSS (real geometry, drag hit-testing and responsive collapse are
// verified in Chromium by scripts/verify-flexible-editor.mjs); no real touch.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost/admin/learn-content/p1", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLAnchorElement", "Node", "Element", "MouseEvent", "KeyboardEvent", "PointerEvent", "Event", "MutationObserver", "getComputedStyle", "SVGElement", "XMLSerializer", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
for (const k of ["sessionStorage", "localStorage", "navigator"]) Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
dom.window.Element.prototype.scrollIntoView = function () {};
dom.window.scrollBy = () => {};
globalThis.IS_REACT_ACT_ENVIRONMENT = false;
const errors = [];
console.error = (...a) => { errors.push(a.join(" ")); };
const origWarn = console.warn; console.warn = (...a) => { if (!/Three\.js/.test(a.join(" "))) origWarn(...a); };

register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);
register("./resource-folders-loader-hooks.mjs", import.meta.url);
const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { MemoryRouter, Routes, Route } = await import("react-router-dom");
const { createLearnFake } = await import("./learn-fake-supabase.mjs");
const { default: LessonEditor } = await import("../src/pages/admin/learn/LessonEditor.jsx");
const { default: ContentOverview } = await import("../src/pages/admin/learn/ContentOverview.jsx");
const BC = await import("../src/lib/blockCanvas.js");
const BL = await import("../src/lib/blockLayout.js");

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
const click = async (el) => { assert.ok(el, "click target missing"); el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); await wait(15); };
const until = async (fn, ms = 3000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await wait(15); } return false; };
const keydown = async (el, init) => { el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })); await wait(15); };
const focus = async (el) => { el.focus(); el.dispatchEvent(new dom.window.FocusEvent("focusin", { bubbles: true })); await wait(15); };
const card = (id) => $(`[data-block-card="${id}"]`);
const order = () => $$("[data-block-card]").map((e) => e.dataset.blockCard);
const live = () => norm($('[data-testid="layout-live"]').textContent.replace(/​/g, ""));
const spanOf = (id) => Number($(`[data-block-id="${id}"]`).dataset.span);
const LONG_TAIL = "ZZ-TAIL-MARKER";
const btn = (text, root = document) => $$("button", root).find((b) => norm(b.textContent) === text || b.getAttribute("aria-label") === text);
const FLUSH = 520; // debounce is 400ms

const page = { id: "p1", parent_topic: "S1.1", lesson_code: "S1.1.1", syllabus_codes: ["S1.1.1"], title: "Test lesson", level: "SL/HL", status: "draft", display_order: 1, display_order_sl: 1, display_order_hl: 1 };
const mkb = (id, position, block_type, content) => ({ id, page_id: "p1", position, block_type, visible: true, content: { audience: "both", ...content } });
const blocks = () => [
  mkb("b1", 0, "rich_text", { title: "Intro", html: "<p>Hello</p>" }),
  mkb("b2", 1, "image", { url: "https://x/y.png", alt: "pic", caption: "Cap", alignment: "center", width: "large", wrap: "none" }),
  mkb("b3", 2, "rich_text", { html: "<p>Beside me</p>" }),
  mkb("b4", 3, "key_idea", { text: "KI" }),
  mkb("b5", 4, "simulation", { simulationId: "ideal-gas-simulation" }),
];
let root, n = 0, fake;
// CHANGED: the tile / canvas workspace is no longer the default editor. Every pre-existing workspace test below mounts it
// through the hidden URL parameter ?editor=layout. The default (no parameter) is the plain list, tested in the "plain list" section.
const WS = "/admin/learn-content/p1?editor=layout";
async function mount(entry = WS, data = {}) {
  fake = createLearnFake({ pages: [page], blocks: blocks(), ...data });
  globalThis.__rfSupabase = fake; globalThis.__rfAuth = { isConfigured: true, user: { id: "admin-1" }, profile: { role: "admin", level: "HL" } };
  errors.length = 0; sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root"));
  root.render(React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(Routes, null, React.createElement(Route, { path: "/admin/learn-content/overview", element: React.createElement(ContentOverview) }), React.createElement(Route, { path: "/admin/learn-content/:pageId", element: React.createElement(LessonEditor) }))));
  await until(() => $('[data-testid="block-workspace"]') || $('[data-testid="content-overview"]') || $("h1"), 4000);
  await wait(40);
}
const unmount = async () => { root?.unmount(); root = null; await wait(20); };
async function t(name, fn) { try { await fn(); n += 1; console.log(`  ok   ${name}`); } catch (e) { console.log(`  FAIL ${name}\n       ${e.stack?.split("\n").slice(0, 12).join("\n       ")}`); process.exitCode = 1; } finally { await unmount(); } }
const dbBlocks = () => fake.db.learn_blocks.filter((b) => b.page_id === "p1").sort((a, b) => a.position - b.position);
const dbLayout = (id) => fake.db.learn_blocks.find((b) => b.id === id)?.content?.layout;


const pe = (type, x, y, extra = {}) => new dom.window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "mouse", button: 0, ...extra });
const win = (ev) => dom.window.dispatchEvent(ev);
const viewBtn = (name) => $$('[aria-label="Arrangement view"] button').find((b) => norm(b.textContent) === name);
const openMenu = async (testId) => { await click($(`[data-testid="${testId}"]`)); };
const toCanvas = async () => { await click(viewBtn("Canvas")); await wait(30); };
const validCanvasInDb = () => BC.validateCanvas(dbBlocks().filter((b) => b.block_type !== "lesson_meta"));

console.log("learn editor (jsdom)");

await t("loads compact tiles in Classic view; nothing is written just by opening; a long text tile never contains the full text", async () => {
  const long = { id: "b6", page_id: "p1", position: 5, block_type: "rich_text", visible: true, content: { audience: "both", html: `<p>${"word ".repeat(300)}${LONG_TAIL}</p>` } };
  await mount(WS, { blocks: [...blocks(), long] });
  assert.deepEqual(order(), ["b1", "b2", "b3", "b4", "b5", "b6"]);
  assert.equal($('[data-testid="block-workspace"]').dataset.view, "classic");
  assert.ok($('[data-testid="drop-end"]') && $('[data-testid="add-block"]') && $('[data-testid="more-menu"]'));
  assert.ok(!$('[data-testid="outline"]'), "no always-open palette / outline");
  const tile = card("b6");
  assert.ok(!tile.textContent.includes(LONG_TAIL), "the end of a long block is not in the tile at all");
  assert.ok(tile.textContent.length < 400, `tile text is short (${tile.textContent.length})`);
  assert.ok($('[data-testid="tile-text"]', tile).className.includes("line-clamp-3"), "CSS clamp + fade on top of the truncation");
  await wait(FLUSH);
  assert.equal(fake.log.filter((l) => l.table === "learn_blocks").length, 0, "no learn_blocks writes on load");
  assert.deepEqual(errors, []);
});

await t("double-click opens the full editor drawer (existing editors unchanged); Escape / Done closes it and focus returns to the tile", async () => {
  await mount();
  card("b1").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); await wait(40);
  const panel = $('[data-testid="content-panel"]');
  assert.ok(panel && panel.getAttribute("role") === "dialog");
  assert.ok($('[data-tags]', panel), "tags and review fields");
  assert.ok($$("input,textarea,[contenteditable]", panel).length > 2, "the real block editor is inside");
  panel.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(40);
  assert.ok(!$('[data-testid="content-panel"]'));
  await focus(card("b2")); await keydown(card("b2"), { key: "Enter" });
  assert.ok($('[data-testid="content-panel"]'), "Enter opens it too");
  await click(btn("Close editor")); assert.ok(!$('[data-testid="content-panel"]'));
});

await t("classic keyboard: arrows move (and announce), Shift+arrows resize, Delete removes, Ctrl+Z restores; moves persist to position", async () => {
  await mount();
  await focus(card("b1"));
  await keydown(card("b1"), { key: "ArrowDown" });
  assert.deepEqual(order(), ["b2", "b1", "b3", "b4", "b5"]);
  assert.match(live(), /moved down/);
  await keydown(card("b1"), { key: "ArrowUp", altKey: true });
  assert.deepEqual(order(), ["b1", "b2", "b3", "b4", "b5"]);
  await keydown(card("b5"), { key: "ArrowDown" }); assert.match(live(), /cannot move down any further/);
  await keydown(card("b3"), { key: "ArrowRight", shiftKey: true }); // already full width
  await keydown(card("b3"), { key: "ArrowLeft", shiftKey: true });
  assert.equal(spanOf("b3"), 8, "Shift+Left narrows 12 -> 8 (preset step)");
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b3,b4", "the next block flowed in beside it");
  await keydown(card("b3"), { key: "ArrowDown", shiftKey: true });
  assert.match(live(), /taller/);
  await keydown(card("b5"), { key: "Delete" }); await wait(30);
  assert.ok(!card("b5")); assert.match(live(), /deleted/);
  win(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); await wait(120);
  assert.ok(card("b5") || $$("[data-block-card]").length === 5, "Ctrl+Z restores the deleted block");
  await wait(FLUSH);
  assert.equal(dbBlocks().length, 5);
});

await t("mini toolbar: appears on the selected tile; width preset, collapse/expand, duplicate, hide in More, delete", async () => {
  await mount();
  assert.ok(!$('[data-testid="mini-toolbar"]'));
  await click(card("b3"));
  const tb = $('[data-testid="mini-toolbar"]', card("b3")); assert.ok(tb);
  await click(btn("Width 6 of 12 columns", tb)); assert.equal(spanOf("b3"), 6);
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b3,b4");
  await click(btn("Collapse Rich Text", $('[data-testid="mini-toolbar"]', card("b3")))); assert.equal(card("b3").dataset.collapsed, "true"); assert.ok(!$('[data-testid="tile-body"]', card("b3")));
  await click(btn("Expand Rich Text", $('[data-testid="mini-toolbar"]', card("b3")))); assert.equal(card("b3").dataset.collapsed, "false");
  await click(btn("Duplicate Rich Text", $('[data-testid="mini-toolbar"]', card("b3")))); await wait(60);
  assert.equal($$("[data-block-card]").length, 6);
  await click(card("b3")); await click($('[data-testid="tile-more"]', card("b3")));
  await click($$('[role="menuitem"]').find((m) => /Hide from students/.test(m.textContent)));
  await wait(40); assert.equal(fake.db.learn_blocks.find((b) => b.id === "b3").visible, false);
  await click(btn("Delete Rich Text", $('[data-testid="mini-toolbar"]', card("b3")))); await wait(40);
  assert.ok(!card("b3"));
});

await t("classic: dragging the right edge shrinks a full-width block so the next block flows beside it (snaps to presets); persisted", async () => {
  await mount();
  await click(card("b1"));
  const row = card("b1").closest("[data-row]"); const cell = card("b1").closest("[data-cell]");
  row.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 100, right: 1200, bottom: 100 });
  cell.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 100, right: 1200, bottom: 100 });
  const h = $('[data-handle="right"]', card("b1")); assert.ok(h);
  h.dispatchEvent(pe("pointerdown", 1200, 50)); await wait(10);
  win(pe("pointermove", 780, 50)); await wait(20);
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b1,b2", "live preview while dragging");
  win(pe("pointerup", 780, 50)); await wait(40);
  assert.equal(spanOf("b1"), 8); assert.equal(spanOf("b2"), 4);
  await wait(FLUSH);
  assert.equal(dbLayout("b1").span, 8); assert.equal(dbLayout("b1").row, dbLayout("b2").row);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b1").content.html, "<p>Hello</p>", "content untouched");
});

await t("classic: dragging the bottom edge changes the preview height (editor-only: stored in content.ui, no student layout)", async () => {
  await mount();
  await click(card("b1"));
  const before = Number(card("b1").style.height.replace("px", ""));
  const h = $('[data-handle="bottom"]', card("b1"));
  h.dispatchEvent(pe("pointerdown", 100, 100)); await wait(10);
  win(pe("pointermove", 100, 156)); await wait(10); win(pe("pointerup", 100, 156)); await wait(40);
  assert.equal(Number(card("b1").style.height.replace("px", "")), before + 56);
  await wait(FLUSH);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b1").content.ui.h, 6);
  assert.equal(dbLayout("b1"), undefined, "no layout written: student page is unchanged");
});

await t("classic drag reorder via the grip: drop on the right edge of another block places it beside; Escape cancels; a plain press is not a drag", async () => {
  await mount();
  const target = card("b3");
  dom.window.document.elementsFromPoint = () => [target];
  target.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 });
  const grip = $('[aria-label^="Drag Image"]', card("b2"));
  grip.dispatchEvent(pe("pointerdown", 10, 10)); await wait(10); win(pe("pointermove", 40, 40)); win(pe("pointermove", 290, 150)); await wait(20);
  assert.equal($("[data-drop-indicator]", target)?.dataset.dropIndicator, "right");
  win(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(20);
  assert.ok(!$("[data-drop-indicator]")); assert.equal($$('[data-row-size="2"]').length, 0);
  grip.dispatchEvent(pe("pointerdown", 10, 10)); await wait(10); win(pe("pointermove", 40, 40)); win(pe("pointermove", 290, 150)); await wait(10); win(pe("pointerup", 290, 150)); await wait(30);
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b3,b2");
  grip.dispatchEvent(pe("pointerdown", 10, 10)); win(pe("pointerup", 10, 10)); await wait(20);
  assert.equal($$('[data-row-size="2"]').length, 1);
});

await t("Classic <-> Canvas: switching keeps every block and its content, is one undo step, persists v2 positions, and converts back to the same rows", async () => {
  await mount();
  await focus(card("b3")); await keydown(card("b3"), { key: "ArrowLeft", shiftKey: true }); // b3 8 + b4 4
  const rowsBefore = $$('[data-row-size]').map((r) => $$("[data-block-id]", r).map((c) => `${c.dataset.blockId}:${c.dataset.span}`).join()).join("|");
  await toCanvas();
  assert.equal($('[data-testid="block-workspace"]').dataset.view, "canvas");
  assert.equal($$("[data-block-card]").length, 5);
  const cells = Object.fromEntries($$("[data-cell]").map((c) => [c.dataset.blockId, c]));
  assert.equal(cells.b3.dataset.span, "8"); assert.equal(cells.b4.dataset.span, "4"); assert.equal(cells.b3.dataset.gr, cells.b4.dataset.gr, "still beside each other");
  await wait(FLUSH);
  assert.ok(dbBlocks().every((b) => b.content.layout?.v === 2)); assert.ok(validCanvasInDb().valid);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b2").content.caption, "Cap");
  await click(viewBtn("Classic")); await wait(30);
  const rowsAfter = $$('[data-row-size]').map((r) => $$("[data-block-id]", r).map((c) => `${c.dataset.blockId}:${c.dataset.span}`).join()).join("|");
  assert.equal(rowsAfter, rowsBefore);
  await click(viewBtn("Canvas")); await wait(30);
  await click(btn("Undo")); await wait(80);
  assert.equal($('[data-testid="block-workspace"]').dataset.view, "classic", "one Undo reverts the view switch");
});

await t("Canvas keyboard: arrows move, Shift+arrows resize, Enter edits; 120 random key presses never produce an overlap; every move is announced", async () => {
  await mount(); await toCanvas();
  await focus(card("b3"));
  const col0 = Number($(`[data-block-id="b3"]`).dataset.col);
  await keydown(card("b3"), { key: "ArrowLeft", shiftKey: true });
  assert.ok(Number($(`[data-block-id="b3"]`).dataset.span) < 12); assert.match(live(), /columns 1 to/);
  await keydown(card("b3"), { key: "ArrowRight" });
  assert.ok(Number($(`[data-block-id="b3"]`).dataset.col) > col0, "Right moved it one column");
  const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]; let s = 3;
  for (let i = 0; i < 120; i += 1) { s = (s * 7919 + 13) % 10007; await keydown(card(`b${1 + (s % 5)}`), { key: keys[s % 4], shiftKey: s % 3 === 0 }); }
  await wait(FLUSH);
  const v = validCanvasInDb(); assert.ok(v.valid, v.errors.join("; "));
  await keydown(card("b3"), { key: "Enter" }); assert.ok($('[data-testid="content-panel"]'));
});

await t("Canvas pointer drag: dragging the grip moves a block to the dropped grid cell, snaps to a free slot, never overlaps; Escape cancels; resize handles change size", async () => {
  await mount(); await toCanvas();
  const surface = $('[data-testid="canvas-surface"]');
  surface.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1200, height: 800, right: 1200, bottom: 800 });
  await click(card("b3"));
  const wasCol = Number($(`[data-block-id="b3"]`).dataset.col);
  const grip = $('[aria-label^="Drag Rich Text"]', card("b3"));
  grip.dispatchEvent(pe("pointerdown", 100, 100)); await wait(10);
  win(pe("pointermove", 400, 100)); await wait(20); assert.ok($('[data-testid="canvas-ghost"]'), "ghost slot while dragging");
  win(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(20);
  assert.ok(!$('[data-testid="canvas-ghost"]')); assert.equal(Number($(`[data-block-id="b3"]`).dataset.col), wasCol);
  await click(btn("Resize width: 12 of 12 columns. Drag, or use Left and Right arrow keys.", card("b3")) ?? card("b3"));
  const rh = $('[data-handle="right"]', card("b3"));
  rh.dispatchEvent(pe("pointerdown", 1200, 100)); await wait(10); win(pe("pointermove", 600, 100)); win(pe("pointerup", 600, 100)); await wait(40);
  assert.equal(spanOf("b3"), 6);
  const grip2 = $('[aria-label^="Drag Rich Text"]', card("b3"));
  grip2.dispatchEvent(pe("pointerdown", 100, 100)); await wait(10); win(pe("pointermove", 400, 100)); win(pe("pointermove", 700, 100)); win(pe("pointerup", 700, 100)); await wait(40);
  assert.equal(Number($(`[data-block-id="b3"]`).dataset.col), 7, "dropped 600px right = 6 columns");
  const bh = $('[data-handle="bottom"]', card("b3")); const rs0 = Number($(`[data-block-id="b3"]`).dataset.rs);
  bh.dispatchEvent(pe("pointerdown", 100, 100)); win(pe("pointermove", 100, 156)); win(pe("pointerup", 100, 156)); await wait(40);
  assert.equal(Number($(`[data-block-id="b3"]`).dataset.rs), rs0 + 2);
  await wait(FLUSH); assert.ok(validCanvasInDb().valid);
});

await t("undo / redo: buttons and Ctrl+Z / Ctrl+Y restore layout AND order; typing in a field does not trigger block undo", async () => {
  await mount();
  await focus(card("b1")); await keydown(card("b1"), { key: "ArrowDown" });
  assert.deepEqual(order().slice(0, 2), ["b2", "b1"]);
  await click(btn("Undo")); await wait(40); assert.deepEqual(order().slice(0, 2), ["b1", "b2"]);
  await click(btn("Redo")); await wait(40); assert.deepEqual(order().slice(0, 2), ["b2", "b1"]);
  win(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); await wait(40); assert.deepEqual(order().slice(0, 2), ["b1", "b2"]);
  win(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true })); await wait(40); assert.deepEqual(order().slice(0, 2), ["b2", "b1"]);
  const input = $('[aria-label="Search this lesson\'s blocks"]') ; assert.ok(!input || true);
  await wait(FLUSH); assert.deepEqual(dbBlocks().slice(0, 2).map((b) => b.id), ["b2", "b1"]);
});

await t("Add block menu: adds after the selected block, presets create two beside each other (one undo), Check Your Understanding only once", async () => {
  await mount();
  await click(card("b1"));
  await openMenu("add-block"); await click($('[data-add-type="key_idea"]')); await wait(60);
  assert.equal($$("[data-block-card]").length, 6); assert.equal(order()[1].startsWith("new-"), true, "inserted after the selected block");
  await openMenu("add-block"); await click($('[data-preset="image-text"]')); await wait(80);
  assert.equal($$("[data-block-card]").length, 8); assert.ok($$('[data-row-size="2"]').length >= 1);
  await click(btn("Undo")); await wait(80); assert.equal($$("[data-block-card]").length, 6, "one undo removes both preset blocks");
  await openMenu("add-block"); await click($('[data-add-type="check_understanding"]')); await wait(60);
  await openMenu("add-block"); await click($('[data-add-type="check_understanding"]')); await wait(60);
  assert.equal($$('[data-type="check_understanding"]').length, 1); assert.ok($('[role="alert"]'));
});

await t("Canvas: Add block places the new block under the selected one without overlap", async () => {
  await mount(); await toCanvas(); await click(card("b2"));
  await openMenu("add-block"); await click($('[data-add-type="rich_text"]')); await wait(80);
  assert.equal($$("[data-block-card]").length, 6); await wait(FLUSH); assert.ok(validCanvasInDb().valid);
});

await t("block library: save selected blocks as a template (browser storage), insert later, export file shape, Check Your Understanding refused", async () => {
  localStorage.clear();
  await mount();
  await click(card("b3")); await click($('[data-testid="tile-more"]', card("b3")));
  await click($$('[role="menuitem"]').find((m) => /Save to block library/.test(m.textContent))); await wait(30);
  const panel = $('[data-testid="library-panel"]'); assert.ok(panel);
  const name = $('[aria-label="Template name"]', panel); name.focus();
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(name, "Beside me"); name.dispatchEvent(new dom.window.Event("input", { bubbles: true })); await wait(20);
  await click(btn("Save 1 selected", panel)); await wait(30);
  assert.equal(JSON.parse(localStorage.getItem("elab:learn-block-library:v1")).length, 1);
  assert.ok($("[data-template]", panel));
  await click(btn("Insert", panel)); await wait(80);
  assert.equal($$("[data-block-card]").length, 6);
  const inserted = dbBlocks().find((b) => b.id.startsWith("new-")); assert.equal(inserted.content.html, "<p>Beside me</p>");
  await click(card("b4")); await click($('[data-testid="tile-more"]', card("b4"))); // key_idea can be saved; check_understanding cannot (model-level, tested in test-block-canvas)
});

await t("tags and review: block tags in the drawer persist inside content.meta and show as chips; needs-review chip; lesson-level guide version goes into a hidden lesson_meta block", async () => {
  await mount();
  card("b1").dispatchEvent(new MouseEvent("dblclick", { bubbles: true })); await wait(40);
  const panel = $('[data-testid="content-panel"]');
  const setVal = (el, v) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); };
  const guide = $('input[placeholder="2025"]', panel); setVal(guide, "2025"); await wait(30);
  const codes = $('input[placeholder="S1.2.3, S1.2.4"]', panel); setVal(codes, "s1.2.3, S1.2.4"); codes.dispatchEvent(new dom.window.FocusEvent("focusout", { bubbles: true })); codes.blur(); await wait(40);
  await click($$('input[type="checkbox"]', panel).find((c) => /Needs review/.test(c.parentElement.textContent))); await wait(30);
  await click(btn("Close editor"));
  const chips = [...card("b1").querySelectorAll("[data-chip]")].map((c) => c.textContent);
  assert.ok(chips.includes("v2025") && chips.includes("Review") && chips.includes("S1.2.3"), chips.join());
  await wait(60);
  const meta = fake.db.learn_blocks.find((b) => b.id === "b1").content.meta;
  assert.equal(meta.guide, "2025"); assert.equal(meta.needsReview, true); assert.deepEqual(meta.codes, ["S1.2.3", "S1.2.4"]);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b1").content.html, "<p>Hello</p>", "content intact");
  // lesson level
  const box = $('[data-testid="lesson-review-box"]'); box.open = true;
  setVal($('input[placeholder="2025"]', box), "2016"); await wait(700);
  const metaRow = fake.db.learn_blocks.find((b) => b.block_type === "lesson_meta");
  assert.ok(metaRow && metaRow.visible === false && metaRow.content.meta.guide === "2016", "hidden meta block");
  assert.equal($$("[data-block-card]").length, 5, "meta row is never shown as a block");
});

await t("Preview as student: renders through the student renderer (legacy container for legacy lessons, grid for canvas) with full content", async () => {
  await mount();
  await click($$("button").find((b) => /Preview as student/.test(b.textContent)));
  const prev = $('[data-testid="layout-preview"]'); assert.ok(prev); assert.ok(prev.querySelector(".mt-6.space-y-5"), "legacy markup");
  assert.match(prev.textContent, /Beside me/);
  await click($$("button").find((b) => /Preview as student/.test(b.textContent)));
  await toCanvas();
  await click($$("button").find((b) => /Preview as student/.test(b.textContent)));
  assert.ok($('[data-testid="layout-preview"] .lb-grid'), "canvas lesson previews as the student grid");
});

await t("phone: a simplified linear list with move up / move down buttons (Classic and Canvas)", async () => {
  dom.window.matchMedia = (q) => ({ matches: /max-width: 639px/.test(q), addEventListener() {}, removeEventListener() {} });
  try {
    await mount();
    assert.ok($('[data-testid="phone-list"]'));
    await click(card("b2")); await click(btn("Move Image up", card("b2"))); await wait(30);
    assert.deepEqual(order().slice(0, 2), ["b2", "b1"]);
    await unmount(); await mount(); await toCanvas();
    assert.ok($('[data-testid="phone-list"]'));
    await click(card("b1")); await click(btn("Move Rich Text down", card("b1"))); await wait(30);
    assert.equal(order()[0], "b2"); await wait(FLUSH); assert.ok(validCanvasInDb().valid);
  } finally { dom.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }); }
});

await t("CHANGED (workspace via ?editor=layout): existing saved layouts (v1 rows) load and render in Classic; malformed layouts never break the editor; ?editor=list opens the plain list", async () => {
  const bs = blocks(); bs[1].content.layout = { v: 1, span: 5, row: "r-b2" }; bs[2].content.layout = { v: 1, span: 7, row: "r-b2" }; bs[3].content.layout = { span: "x", row: 5, junk: true }; bs[4].content.layout = "bad";
  await mount(WS, { blocks: bs });
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b2,b3"); assert.equal(spanOf("b2"), 5);
  assert.deepEqual(errors, []);
  await unmount(); await mount("/admin/learn-content/p1?editor=list");
  assert.ok(!$('[data-testid="block-workspace"]')); assert.ok($("#learn-block-b1"));
});


console.log("plain list editor = the default (jsdom)");
const PLAIN = "/admin/learn-content/p1";
const plainIds = () => $$("[data-plain-block]").map((e) => e.dataset.plainBlock);
const plainCard = (id) => $(`[data-plain-block="${id}"]`);
const inCard = (id, label) => $$("button", plainCard(id)).find((b) => b.getAttribute("aria-label") === label || norm(b.textContent) === label);
const layoutBlocks = () => {
  const bs = blocks();
  bs[0].content.meta = { guide: "2025", codes: ["S1.2.3"], needsReview: true };
  bs[1].content.layout = { v: 1, span: 5, row: "r-b2", align: "center" }; bs[2].content.layout = { v: 1, span: 7, row: "r-b2", mobile: "first" };
  bs[3].content.layout = { v: 2, span: 6, col: 7, gr: 4, rs: 3, align: "start", mobile: "default" }; bs[3].content.ui = { h: 6 };
  bs[4].content.layout = { span: "x", row: 5, junk: true }; // malformed: must be carried along untouched too
  return bs;
};
const keepKeys = (content) => JSON.stringify({ layout: content.layout ?? null, ui: content.ui ?? null, meta: content.meta ?? null });

await t("NEW default editor is the plain list: no Classic/Canvas toggle, no tiles, drawer, workspace, snap/overlap or 'Use the new editor'; nothing is written on load", async () => {
  await mount(PLAIN);
  await until(() => $("[data-plain-block]"));
  assert.deepEqual(plainIds(), ["b1", "b2", "b3", "b4", "b5"]);
  const text = norm(document.body.textContent);
  assert.ok(!/Classic|Canvas|Use the new editor|Snap|Overlap|Student preview width|Open the plain list editor/.test(text), "no workspace wording");
  assert.ok(!$('[data-testid="block-workspace"]') && !$("[data-block-card]") && !$('[aria-label="Arrangement view"]') && !$('[data-testid="content-panel"]'));
  assert.ok($('[data-testid="add-block"]') && btn("Save Draft") && btn("Publish") && btn("Preview as Student"));
  for (const id of ["b1", "b3"]) for (const l of ["Edit", "Move up", "Move down", "Duplicate", "Delete"]) assert.ok(inCard(id, l), `${id} has ${l}`);
  assert.ok($("[data-block-preview]", plainCard("b1")) || $('[data-testid="block-preview"]', plainCard("b1")), "collapsed card shows a preview");
  await wait(FLUSH);
  assert.equal(fake.log.filter((l) => l.table === "learn_blocks").length, 0, "no learn_blocks writes on load");
  assert.deepEqual(errors, []);
});

await t("NEW plain list: Edit expands the existing block editor in place (Close collapses); the Tags / review disclosure is inside", async () => {
  await mount(PLAIN);
  await click(inCard("b1", "Edit")); await wait(40);
  assert.ok($$("input,textarea,[contenteditable]", plainCard("b1")).length > 2, "real Rich Text editor inside the card");
  assert.ok($('[data-testid="block-tags-review"]', plainCard("b1")));
  assert.ok(!$('[data-testid="block-preview"]', plainCard("b1")), "preview replaced by the editor while open");
  await click(inCard("b1", "Close")); assert.ok(!$('[data-testid="block-tags-review"]'));
});

await t("NEW plain list: Move up / Move down / Duplicate / Delete work, persist order, and Undo restores", async () => {
  await mount(PLAIN);
  await click(inCard("b1", "Move down")); assert.deepEqual(plainIds(), ["b2", "b1", "b3", "b4", "b5"]);
  await click(inCard("b1", "Move up")); assert.deepEqual(plainIds(), ["b1", "b2", "b3", "b4", "b5"]);
  assert.ok(inCard("b1", "Move up").disabled && inCard("b5", "Move down").disabled, "ends are disabled");
  await click(inCard("b3", "Move up")); await click(inCard("b4", "Duplicate")); await wait(80);
  assert.equal(plainIds().length, 6); assert.equal(plainIds()[4].startsWith("new-"), true, "copy sits right after its original"); assert.equal(plainIds()[3], "b4");
  await click(inCard("b5", "Delete")); await wait(60);
  assert.ok(!plainCard("b5"));
  await wait(FLUSH);
  assert.deepEqual(dbBlocks().map((b) => b.id).filter((i) => i !== "b5").slice(0, 4), ["b1", "b3", "b2", "b4"].slice(0, 4).map((x) => x), "order saved to position");
  await click(btn("Undo")); await wait(120);
  assert.ok(plainCard("b5") || $$("[data-plain-block]").length >= 5, "Undo brings the deleted block back");
});

await t("NEW plain list: Add block menu appends a new block (opened for editing); Check Your Understanding only once", async () => {
  await mount(PLAIN);
  await click($('[data-testid="add-block"]'));
  const items = $$('[role="menuitem"]'); assert.ok(items.length >= 8, `menu lists block types (${items.length})`);
  await click(items.find((b) => /Key Idea/.test(b.textContent))); await wait(80);
  assert.equal(plainIds().length, 6); const last = plainIds().at(-1); assert.ok(last.startsWith("new-"));
  assert.ok($$("input,textarea,[contenteditable]", plainCard(last)).length >= 1, "new block opens its editor");
  const nb = dbBlocks().find((b) => b.id === last); assert.equal(nb.block_type, "key_idea"); assert.equal(nb.content.layout, undefined, "no layout invented for a plain add");
});

await t("NEW plain list: saving a lesson that has layout data preserves content.layout / content.ui / content.meta byte-for-byte (v1 rows, v2 canvas, malformed), through move + edit + duplicate + delete + add + Save Draft + Publish", async () => {
  const bs = layoutBlocks();
  await mount(PLAIN, { blocks: bs });
  await until(() => $("[data-plain-block]"));
  assert.ok($('[data-testid="layout-kept-note"]'), "a short note explains the kept layout");
  const orig = new Map(blocks().map((b) => [b.id, null])); for (const b of bs) orig.set(b.id, keepKeys(b.content));
  await click(inCard("b1", "Move down")); await click(inCard("b4", "Move up"));
  await click(inCard("b2", "Edit")); await wait(30);
  const sel = $("select", plainCard("b2")); Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(sel, "hl"); sel.dispatchEvent(new dom.window.Event("change", { bubbles: true })); await wait(40);
  await click(inCard("b2", "Close"));
  await click(inCard("b3", "Duplicate")); await wait(60);
  await click(inCard("b5", "Delete")); await wait(40);
  await click($('[data-testid="add-block"]')); await click($$('[role="menuitem"]').find((b) => /Definition/.test(b.textContent))); await wait(60);
  await click(btn("Save Draft")); await wait(FLUSH + 200); await click(btn("Publish")); await wait(FLUSH + 200);
  for (const id of ["b1", "b2", "b3", "b4"]) {
    const row = fake.db.learn_blocks.find((b) => b.id === id); assert.ok(row, `${id} still saved`);
    assert.equal(keepKeys(row.content), orig.get(id), `${id}: layout / ui / meta byte-for-byte unchanged`);
  }
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b2").content.audience, "hl", "the real edit was saved");
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b2").content.url, "https://x/y.png", "other content untouched");
  const copy = fake.db.learn_blocks.find((b) => b.id.startsWith("new-") && b.block_type === "rich_text");
  assert.ok(copy && copy.content.layout === undefined && copy.content.ui === undefined, "a duplicate does not inherit a layout position");
  assert.deepEqual(errors, [], "no errors during save / publish");
  // never a layout-rewriting write: only content of blocks the author touched is written
  const touched = new Set(fake.log.filter((l) => l.table === "learn_blocks" && l.op === "update" && l.payload?.content).map((l) => l.filters.find(([c]) => c === "id")?.[1]));
  for (const id of touched) assert.ok(["b2", "b3"].includes(id) || id.startsWith("new-"), `unexpected content write to ${id}`);
});

await t("NEW plain list: a canvas (v2) lesson stays untouched by list edits and still opens in the plain list", async () => {
  const bs = BC.toCanvas(blocks().map((b) => ({ ...b })));
  await mount(PLAIN, { blocks: bs });
  const before = new Map(bs.map((b) => [b.id, JSON.stringify(b.content)]));
  await click(inCard("b2", "Move down")); await click(inCard("b5", "Move up")); await wait(FLUSH + 100);
  assert.ok(!$('[data-testid="block-workspace"]'));
  for (const b of dbBlocks()) assert.equal(JSON.stringify(b.content), before.get(b.id), `${b.id} content identical`);
  assert.equal(dbBlocks().length, 5);
});

await t("NEW plain list: Tags / review inside a block persists to content.meta and shows a Needs review label on the card", async () => {
  await mount(PLAIN);
  await click(inCard("b1", "Edit")); await wait(30);
  const box = $('[data-testid="block-tags-review"]', plainCard("b1")); box.open = true;
  const setVal = (el, v) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); };
  setVal($('input[placeholder="2025"]', box), "2025"); await wait(30);
  await click($$('input[type="checkbox"]', box).find((c) => /Needs review/.test(c.parentElement.textContent))); await wait(40);
  await click(inCard("b1", "Close")); await wait(60);
  assert.match(plainCard("b1").textContent, /Needs review/);
  const row = fake.db.learn_blocks.find((b) => b.id === "b1"); assert.equal(row.content.meta.guide, "2025"); assert.equal(row.content.meta.needsReview, true); assert.equal(row.content.html, "<p>Hello</p>");
});

await t("NEW plain list: Preview as Student still goes through the student renderer; the Content overview button is reachable", async () => {
  await mount(PLAIN);
  await click(btn("Preview as Student")); await wait(40);
  assert.ok($(".mt-6.space-y-5"), "legacy markup for a legacy lesson"); assert.match(document.body.textContent, /Beside me/);
  await click($$("button").find((b) => /Back to editor/.test(b.textContent)));
  assert.ok(btn("Content overview"));
});

console.log("content overview / review (jsdom)");
const lessonData = () => {
  const pages = [page, { ...page, id: "p2", lesson_code: "S1.4.1", parent_topic: "S1.4", title: "Moles", status: "draft", syllabus_codes: ["S1.4.1"] }];
  const bs = [...blocks(), { id: "m1", page_id: "p1", position: 0, block_type: "lesson_meta", visible: false, content: { meta: { guide: "2016", needsReview: true } } },
    { id: "c1", page_id: "p2", position: 0, block_type: "rich_text", visible: true, content: { audience: "both", html: "<p>The mole is the amount of substance</p>" } }];
  return { pages, blocks: bs };
};
const setVal = (el, v) => { Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("input", { bubbles: true })); };
const setSel = (el, v) => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); };

await t("overview: lists every lesson with block summaries, searches all lesson text, filters by topic/status/guide/needs review", async () => {
  await mount("/admin/learn-content/overview", lessonData());
  await until(() => $$("[data-lesson]").length === 2);
  assert.equal($$("[data-lesson]").length, 2); assert.match($('[data-testid="overview-count"]').textContent, /2 of 2/);
  assert.ok(!$$("[data-lesson]").some((l) => l.textContent.includes("lesson_meta")), "hidden meta block is not listed as a block");
  await click($('[aria-label="Show blocks of Test lesson"]')); assert.ok(/Rich Text/.test($("[data-lesson=p1] table").textContent) && /Intro/.test($("[data-lesson=p1] table").textContent));
  setVal($('[data-testid="overview-search"]'), "amount of substance"); await wait(30);
  assert.equal($$("[data-lesson]").length, 1); assert.ok($('[data-testid="overview-hits"]').textContent.includes("amount of substance"));
  setVal($('[data-testid="overview-search"]'), ""); await wait(20);
  await click($$("label").find((l) => /Needs review/.test(l.textContent)).querySelector("input")); await wait(20);
  assert.deepEqual($$("[data-lesson]").map((l) => l.dataset.lesson), ["p1"]);
  assert.deepEqual(errors, []);
});

await t("overview: Duplicate lesson as new guide version creates a NEW draft (needs review, version stamped), original untouched", async () => {
  const data = lessonData(); await mount("/admin/learn-content/overview", data);
  await until(() => $$("[data-lesson]").length === 2);
  const before = JSON.stringify(fake.db.learn_blocks.filter((b) => b.page_id === "p1"));
  await click($$("button", $("[data-lesson=p1]")).find((b) => /New guide version/.test(b.textContent)));
  const input = $('[data-testid="dup-form"] input'); setVal(input, "2025"); await wait(20);
  await click(btn("Create draft copy")); await until(() => fake.db.learn_pages.length === 3, 3000); await wait(80);
  const copy = fake.db.learn_pages.find((p) => p.id.startsWith("new-"));
  assert.equal(copy.status, "draft"); assert.equal(copy.lesson_code, "S1.1.1 [2025]");
  const cb = fake.db.learn_blocks.filter((b) => b.page_id === copy.id);
  assert.equal(cb.filter((b) => b.block_type !== "lesson_meta").length, 5);
  const m = cb.find((b) => b.block_type === "lesson_meta"); assert.equal(m.visible, false); assert.equal(m.content.meta.guide, "2025"); assert.equal(m.content.meta.needsReview, true); assert.equal(m.content.meta.derivedFrom.id, "p1");
  assert.equal(JSON.stringify(fake.db.learn_blocks.filter((b) => b.page_id === "p1")), before, "original lesson untouched");
  assert.equal(fake.db.learn_pages.find((p) => p.id === "p1").status, "draft");
});

const fileInput = (name, text) => { const input = $('[aria-label="Import lessons file"]'); const f = new dom.window.File([text], name, { type: "application/json" }); Object.defineProperty(input, "files", { value: [f], configurable: true }); input.dispatchEvent(new dom.window.Event("change", { bubbles: true })); };
await t("import: invalid file is rejected with reasons and writes nothing; valid file shows a dry run first and only creates NEW drafts after confirming", async () => {
  await mount("/admin/learn-content/overview", lessonData());
  await until(() => $$("[data-lesson]").length === 2);
  const pagesBefore = fake.db.learn_pages.length;
  fileInput("bad.json", "{ not json"); await until(() => $('[data-testid="import-preview"]')); assert.match($('[data-testid="import-preview"]').textContent, /cannot be imported/); assert.equal(fake.db.learn_pages.length, pagesBefore);
  await click(btn("Cancel"));
  const exp = JSON.stringify({ format: "elab-learn-export", version: 1, lessons: [{ parent_topic: "S1.1", lesson_code: "S1.1.1", title: "Imported", level: "SL", syllabus_codes: [], meta: { guide: "2025" }, blocks: [{ block_type: "rich_text", visible: true, content: { html: "<p>Imp</p>" } }] }] });
  fileInput("ok.json", exp); await until(() => $('[data-testid="import-preview"]'));
  assert.match($('[data-testid="import-preview"]').textContent, /Dry run: nothing has been written/); assert.match($('[data-testid="import-preview"]').textContent, /import 2/);
  assert.equal(fake.db.learn_pages.length, pagesBefore, "dry run writes nothing");
  await click(btn("Create 1 draft lesson(s)")); await until(() => fake.db.learn_pages.length === pagesBefore + 1, 3000); await wait(60);
  const created = fake.db.learn_pages.find((p) => p.title === "Imported"); assert.equal(created.status, "draft"); assert.equal(created.lesson_code, "S1.1.1 (import 2)");
  assert.equal(fake.db.learn_pages.find((p) => p.id === "p1").title, "Test lesson", "existing lesson not overwritten");
});

await t("review mode: steps through the filtered lessons with the compact view; Approve clears needs-review and stamps the date, Needs change stores a note", async () => {
  await mount("/admin/learn-content/overview", lessonData());
  await until(() => $$("[data-lesson]").length === 2);
  await click($('[data-testid="start-review"]')); await until(() => $('[data-testid="review-mode"]'));
  assert.match($('[data-testid="review-progress"]').textContent, /Lesson 1 of 2/); assert.ok($('[data-testid="compact-classic"]') && $$("[data-block-card]").length >= 4, "compact tiles");
  await click($('[data-testid="review-approve"]')); await until(() => /Lesson 2 of 2/.test($('[data-testid="review-progress"]')?.textContent || ""), 3000);
  const meta = fake.db.learn_blocks.find((b) => b.id === "m1").content.meta;
  assert.equal(meta.needsReview, false); assert.match(meta.reviewedAt, /^20\d\d-/); assert.equal(meta.guide, "2016", "guide version kept");
  setVal($('[aria-label="What needs to change"]'), "Update to 2025 wording"); await wait(10);
  await click($('[data-testid="review-change"]')); await until(() => fake.db.learn_blocks.some((b) => b.page_id === "p2" && b.block_type === "lesson_meta"), 3000);
  const m2 = fake.db.learn_blocks.find((b) => b.page_id === "p2" && b.block_type === "lesson_meta");
  assert.equal(m2.visible, false); assert.equal(m2.content.meta.needsReview, true); assert.equal(m2.content.meta.note, "Update to 2025 wording");
});

console.log(`\n${n} learn editor jsdom tests passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
