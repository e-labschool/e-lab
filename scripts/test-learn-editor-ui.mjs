#!/usr/bin/env node
// jsdom tests for the REAL Learn lesson editor (LessonEditor + BlockWorkspace + layout ops):  node scripts/test-learn-editor-ui.mjs
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
async function mount(entry = "/admin/learn-content/p1", data = {}) {
  fake = createLearnFake({ pages: [page], blocks: blocks(), ...data });
  globalThis.__rfSupabase = fake; globalThis.__rfAuth = { isConfigured: true, user: { id: "admin-1" }, profile: { role: "admin", level: "HL" } };
  errors.length = 0; sessionStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root"));
  root.render(React.createElement(MemoryRouter, { initialEntries: [entry] }, React.createElement(Routes, null, React.createElement(Route, { path: "/admin/learn-content/:pageId", element: React.createElement(LessonEditor) }))));
  await until(() => $('[data-testid="block-workspace"]') || $('[data-testid="outline"]') || $("h1"), 4000);
  await wait(40);
}
const unmount = async () => { root?.unmount(); root = null; await wait(20); };
async function t(name, fn) { try { await fn(); n += 1; console.log(`  ok   ${name}`); } catch (e) { console.log(`  FAIL ${name}\n       ${e.stack?.split("\n").slice(0, 12).join("\n       ")}`); process.exitCode = 1; } finally { await unmount(); } }
const dbBlocks = () => fake.db.learn_blocks.filter((b) => b.page_id === "p1").sort((a, b) => a.position - b.position);
const dbLayout = (id) => fake.db.learn_blocks.find((b) => b.id === id)?.content?.layout;

console.log("learn editor (jsdom)");

await t("loads the lesson into the workspace; nothing is written just by opening it", async () => {
  await mount();
  assert.deepEqual(order(), ["b1", "b2", "b3", "b4", "b5"]);
  assert.ok($('[data-testid="drop-end"]') && $('[data-testid="outline"]'));
  await wait(FLUSH);
  assert.equal(fake.log.filter((l) => l.table === "learn_blocks").length, 0, "no learn_blocks writes on load");
  assert.deepEqual(errors, []);
});

await t("keyboard: Alt+ArrowDown/Up move a block and announce it; the move is persisted to position", async () => {
  await mount();
  await focus(card("b1"));
  await keydown(card("b1"), { key: "ArrowDown", altKey: true });
  assert.deepEqual(order(), ["b2", "b1", "b3", "b4", "b5"]);
  assert.match(live(), /^Rich Text moved down|^Text moved down/);
  await keydown(card("b1"), { key: "ArrowUp", altKey: true });
  assert.deepEqual(order(), ["b1", "b2", "b3", "b4", "b5"]);
  await keydown(card("b5"), { key: "ArrowDown", altKey: true });
  assert.match(live(), /cannot move down any further/);
  await keydown(card("b4"), { key: "ArrowUp", altKey: true });
  await wait(FLUSH);
  assert.deepEqual(dbBlocks().map((b) => b.id), ["b1", "b2", "b4", "b3", "b5"]);
  assert.equal(dbBlocks().length, 5);
});

await t("keyboard: place beside via settings, swap with Alt+Left/Right, resize with Alt+Shift+Left/Right, Enter opens the content panel", async () => {
  await mount();
  await focus(card("b2"));
  await click(btn("Beside next"));
  assert.equal(spanOf("b2"), 5); assert.equal(spanOf("b3"), 7);
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b2,b3");
  await keydown(card("b2"), { key: "ArrowRight", altKey: true });
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b3,b2");
  assert.match(live(), /moved right/);
  await keydown(card("b2"), { key: "ArrowRight", altKey: true });
  assert.match(live(), /cannot move right/);
  await keydown(card("b2"), { key: "ArrowRight", altKey: true, shiftKey: true });
  assert.equal(spanOf("b2"), 6, "Alt+Shift+Right widens 5 -> 6");
  await keydown(card("b2"), { key: "ArrowLeft", altKey: true, shiftKey: true });
  assert.equal(spanOf("b2"), 5);
  const resizeHandle = $('[aria-label^="Resize width"]', card("b2"));
  assert.ok(resizeHandle, "resize handle is rendered for the selected block");
  await keydown(resizeHandle, { key: "ArrowRight" });
  assert.equal(spanOf("b2"), 6, "the resize handle itself is keyboard operable");
  await keydown(card("b2"), { key: "Enter" });
  assert.ok($('[data-testid="content-panel"]'), "Enter opens the content editor");
  await wait(FLUSH);
  assert.equal(dbLayout("b2").row, dbLayout("b3").row);
  assert.deepEqual([dbLayout("b3").span, dbLayout("b2").span], [6, 6]);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b2").content.caption, "Cap", "content untouched");
});

await t("settings panel: width presets, position, wrapping, vertical alignment, phone order, put on its own row", async () => {
  await mount();
  await focus(card("b3"));
  await click(btn("Width 6 of 12 columns"));
  assert.equal(spanOf("b3"), 6);
  await click(btn("Centre"));
  assert.equal($(`[data-block-id="b3"]`).style.getPropertyValue("--lb-start"), "4");
  await click(btn("Right"));
  assert.equal($(`[data-block-id="b3"]`).style.getPropertyValue("--lb-start"), "7");
  await click(btn("Beside")); // wrap beside => joins a neighbour
  assert.equal($$('[data-row-size="2"]').length, 1);
  assert.equal(btn("Beside").getAttribute("aria-pressed"), "true");
  await click(btn("Middle"));
  assert.equal($(`[data-block-id="b3"]`).dataset.align, "center");
  const sel = $("#mobile-order"); sel.value = "first"; sel.dispatchEvent(new Event("change", { bubbles: true })); await wait(15);
  assert.equal($(`[data-block-id="b3"]`).dataset.mobile, "first");
  await click(btn("Put on its own row"));
  assert.equal($$('[data-row-size="2"]').length, 0);
  await wait(FLUSH);
  assert.equal(dbLayout("b3")?.span ?? 12, 12);
});

await t("full-only blocks (Check Your Understanding / page break) offer no side-by-side controls", async () => {
  await mount("/admin/learn-content/p1", { blocks: [...blocks(), mkb("b6", 5, "check_understanding", {}), mkb("b7", 6, "page_break", { label: "" })] });
  await focus(card("b6"));
  assert.ok(!btn("Beside next") && !btn("Wider"));
  assert.match(norm($('[data-testid="settings-panel"]').textContent), /always full width/);
  assert.ok(btn("Move up"));
});

await t("undo/redo: Ctrl+Z / Ctrl+Y and the buttons restore layout AND order; content edits made in between survive", async () => {
  await mount();
  await focus(card("b2")); await click(btn("Beside next"));
  await keydown(card("b2"), { key: "ArrowRight", altKey: true, shiftKey: true });
  assert.equal(spanOf("b2"), 6);
  const snapshot = () => JSON.stringify([$$("[data-block-id]").map((e) => [e.dataset.blockId, e.dataset.span]), order()]);
  const after = snapshot();
  const ctrl = async (key, shift = false) => { document.body.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey: true, shiftKey: shift, bubbles: true, cancelable: true })); await wait(40); };
  await ctrl("z");
  assert.equal(spanOf("b2"), 5, "first undo reverts only the last operation (the widen)");
  assert.equal($$('[data-row-size="2"]').length, 1, "...the beside placement stays");
  await ctrl("z");
  assert.equal($$('[data-row-size="2"]').length, 0, "second undo dissolves the row");
  assert.deepEqual(order(), ["b1", "b2", "b3", "b4", "b5"]);
  await ctrl("y"); await ctrl("Z", true);
  assert.equal(snapshot(), after, "redo twice (Ctrl+Y, Ctrl+Shift+Z) reaches the same state");
  await click(btn("Undo")); await click(btn("Redo"));
  assert.equal(snapshot(), after);
  await wait(FLUSH);
  assert.deepEqual(dbBlocks().map((b) => b.id), order(), "database order matches the screen");
  assert.equal(dbLayout("b2")?.span, 6, "layout persisted after undo/redo");
  assert.equal(dbLayout("b2").row, dbLayout("b3").row);
});

await t("undo does not fire while typing in a field (the field keeps its own undo)", async () => {
  await mount();
  await focus(card("b1")); await keydown(card("b1"), { key: "ArrowDown", altKey: true });
  const input = $('input[aria-label="Search blocks"]'); input.focus();
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })); await wait(30);
  assert.deepEqual(order(), ["b2", "b1", "b3", "b4", "b5"]);
});

await t("add: palette click appends after the selected block; layout preset creates 2 blocks beside each other; ONE undo removes both", async () => {
  await mount();
  await focus(card("b2"));
  await click(btn("Key Idea"));
  await until(() => $$("[data-block-card]").length === 6);
  assert.deepEqual(order().slice(0, 4), ["b1", "b2", order()[2], "b3"], "new block lands right after the selected block's row");
  assert.match(live(), /added/);
  await click(btn("Image + text"));
  await until(() => $$("[data-block-card]").length === 8);
  assert.equal($$('[data-row-size="2"]').length, 1);
  const row = $$('[data-row-size="2"] [data-block-id]');
  assert.deepEqual(row.map((e) => Number(e.dataset.span)), [5, 7]);
  assert.deepEqual($$('[data-row-size="2"] [data-block-card]').map((e) => e.getAttribute("aria-label").split(":")[0].split(".")[0]), ["Image", "Rich Text"]);
  await wait(FLUSH);
  assert.equal(dbBlocks().length, 8);
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })); await until(() => $$("[data-block-card]").length === 6, 3000);
  assert.equal($$("[data-block-card]").length, 6, "one undo removes both preset blocks");
  assert.equal(dbBlocks().length, 6);
  assert.deepEqual(dbBlocks().map((b) => b.id), order());
});

await t("add: Check Your Understanding can only be added once", async () => {
  await mount("/admin/learn-content/p1", { blocks: [...blocks(), mkb("b6", 5, "check_understanding", {})] });
  await click(btn("Check Your Understanding"));
  await wait(30);
  assert.match(document.body.textContent, /already has a Check Your Understanding block/);
  assert.equal($$("[data-block-card]").length, 6);
});

await t("duplicate keeps content and lands after the original (full width, no layout); delete removes it and the neighbour absorbs the space; undo restores", async () => {
  await mount();
  await focus(card("b2")); await click(btn("Beside next"));
  await focus(card("b2")); await click(btn("Duplicate"));
  await until(() => $$("[data-block-card]").length === 6);
  const dup = order().find((id) => !["b1", "b2", "b3", "b4", "b5"].includes(id));
  assert.equal(order().indexOf(dup), order().indexOf("b3") + 1, "duplicate sits after the original's whole row");
  assert.equal($(`[data-block-id="${dup}"]`).closest("[data-row]").dataset.rowSize, "1");
  await wait(FLUSH);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === dup).content.caption, "Cap");
  assert.equal(fake.db.learn_blocks.find((b) => b.id === dup).content.layout, undefined);
  await focus(card("b2")); await click(btn("Delete"));
  await until(() => !card("b2"));
  assert.equal(spanOf("b3"), 12, "lone survivor of the row is full width again");
  await wait(FLUSH);
  assert.ok(!fake.db.learn_blocks.some((b) => b.id === "b2"));
  assert.equal(dbLayout("b3"), undefined);
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }));
  await until(() => $$("[data-block-card]").length === 6, 3000);
  assert.equal($$("[data-block-card]").length, 6);
  assert.ok(dbBlocks().some((b) => b.block_type === "image" && b.content.url === "https://x/y.png"), "deleted image came back with its content");
});

await t("hide/show toggles visibility in the database and announces it", async () => {
  await mount();
  await click(btn("Hide Key Idea"));
  await wait(30);
  assert.equal(fake.db.learn_blocks.find((b) => b.id === "b4").visible, false);
  assert.match(live(), /hidden from students/);
});

await t("outline: lists blocks, up/down buttons reorder, search filters outline and dims the canvas, collapse/expand all", async () => {
  await mount();
  assert.equal($$("[data-outline-item]").length, 5);
  await click(btn("Move Key Idea up"));
  assert.deepEqual(order(), ["b1", "b2", "b4", "b3", "b5"]);
  const input = $('input[aria-label="Search blocks"]');
  const proto = dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, "ideal gas"); input.dispatchEvent(new Event("input", { bubbles: true })); await wait(20);
  assert.deepEqual($$("[data-outline-item]").map((e) => e.dataset.outlineItem), ["b5"]);
  assert.ok(card("b1").className.includes("opacity-30"), "non-matching blocks are dimmed");
  Object.getOwnPropertyDescriptor(proto, "value").set.call(input, ""); input.dispatchEvent(new Event("input", { bubbles: true })); await wait(20);
  await click(btn("Collapse all"));
  assert.equal($$('[aria-expanded="false"]').length, 5);
  await click(btn("Expand all"));
  assert.equal($$('[aria-expanded="false"]').length, 0);
});

await t("edit content panel: opens, edits block content through the existing editors, keeps the layout", async () => {
  await mount();
  await focus(card("b2")); await click(btn("Beside next"));
  await click(btn("Edit Image content"));
  assert.ok($('[data-testid="content-panel"]'));
  const caption = $$('[data-testid="content-panel"] input').find((i) => i.value === "Cap");
  assert.ok(caption, "existing Image editor field is rendered");
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(caption, "New caption"); caption.dispatchEvent(new Event("input", { bubbles: true })); await wait(40);
  const row = fake.db.learn_blocks.find((b) => b.id === "b2");
  assert.equal(row.content.caption, "New caption");
  assert.equal(row.content.layout.span, 5, "layout survived a content edit");
  await click(btn("Close"));
  assert.ok(!$('[data-testid="content-panel"]'));
});

await t("preview mode renders through the student renderer (row markup) and the device buttons switch width", async () => {
  await mount();
  await focus(card("b2")); await click(btn("Beside next"));
  await click($$('[role="group"][aria-label="Mode"] button').find((b) => norm(b.textContent) === "Preview"));
  assert.ok($('[data-testid="layout-preview"]'));
  assert.equal($$('[data-testid="layout-preview"] .lb-row .lb-cell').length, 2);
  await click($$('[aria-labelledby="page-width-label"] button').find((b) => norm(b.textContent) === "Phone"));
  assert.equal($('[data-testid="layout-preview"]').dataset.device, "phone");
  assert.equal($('[data-testid="layout-preview"] > div:last-child').style.maxWidth, "390px");
  await click($$('[aria-labelledby="page-width-label"] button').find((b) => norm(b.textContent) === "Tablet"));
  assert.equal($('[data-testid="layout-preview"] > div:last-child').style.maxWidth, "768px");
  await click($$('[role="group"][aria-label="Mode"] button').find((b) => norm(b.textContent) === "Edit layout"));
  assert.ok($('[data-testid="layout-canvas"]'));
});

await t("a legacy lesson (no layout) previews with the legacy container", async () => {
  await mount();
  await click($$('[role="group"][aria-label="Mode"] button').find((b) => norm(b.textContent) === "Preview"));
  assert.ok($('[data-testid="layout-preview"] div.mt-6.space-y-5'));
  assert.equal($$(".lb-root").length, 0);
});

await t("pointer-event drag: dropping on the right edge of a block places it beside; Escape cancels; moving over itself does nothing", async () => {
  await mount();
  const target = card("b3");
  dom.window.document.elementsFromPoint = () => [target];
  target.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200, x: 100, y: 100 });
  const grip = $('[aria-label^="Drag Image"]', card("b2"));
  const pe = (type, x, y, extra = {}) => new dom.window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "mouse", button: 0, ...extra });
  grip.dispatchEvent(pe("pointerdown", 10, 10)); await wait(10);
  dom.window.dispatchEvent(pe("pointermove", 40, 40)); await wait(10);
  dom.window.dispatchEvent(pe("pointermove", 290, 150)); await wait(20);
  assert.equal($("[data-drop-indicator]", target)?.dataset.dropIndicator, "right");
  dom.window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await wait(20);
  assert.ok(!$("[data-drop-indicator]"), "Escape cancels the drag");
  assert.equal($$('[data-row-size="2"]').length, 0);
  grip.dispatchEvent(pe("pointerdown", 10, 10)); await wait(10);
  dom.window.dispatchEvent(pe("pointermove", 40, 40)); dom.window.dispatchEvent(pe("pointermove", 290, 150)); await wait(10);
  dom.window.dispatchEvent(pe("pointerup", 290, 150)); await wait(30);
  assert.equal($$('[data-row-size="2"] [data-block-id]').map((e) => e.dataset.blockId).join(), "b3,b2", "dropped on the right edge => beside, image on the right");
  assert.match(live(), /moved/);
  // a press without movement is not a drag
  grip.dispatchEvent(pe("pointerdown", 10, 10)); dom.window.dispatchEvent(pe("pointerup", 10, 10)); await wait(20);
  assert.equal($$('[data-row-size="2"]').length, 1);
  await wait(FLUSH);
  assert.equal(dbLayout("b2").row, dbLayout("b3").row);
});

await t("pointer-event drag from the palette creates a block at the drop position (top half => before)", async () => {
  await mount();
  const target = card("b4");
  dom.window.document.elementsFromPoint = () => [target];
  target.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200, x: 100, y: 100 });
  const item = btn("Key Idea", $('section[aria-label="Add a block"]'));
  const pe = (type, x, y) => new dom.window.PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "touch", button: 0 });
  item.dispatchEvent(pe("pointerdown", 10, 10)); dom.window.dispatchEvent(pe("pointermove", 40, 40)); dom.window.dispatchEvent(pe("pointermove", 200, 110)); await wait(10);
  dom.window.dispatchEvent(pe("pointerup", 200, 110));
  await until(() => $$("[data-block-card]").length === 6, 3000);
  const o = order(); const added = o.find((id) => !["b1", "b2", "b3", "b4", "b5"].includes(id));
  assert.equal(o.indexOf(added), o.indexOf("b4") - 1, "dropped above b4");
  await wait(FLUSH);
  assert.deepEqual(dbBlocks().map((b) => b.id), o);
});

await t("classic list fallback (?editor=classic) still renders the old editor with working Edit / Duplicate / Delete", async () => {
  await mount("/admin/learn-content/p1?editor=classic");
  assert.equal($('[data-testid="block-workspace"]'), null);
  assert.ok(btn("Add Block"));
  const edits = $$("button").filter((b) => norm(b.textContent) === "Edit");
  assert.equal(edits.length, 5);
  await click(edits[1]);
  assert.ok($$("input").some((i) => i.value === "Cap"), "classic inline editor opens");
  await click($$('button[title="Delete"]')[4]);
  await wait(40);
  assert.equal(fake.db.learn_blocks.filter((b) => b.page_id === "p1").length, 4);
});

await t("existing layout data loads and renders: rows, spans, offsets", async () => {
  const withLayout = BL.setPosition(BL.setSpan(BL.placeBeside(blocks(), "b2", "b3", "left"), "b4", 6), "b4", "right");
  await mount("/admin/learn-content/p1", { blocks: withLayout.map((b, i) => ({ ...b, position: i })) });
  assert.equal($$('[data-row-size="2"]').length, 1);
  assert.equal(spanOf("b2"), 5); assert.equal(spanOf("b4"), 6);
  assert.equal($(`[data-block-id="b4"]`).style.getPropertyValue("--lb-start"), "7");
  await wait(FLUSH);
  assert.equal(fake.log.filter((l) => l.table === "learn_blocks").length, 0, "opening a laid-out lesson writes nothing either");
});

await t("malformed stored layout never breaks the editor", async () => {
  const bad = blocks().map((b, i) => ({ ...b, content: { ...b.content, layout: [null, "x", { span: 99, row: "r" }, { span: -1, row: "r" }, 7][i] } }));
  await mount("/admin/learn-content/p1", { blocks: bad });
  assert.equal($$("[data-block-card]").length, 5);
  assert.deepEqual(errors, []);
  await focus(card("b3")); await click(btn("Wider")); await click(btn("Move up"));
  assert.equal($$("[data-block-card]").length, 5);
});

console.log(`\n${n} learn editor jsdom tests passed${process.exitCode ? " (WITH FAILURES)" : ""}`);
