#!/usr/bin/env node
// jsdom unit tests for the pure Range/offset formatting operations in
// src/lib/richTextOps.js and the snapshot history in src/lib/editHistory.js.
// jsdom has no execCommand, which is exactly why these ops are plain DOM
// functions. Real-browser behaviour (mouse selection, toolbar focus) is
// covered separately by scripts/verify-rich-text-editor.mjs (Chromium).
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
globalThis.document = dom.window.document;
const ops = await import("../src/lib/richTextOps.js");
const { createHistory } = await import("../src/lib/editHistory.js");

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.stack || e.message}`); failed++; }
}
function mount(html) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}
/** offsets of the first occurrence of `text` in the root's text */
function sel(root, text, nth = 0) {
  const all = root.textContent;
  let i = -1;
  for (let k = 0; k <= nth; k++) i = all.indexOf(text, i + 1);
  assert.ok(i >= 0, `"${text}" not found in "${all}"`);
  return { start: i, end: i + text.length };
}
const selected = (root, o) => ops.rangeFromOffsets(root, o).toString();
const P = "<p>The quick brown fox jumps over the lazy dog</p>";

test("offsets round-trip through rangeFromOffsets/getOffsets", () => {
  const root = mount("<p>Hello <b>big</b> world</p><p>Second</p>");
  const o = { start: 3, end: 14 };
  const r = ops.rangeFromOffsets(root, o);
  assert.equal(r.toString(), "lo big worl");
  assert.deepEqual(ops.getOffsets(root, r), o);
});

test("selection ending at the start of the next paragraph stays in the first paragraph", () => {
  const root = mount("<p>One</p><p>Two</p>");
  const r = document.createRange();
  r.setStart(root.firstChild.firstChild, 0);
  r.setEnd(root.lastChild.firstChild, 0); // what triple-click produces
  const o = ops.getOffsets(root, r);
  ops.setAlign(root, o, "center");
  assert.equal(root.innerHTML, '<p style="text-align: center;">One</p><p>Two</p>');
});

test("font size applies to ONLY the selected words (middle of a paragraph)", () => {
  const root = mount(P);
  const o = sel(root, "brown fox");
  ops.applyInlineStyle(root, o, "fontSize", "24px");
  assert.equal(root.innerHTML, '<p>The quick <span style="font-size: 24px;">brown fox</span> jumps over the lazy dog</p>');
  assert.equal(root.textContent, "The quick brown fox jumps over the lazy dog");
});

test("changing font size again replaces rather than nests", () => {
  const root = mount(P);
  ops.applyInlineStyle(root, sel(root, "brown fox"), "fontSize", "24px");
  ops.applyInlineStyle(root, sel(root, "brown fox"), "fontSize", "14px");
  assert.equal(root.innerHTML, '<p>The quick <span style="font-size: 14px;">brown fox</span> jumps over the lazy dog</p>');
});

test("partial re-size of an already sized span splits it", () => {
  const root = mount(P);
  ops.applyInlineStyle(root, sel(root, "brown fox"), "fontSize", "24px");
  ops.applyInlineStyle(root, sel(root, "fox"), "fontSize", "12px");
  assert.equal(root.innerHTML, '<p>The quick <span style="font-size: 24px;">brown </span><span style="font-size: 12px;">fox</span> jumps over the lazy dog</p>');
});

test("mixed formatting inside one paragraph keeps each run separate", () => {
  const root = mount(P);
  ops.toggleInline(root, sel(root, "quick"), "b");
  ops.applyInlineStyle(root, sel(root, "jumps"), "color", "#ff0000");
  ops.toggleInline(root, sel(root, "lazy dog"), "i");
  ops.applyInlineStyle(root, sel(root, "quick brown"), "fontSize", "20px");
  const html = root.innerHTML;
  assert.match(html, /<span style="font-size: 20px;"><b>quick<\/b> brown<\/span>|<b><span style="font-size: 20px;">quick<\/span><\/b><span style="font-size: 20px;"> brown<\/span>/);
  assert.match(html, /<i>lazy dog<\/i>/);
  assert.match(html, /color: rgb\(255, 0, 0\)/);
  assert.equal(root.textContent, "The quick brown fox jumps over the lazy dog");
});

test("bold toggles off when everything selected is already bold", () => {
  const root = mount(P);
  ops.toggleInline(root, sel(root, "quick brown"), "b");
  assert.match(root.innerHTML, /<b>quick brown<\/b>/);
  ops.toggleInline(root, sel(root, "quick brown"), "b");
  assert.equal(root.innerHTML, P);
});

test("bold extends when selection is partly bold", () => {
  const root = mount(P);
  ops.toggleInline(root, sel(root, "quick"), "b");
  ops.toggleInline(root, sel(root, "quick brown"), "b");
  assert.match(root.innerHTML, /<b>quick brown<\/b>/);
});

test("un-bolding the middle of a bold run splits the <b>", () => {
  const root = mount(P);
  ops.toggleInline(root, sel(root, "quick brown fox"), "b");
  ops.toggleInline(root, sel(root, "brown"), "b");
  assert.equal(root.innerHTML, "<p>The <b>quick </b>brown<b> fox</b> jumps over the lazy dog</p>");
});

test("underline, strikethrough, super/subscript (sub and sup exclude each other)", () => {
  const root = mount(P);
  ops.toggleInline(root, sel(root, "The"), "u");
  ops.toggleInline(root, sel(root, "quick"), "s");
  ops.toggleInline(root, sel(root, "fox"), "sup");
  ops.toggleInline(root, sel(root, "fox"), "sub");
  assert.match(root.innerHTML, /<u>The<\/u>/);
  assert.match(root.innerHTML, /<s>quick<\/s>/);
  assert.match(root.innerHTML, /<sub>fox<\/sub>/);
  assert.doesNotMatch(root.innerHTML, /<sup>/);
});

test("highlight and remove highlight", () => {
  const root = mount(P);
  ops.applyInlineStyle(root, sel(root, "brown"), "backgroundColor", "#fef08a");
  assert.match(root.innerHTML, /background-color: rgb\(254, 240, 138\)/);
  ops.applyInlineStyle(root, sel(root, "brown"), "backgroundColor", null);
  assert.equal(root.innerHTML, P);
});

test("font family with quoted multi-word names survives", () => {
  const root = mount(P);
  ops.applyInlineStyle(root, sel(root, "fox"), "fontFamily", "Georgia, 'Times New Roman', serif");
  assert.match(root.innerHTML, /<span style="font-family: Georgia, &quot;Times New Roman&quot;, serif;">fox<\/span>|<span style="font-family: Georgia, 'Times New Roman', serif;">fox<\/span>/);
});

test("selection across two paragraphs formats text inside each <p>, never wraps a <p>", () => {
  const root = mount("<p>First paragraph here</p><p>Second paragraph there</p><p>Third untouched</p>");
  const o = { start: root.textContent.indexOf("paragraph here"), end: root.textContent.indexOf("paragraph there") + 9 };
  ops.applyInlineStyle(root, o, "fontSize", "28px");
  assert.equal(root.innerHTML, '<p>First <span style="font-size: 28px;">paragraph here</span></p><p><span style="font-size: 28px;">Second paragraph</span> there</p><p>Third untouched</p>');
  assert.equal(root.querySelectorAll("span > p").length, 0);
});

test("selection spanning several inline nodes in one paragraph", () => {
  const root = mount("<p>aa <b>bb</b> <i>cc</i> dd</p>");
  ops.applyInlineStyle(root, sel(root, "a bb cc d"), "color", "#00ff00");
  assert.equal(root.textContent, "aa bb cc dd");
  const colored = Array.from(root.querySelectorAll("span")).map((s) => s.textContent).join("|");
  assert.equal(colored.replace(/\|/g, ""), "a bb cc d");
  assert.match(root.innerHTML, /<b><span[^>]*>bb<\/span><\/b>|<span[^>]*><b>bb<\/b>/);
});

test("collapsed caret formatting inserts a ZWSP holder and serialises clean", () => {
  const root = mount("<p>abc</p>");
  const out = ops.toggleInline(root, { start: 3, end: 3 }, "b");
  assert.deepEqual(out, { start: 4, end: 4 });
  assert.match(root.innerHTML, /<b>​<\/b>/);
  assert.equal(ops.serializeEditorHtml(root), "<p>abc</p>");
});

test("clear formatting removes inline formatting only for the selection and keeps links", () => {
  const root = mount('<p>aa <b><i><span style="color: red;">bold ital red</span></i></b> <a href="https://x.org">link</a></p>');
  ops.clearInlineFormatting(root, sel(root, "ital"));
  assert.equal(root.innerHTML, '<p>aa <b><i><span style="color: red;">bold </span></i></b>ital<b><i><span style="color: red;"> red</span></i></b> <a href="https://x.org">link</a></p>');
  ops.clearInlineFormatting(root, { start: 0, end: root.textContent.length });
  assert.equal(root.innerHTML, '<p>aa bold ital red <a href="https://x.org">link</a></p>');
});

test("heading levels apply to the selected blocks only", () => {
  const root = mount("<p>One</p><p>Two</p><p>Three</p>");
  ops.setBlockTag(root, { start: 4, end: 6 }, "h2");
  assert.equal(root.innerHTML, "<p>One</p><h2>Two</h2><p>Three</p>");
  ops.setBlockTag(root, { start: 0, end: 13 }, "h1");
  assert.equal(root.innerHTML, "<h1>One</h1><h1>Two</h1><h1>Three</h1>");
  ops.setBlockTag(root, { start: 4, end: 4 }, "p");
  assert.equal(root.innerHTML, "<h1>One</h1><p>Two</p><h1>Three</h1>");
});

test("heading keeps inline formatting and alignment", () => {
  const root = mount('<p style="text-align: center;">Hi <b>there</b></p>');
  ops.setBlockTag(root, { start: 0, end: 2 }, "h3");
  assert.equal(root.innerHTML, '<h3 style="text-align: center;">Hi <b>there</b></h3>');
});

test("alignment left/center/right/justify per block", () => {
  const root = mount("<p>A</p><p>B</p>");
  for (const a of ["center", "right", "justify", "left"]) {
    ops.setAlign(root, { start: 1, end: 2 }, a);
    assert.equal(root.children[1].style.textAlign, a);
    assert.equal(root.children[0].style.textAlign, "");
  }
});

test("bullets, numbered, switching and un-listing", () => {
  const root = mount("<p>One</p><p>Two</p><p>Three</p>");
  ops.toggleList(root, { start: 0, end: 6 }, "ul");
  assert.equal(root.innerHTML, "<ul><li>One</li><li>Two</li></ul><p>Three</p>");
  ops.toggleList(root, { start: 3, end: 6 }, "ol");
  assert.equal(root.innerHTML, "<ul><li>One</li></ul><ol><li>Two</li></ol><p>Three</p>");
  ops.toggleList(root, { start: 3, end: 6 }, "ol");
  assert.equal(root.innerHTML, "<ul><li>One</li></ul><p>Two</p><p>Three</p>");
  ops.toggleList(root, { start: 3, end: 11 }, "ul");
  assert.equal(root.innerHTML, "<ul><li>One</li><li>Two</li><li>Three</li></ul>");
});

test("indent / outdent for paragraphs and nested list items", () => {
  const root = mount("<p>Para</p>");
  ops.indentBlocks(root, { start: 0, end: 2 }, 1);
  ops.indentBlocks(root, { start: 0, end: 2 }, 1);
  assert.equal(root.innerHTML, '<p style="margin-left: 48px;">Para</p>');
  ops.indentBlocks(root, { start: 0, end: 2 }, -1);
  ops.indentBlocks(root, { start: 0, end: 2 }, -1);
  ops.indentBlocks(root, { start: 0, end: 2 }, -1);
  assert.equal(root.innerHTML, "<p>Para</p>");
  const list = mount("<ul><li>a</li><li>b</li><li>c</li></ul>");
  ops.indentBlocks(list, { start: 1, end: 2 }, 1);
  assert.equal(list.innerHTML, "<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>");
  ops.indentBlocks(list, { start: 1, end: 2 }, -1);
  assert.equal(list.innerHTML, "<ul><li>a</li><li>b</li><li>c</li></ul>");
});

test("loose top-level text is wrapped into a paragraph before formatting", () => {
  const root = mount("plain text only");
  ops.applyInlineStyle(root, sel(root, "text"), "color", "#00f");
  assert.match(root.innerHTML, /^<p>plain <span style="color: rgb\(0, 0, 255\);">text<\/span> only<\/p>$/);
});

test("math markers and sub/sup survive formatting around them", () => {
  const root = mount("<p>H<sub>2</sub>O and ⟦math:x^2⟧ end</p>");
  ops.applyInlineStyle(root, sel(root, "and"), "fontSize", "18px");
  assert.equal(root.textContent, "H2O and ⟦math:x^2⟧ end");
  assert.match(root.innerHTML, /<sub>2<\/sub>/);
});

test("link wraps only the selection and rejects javascript: URLs", () => {
  const root = mount(P);
  ops.applyLink(root, sel(root, "fox"), "javascript:alert(1)");
  assert.equal(root.innerHTML, P);
  ops.applyLink(root, sel(root, "fox"), "https://example.org");
  assert.match(root.innerHTML, /<a href="https:\/\/example.org">fox<\/a>/);
});

test("queryState reports inline/block/list/alignment at the selection", () => {
  const root = mount('<h2 style="text-align: right;"><b>Head</b> x</h2><ul><li>item</li></ul>');
  const s1 = ops.queryState(root, { start: 1, end: 3 });
  assert.equal(s1.b, true); assert.equal(s1.i, false); assert.equal(s1.block, "h2"); assert.equal(s1.align, "right");
  const s2 = ops.queryState(root, { start: 7, end: 7 });
  assert.equal(s2.list, "ul");
});

test("history: snapshots, undo/redo, truncation of redo branch, coalesced identical html", () => {
  const h = createHistory({ html: "a", sel: null });
  assert.equal(h.record({ html: "a", sel: { start: 1, end: 1 } }), false);
  h.record({ html: "ab", sel: null }); h.record({ html: "abc", sel: null });
  assert.equal(h.undo().html, "ab");
  assert.equal(h.undo().html, "a");
  assert.equal(h.canUndo(), false);
  assert.equal(h.redo().html, "ab");
  h.record({ html: "abX", sel: null });
  assert.equal(h.canRedo(), false);
  assert.equal(h.undo().html, "ab");
  const small = createHistory({ html: "0" }, 3);
  for (let i = 1; i < 6; i++) small.record({ html: String(i) });
  assert.equal(small.size(), 3);
});

test("undo restores html exactly after a sequence of Range operations", () => {
  const root = mount(P);
  const h = createHistory({ html: root.innerHTML, sel: null });
  ops.applyInlineStyle(root, sel(root, "quick"), "fontSize", "30px"); h.record({ html: root.innerHTML });
  ops.toggleInline(root, sel(root, "fox"), "b"); h.record({ html: root.innerHTML });
  root.innerHTML = h.undo().html; assert.doesNotMatch(root.innerHTML, /<b>/);
  root.innerHTML = h.undo().html; assert.equal(root.innerHTML, P);
  root.innerHTML = h.redo().html; assert.match(root.innerHTML, /font-size: 30px/);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
