#!/usr/bin/env node
// Renderer tests for the flexible lesson layout:  node scripts/test-learn-layout-render.mjs
//  1. LEGACY IDENTITY: a lesson whose blocks carry no content.layout renders to exactly the markup the
//     ORIGINAL renderer + the original `<div class="mt-6 space-y-5">` produced (frozen in
//     scripts/fixtures/learn-legacy-snapshot.json, generated from the code BEFORE this feature existed).
//  2. Blocks with a layout render as 12-column rows with the expected spans / offsets / order attributes.
// Honest limit: jsdom/static markup has no CSS engine -- the responsive collapse itself is verified in
// Chromium by scripts/verify-flexible-editor.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); }
}
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);
const origWarn = console.warn; console.warn = (...a) => { if (!/Three\.js/.test(a.join(" "))) origWarn(...a); };

const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");
const { MemoryRouter } = await import("react-router-dom");
const LearnBlockRenderer = (await import("../src/components/learn/LearnBlockRenderer.jsx")).default;
const LearnBlocksLayout = (await import("../src/components/learn/LearnBlocksLayout.jsx")).default;
const L = await import("../src/lib/blockLayout.js");
const { splitLearnBlocksIntoPages } = await import("../src/lib/learnPagination.js");
const { filterBlocksForStudent } = await import("../src/lib/learnLevelAccess.js");
const { LEGACY_BLOCKS } = await import("./fixtures/learn-legacy-lesson.mjs");
const snapshot = JSON.parse(fs.readFileSync(new URL("./fixtures/learn-legacy-snapshot.json", import.meta.url), "utf8"));
const h = React.createElement;
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("  ok  ", name); };
const render = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
const renderBlock = (block, { inCell }) => h(LearnBlockRenderer, { key: block.id, block, inCell });
const noBreaks = LEGACY_BLOCKS.filter((b) => b.block_type !== "page_break");

console.log("learn layout rendering");

t("legacy identity: every existing block renders exactly as before", () => {
  for (const b of noBreaks) assert.equal(render(h(LearnBlockRenderer, { block: b })), snapshot.blocks[b.id], `${b.block_type} ${b.id}`);
});
t("legacy identity: the whole lesson container is byte-identical to the original markup", () => {
  assert.equal(render(h(LearnBlocksLayout, { blocks: noBreaks, renderBlock })), snapshot.container);
});
t("legacy identity survives the real pipeline (HL filter, hidden blocks, pagination)", () => {
  const visible = LEGACY_BLOCKS.filter((b) => b.visible);
  const pages = splitLearnBlocksIntoPages(filterBlocksForStudent(visible, "SL"));
  assert.equal(pages.length, 2);
  const html = render(h(LearnBlocksLayout, { blocks: pages[0].blocks, renderBlock }));
  assert.ok(html.startsWith('<div class="mt-6 space-y-5">') && !html.includes("lb-root") && !html.includes("lb-row"));
  const second = render(h(LearnBlocksLayout, { blocks: pages[1].blocks, renderBlock }));
  assert.ok(second.startsWith('<div class="mt-6 space-y-5">'));
});
t("layout data that normalises to nothing still renders the legacy DOM", () => {
  const junk = noBreaks.map((b, i) => (i % 2 ? { ...b, content: { ...(b.content || {}), layout: { span: 12 } } } : { ...b, content: { ...(b.content || {}), layout: "garbage" } }));
  assert.equal(render(h(LearnBlocksLayout, { blocks: junk, renderBlock })), snapshot.container);
  assert.ok(render(h(LearnBlocksLayout, { blocks: junk, renderBlock })).startsWith('<div class="mt-6 space-y-5">'));
});

const mk = (id, type, content = {}) => ({ id, block_type: type, content: { audience: "both", ...content }, visible: true });
t("laid-out lesson: rows, spans, offsets and cell attributes", () => {
  let bs = [mk("t", "rich_text", { html: "<p>intro</p>" }), mk("i", "image", { url: "x.png", alt: "pic", caption: "C" }), mk("p", "rich_text", { html: "<p>beside</p>" }), mk("k", "key_idea", { text: "KI" }), mk("e", "equation", { markup: "H_2O" })];
  bs = L.placeBeside(bs, "i", "p", "left");
  bs = L.setSpan(bs, "k", 6); bs = L.setPosition(bs, "k", "center");
  bs = L.setMobile(bs, "p", "first"); bs = L.setAlign(bs, "p", "center");
  const html = render(h(LearnBlocksLayout, { blocks: bs, renderBlock }));
  const doc = new dom.window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.querySelector(".lb-root"); assert.ok(root, "lb-root present");
  const kids = [...root.children];
  assert.deepEqual(kids.map((k) => k.className), ["space-y-5", "lb-row", "lb-row", "space-y-5"]);
  const row = kids[1]; const cells = [...row.querySelectorAll(":scope > .lb-cell")];
  assert.deepEqual(cells.map((c) => c.dataset.blockId), ["i", "p"]);
  const sv = (el, k) => el.style.getPropertyValue(k);
  assert.deepEqual(cells.map((c) => sv(c, "--lb-span")), ["5", "7"]);
  assert.equal(cells[1].dataset.mobile, "first"); assert.equal(cells[1].dataset.align, "center");
  const solo = kids[2].querySelector(".lb-cell"); assert.equal(sv(solo, "--lb-span"), "6"); assert.equal(sv(solo, "--lb-start"), "4");
  assert.ok(cells[0].querySelector("figure.w-full img"), "image fills its cell");
  assert.equal(cells[0].querySelector("figcaption").textContent, "C");
  assert.equal(kids[0].querySelectorAll("section").length, 1);
});
t("a row whose members are hidden/filtered renders the remaining member alone", () => {
  let bs = [mk("a", "rich_text", { html: "<p>a</p>" }), mk("b", "rich_text", { html: "<p>b</p>" }), mk("c", "rich_text", { html: "<p>c</p>" })];
  bs = L.placeBeside(bs, "a", "b", "left");
  const some = bs.filter((b) => b.id !== "b");
  const html = render(h(LearnBlocksLayout, { blocks: some, renderBlock }));
  const doc = new dom.window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  assert.equal(doc.querySelectorAll(".lb-cell").length, 1);
});
t("check_understanding / page_break are never placed in a cell", () => {
  const bs = [mk("a", "rich_text", { html: "<p>a</p>", layout: { span: 6, row: "q" } }), mk("c", "check_understanding", { layout: { span: 6, row: "q" } })];
  const rows = L.buildRows(bs);
  assert.ok(rows.every((r) => r.cells.length === 1));
});

console.log(`\n${n} learn layout render tests passed`);
