#!/usr/bin/env node
// Node-level regression harness for the shared rich-text editor's
// selection-preservation mechanism (RichTextEditor in
// src/data/learnBlockRegistry.jsx) — run with:
//   node scripts/test-rich-text-selection.mjs
//
// HONESTY NOTE (read before trusting any PASS below): this harness renders the
// REAL RichTextEditor component (react-dom/client) into a REAL jsdom DOM and
// drives it with real Range/Selection objects and dispatched events -- no
// reimplementation of the editor logic. After the PART 3 rewrite every
// formatting control (inline AND block level) runs through the pure DOM
// functions in src/lib/richTextOps.js, which jsdom CAN execute (the old
// editor needed document.execCommand, which jsdom lacks), so all controls are
// exercised here. What jsdom still cannot prove: real mouse/keyboard
// selection, native <select>/colour-picker focus behaviour, native undo, and
// layout. Those are covered in headless Chromium by
// scripts/verify-rich-text-editor.mjs. The second half of this file locks in
// the sanitiser/student-render round trip and the draft-versioning rules.
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.Event = dom.window.Event;
globalThis.FocusEvent = dom.window.FocusEvent;
globalThis.localStorage = dom.window.localStorage;
// The editor schedules toolbar-state refreshes with rAF.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

register("./jsx-loader-hooks.mjs", import.meta.url);

const React = (await import("react")).default;
const { createRoot } = await import("react-dom/client");
const { RichTextEditor } = await import("../src/data/learnBlockRegistry.jsx");

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.stack || err.message}`);
    failed++;
  }
}

function tick(ms = 20) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Mounts a fresh RichTextEditor with the given initial HTML and returns
 * { editor, root } — `editor` is the real contentEditable DOM node, the
 * exact one the browser would show an admin. */
const NATIVE_INPUT_VALUE_SETTER = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;

/** Sets a DOM input's value the way a real browser interaction does
 * (through the native property setter), then dispatches input + change.
 * Setting `.value` directly and dispatching a plain Event is NOT
 * equivalent here: React tracks an input's previous value internally to
 * decide whether its own onChange should fire, and a direct `.value =`
 * assignment bypasses that tracker, silently swallowing the synthetic
 * onChange — exactly the kind of test-harness artifact the task's
 * honesty requirement warns against, so it is bypassed explicitly
 * rather than producing a false failure that looks like an app bug. */
function setInputValue(input, value) {
  NATIVE_INPUT_VALUE_SETTER.call(input, value);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

let mountCount = 0;
async function mount(initialHtml) {
  mountCount += 1;
  const container = document.createElement("div");
  container.id = `root-${mountCount}`;
  document.body.appendChild(container);
  const root = createRoot(container);
  let lastChange = null;
  root.render(React.createElement(RichTextEditor, { value: initialHtml, onChange: (html) => { lastChange = html; } }));
  await tick(30);
  const editor = container.querySelector("[contenteditable]");
  return { root, container, editor, getLastChange: () => lastChange };
}

/** Selects the first occurrence of `phrase` inside `editor`'s first text
 * node and fires a real `selectionchange` — exactly what a user
 * dragging/double-clicking to select text produces, and exactly the
 * event the centralized saveSelection() listener in RichTextEditor now
 * relies on (issue 2's "capture at the right moment" requirement). */
function selectPhrase(editor, phrase) {
  const textNode = [...editor.querySelectorAll("*")].reduce((found, el) => found || [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(phrase)), null)
    || [...editor.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes(phrase));
  assert.ok(textNode, `could not find a text node containing "${phrase}"`);
  const start = textNode.textContent.indexOf(phrase);
  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, start + phrase.length);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new window.Event("selectionchange"));
}

/** Clicks a toolbar control the same way a real pointer interaction
 * does: mousedown (where this editor's controls save the selection and,
 * for plain buttons, preventDefault to avoid a focus-steal) then click
 * (where the format command actually runs). */
function clickControl(el) {
  el.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

function findButtonByTitlePrefix(container, prefix) {
  return [...container.querySelectorAll("button[title]")].find((b) => b.title.startsWith(prefix));
}

console.log("\n== Issue 2: rich-text selection preservation (real component, real DOM) ==");

// Test 13
await test('select "nuclear charge" -> highlight -> ONLY that phrase changes, editor keeps focus/valid caret', async () => {
  const { editor } = await mount("<p>effective nuclear charge today</p>");
  selectPhrase(editor, "nuclear charge");
  await tick();
  const swatch = findButtonByTitlePrefix(editor.parentElement, "Highlight:");
  assert.ok(swatch, "a Highlight swatch control must exist (issue 2 requires it; it did not exist before this change)");
  clickControl(swatch);
  await tick();
  assert.equal(editor.textContent, "effective nuclear charge today", "no text content may be lost or duplicated");
  const span = editor.querySelector("span[style*=background-color]");
  assert.ok(span, "a background-colour span must have been inserted");
  assert.equal(span.textContent, "nuclear charge", "the highlight must apply to exactly the selected phrase, not the whole paragraph or an offset range");
  assert.ok(editor.textContent.startsWith("effective ") && editor.textContent.endsWith(" today"), "surrounding text must be untouched");
});

// (color control — same pattern as 13, the other half of "colour/highlight")
await test('select "nuclear charge" -> text colour -> ONLY that phrase changes', async () => {
  const { editor } = await mount("<p>effective nuclear charge today</p>");
  selectPhrase(editor, "nuclear charge");
  await tick();
  const swatch = findButtonByTitlePrefix(editor.parentElement, "Text colour:");
  assert.ok(swatch);
  clickControl(swatch);
  await tick();
  const span = editor.querySelector("span[style*=color]:not([style*=background-color])");
  assert.ok(span, "a colour span must have been inserted");
  assert.equal(span.textContent, "nuclear charge");
});

// Test 19 — selection survives a multi-step custom-colour-picker
// interaction: mousedown (saves selection) while focus is still live,
// THEN the live DOM selection is cleared (simulating a native OS colour
// dialog stealing focus away from the document entirely while open —
// exactly the scenario the prior single-mousedown-save pattern was
// fragile against), THEN the picker's change event fires.
await test("selection survives a colour-picker interaction that clears the live DOM selection before the value is chosen", async () => {
  const { editor } = await mount("<p>effective nuclear charge today</p>");
  selectPhrase(editor, "nuclear charge");
  await tick();
  const customInput = [...editor.parentElement.querySelectorAll('input[type=color]')]
    .find((el) => el.closest("label")?.title === "Custom highlight colour");
  assert.ok(customInput, "a custom highlight colour input must exist");

  customInput.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  // Simulate the native dialog taking over: the document's live
  // selection goes away while the (out-of-DOM) OS picker is open.
  window.getSelection().removeAllRanges();
  await tick();

  setInputValue(customInput, "#ff0000");
  await tick();

  const span = editor.querySelector("span[style*=background-color]");
  assert.ok(span, "the highlight must still apply even though the live selection was cleared mid-interaction");
  assert.equal(span.textContent, "nuclear charge", "it must apply to the originally-selected phrase, not wherever the (now-empty) live selection collapsed to");
});

// Test 20
await test("formatting does not unexpectedly spread to the whole paragraph", async () => {
  const { editor } = await mount("<p>one two three four five</p>");
  selectPhrase(editor, "three");
  await tick();
  const swatch = findButtonByTitlePrefix(editor.parentElement, "Highlight:");
  clickControl(swatch);
  await tick();
  assert.equal(editor.textContent, "one two three four five");
  const span = editor.querySelector("span[style*=background-color]");
  assert.equal(span.textContent, "three");
  assert.ok(editor.innerHTML.includes("one two ") && editor.innerHTML.includes(" four five"), "the rest of the paragraph must stay outside the formatted span");
});

// Test 21
await test("formatting adjacent to inline scientific markup does not corrupt the scientific token", async () => {
  const { editor } = await mount("<p>Compare \\(x \\le y\\) carefully please</p>");
  selectPhrase(editor, "carefully");
  await tick();
  const swatch = findButtonByTitlePrefix(editor.parentElement, "Highlight:");
  clickControl(swatch);
  await tick();
  // The raw stored HTML must still contain the untouched \( x \le y \)
  // source text -- scientificContent.jsx renders it at DISPLAY time from
  // this exact stored string, so it must survive formatting elsewhere
  // in the same paragraph byte-for-byte.
  assert.ok(editor.innerHTML.includes("\\(x \\le y\\)"), "the scientific marker source must be untouched by unrelated formatting");
  const span = editor.querySelector("span[style*=background-color]");
  assert.equal(span.textContent, "carefully");
});

// Collapsed-selection case: clicking a colour control with no text
// selected (just a caret) must not throw and must not corrupt content —
// it applies to a zero-width marker so subsequently typed text inherits
// it, per the component's own documented contract.
await test("a collapsed selection (caret, nothing highlighted) does not throw and does not corrupt existing content", async () => {
  const { editor } = await mount("<p>short text</p>");
  const textNode = editor.querySelector("p").firstChild;
  const range = document.createRange();
  range.setStart(textNode, 5);
  range.collapse(true);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.dispatchEvent(new window.Event("selectionchange"));
  await tick();
  const swatch = findButtonByTitlePrefix(editor.parentElement, "Highlight:");
  assert.doesNotThrow(() => clickControl(swatch));
  await tick();
  // Per this component's own documented contract (see applyInlineStyle's
  // comment in learnBlockRegistry.jsx), a collapsed selection formats a
  // zero-width marker (U+200B) so text typed NEXT inherits the style —
  // it must not duplicate or drop any of the EXISTING visible text.
  assert.equal(editor.textContent.replace(/​/g, ""), "short text", "collapsed-selection formatting must not duplicate or drop any existing visible text");
  assert.ok(editor.querySelector("span[style*=background-color]"), "a zero-width-marker span must exist for the caret position");
});


// ---------------------------------------------------------------------------
// PART 3/5 additions
// ---------------------------------------------------------------------------
await test("font size from the toolbar <select> changes ONLY the selection even when the parent re-renders with the saved html (blur -> commit -> new value prop)", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let value = "<p>The quick brown fox jumps over the lazy dog</p><p>Another paragraph</p>";
  const render = () => root.render(React.createElement(RichTextEditor, { value, onChange: (h) => { value = h; render(); } }));
  render();
  await tick(30);
  const editor = container.querySelector("[contenteditable]");
  selectPhrase(editor, "brown fox");
  const sizeSelect = container.querySelector('select[aria-label="Font size"]');
  sizeSelect.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true }));
  // Simulate the editor losing focus to the select (blur commits + re-renders the parent)...
  editor.dispatchEvent(new window.FocusEvent("blur", { bubbles: false }));
  await tick(30);
  // ...then the change arrives.
  const nativeSet = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
  nativeSet.call(sizeSelect, "24");
  sizeSelect.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick(30);
  assert.equal(editor.innerHTML, '<p>The quick <span style="font-size: 24px;">brown fox</span> jumps over the lazy dog</p><p>Another paragraph</p>');
});

await test("Bold / Italic / Underline / Strikethrough / Sub / Sup buttons format exactly the selection", async () => {
  const { editor, container } = await mount("<p>alpha beta gamma</p>");
  const cases = [["Bold", "b"], ["Italic", "i"], ["Underline", "u"], ["Strikethrough", "s"], ["Superscript", "sup"], ["Subscript", "sub"]];
  for (const [label, tag] of cases) {
    selectPhrase(editor, "beta");
    const btn = container.querySelector(`button[aria-label="${label}"]`);
    clickControl(btn);
    await tick();
    assert.ok(editor.innerHTML.includes(`<${tag}>beta</${tag}>`), `${label} -> <${tag}> around beta only: ${editor.innerHTML}`);
    assert.ok(editor.innerHTML.startsWith("<p>alpha ") && editor.innerHTML.endsWith(" gamma</p>"), `${label}: text outside the selection untouched`);
    clickControl(btn);
    await tick();
    assert.equal(editor.innerHTML, "<p>alpha beta gamma</p>", `${label} toggles back off`);
  }
});

await test("heading, alignment, list and indent controls are block-level (selected paragraph only)", async () => {
  const { editor, container } = await mount("<p>one</p><p>two</p>");
  selectPhrase(editor, "two");
  const sel = container.querySelector('select[aria-label="Paragraph style"]');
  Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, "h2");
  sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  await tick();
  assert.equal(editor.innerHTML, "<p>one</p><h2>two</h2>");
  clickControl(container.querySelector('button[aria-label="Align Center"]')); await tick();
  assert.equal(editor.innerHTML, '<p>one</p><h2 style="text-align: center;">two</h2>');
  selectPhrase(editor, "one");
  clickControl(container.querySelector('button[aria-label="Bullets"]')); await tick();
  assert.ok(editor.innerHTML.startsWith("<ul><li>one</li></ul>"), editor.innerHTML);
  clickControl(container.querySelector('button[aria-label="Clear Formatting"]')); await tick();
  assert.ok(editor.innerHTML.startsWith("<ul><li>one</li></ul>"), "clear formatting is inline only: list structure stays");
});

await test("Undo/Redo toolbar buttons step through formatting history exactly", async () => {
  const { editor, container } = await mount("<p>alpha beta gamma</p>");
  selectPhrase(editor, "alpha"); clickControl(container.querySelector('button[aria-label="Bold"]')); await tick();
  selectPhrase(editor, "gamma"); clickControl(container.querySelector('button[aria-label="Italic"]')); await tick();
  clickControl(container.querySelector('button[aria-label="Undo"]')); await tick();
  assert.equal(editor.innerHTML, "<p><b>alpha</b> beta gamma</p>");
  clickControl(container.querySelector('button[aria-label="Undo"]')); await tick();
  assert.equal(editor.innerHTML, "<p>alpha beta gamma</p>");
  clickControl(container.querySelector('button[aria-label="Redo"]')); await tick();
  clickControl(container.querySelector('button[aria-label="Redo"]')); await tick();
  assert.equal(editor.innerHTML, "<p><b>alpha</b> beta <i>gamma</i></p>");
});

await test("an external value change (not produced by the editor) is adopted, an echo of its own value is not re-written", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(React.createElement(RichTextEditor, { value: "<p>first</p>", onChange: () => {} }));
  await tick(30);
  const editor = container.querySelector("[contenteditable]");
  const marker = editor.firstChild; // node identity must survive a same-value re-render
  root.render(React.createElement(RichTextEditor, { value: "<p>first</p>", onChange: () => {} }));
  await tick(30);
  assert.equal(editor.firstChild, marker, "same value -> DOM nodes untouched");
  root.render(React.createElement(RichTextEditor, { value: "<p>second</p>", onChange: () => {} }));
  await tick(30);
  assert.equal(editor.innerHTML, "<p>second</p>");
});

await test("saved HTML survives the student sanitiser + math pass (headings, font-size span, colour, highlight, align, indent, lists, sub/sup, links)", async () => {
  const { sanitizeHtml } = await import("../src/lib/sanitizeHtml.js");
  const { renderMathMarkersInHtml } = await import("../src/lib/scientificContent.jsx");
  const saved = '<h1>T1</h1><h2 style="text-align: center;">T2</h2><h3>T3</h3><p style="margin-left: 24px; text-align: justify;">a <span style="font-size: 24px; color: rgb(54, 84, 214); background-color: rgb(254, 240, 138); font-family: Georgia, serif;">big</span> <b>b</b><i>i</i><u>u</u><s>s</s> H<sub>2</sub>O x<sup>2</sup> <a href="https://example.org">l</a> ⟦math:x^2⟧</p><ul><li>a<ol><li>n</li></ol></li></ul>';
  const out = sanitizeHtml(renderMathMarkersInHtml(saved));
  for (const needle of ["<h1>T1</h1>", 'text-align: center', "<h3>T3</h3>", "margin-left: 24px", "font-size: 24px", "color: rgb(54, 84, 214)", "background-color: rgb(254, 240, 138)", "font-family: Georgia", "<b>b</b>", "<i>i</i>", "<u>u</u>", "<s>s</s>", "<sub>2</sub>", "<sup>2</sup>", 'href="https://example.org"', "<ul><li>a<ol><li>n</li></ol></li></ul>"]) {
    assert.ok(out.includes(needle), `student HTML lost "${needle}":\n${out}`);
  }
  assert.ok(!out.includes("⟦math:"), "the math marker was rendered, not left raw");
  assert.ok(!/javascript:/i.test(sanitizeHtml('<a href="javascript:alert(1)">x</a>')), "sanitiser still strips javascript: URLs");
});

await test("draft versioning: restore only when the saved version is unchanged; never over newer saved content", async () => {
  const d = await import("../src/lib/draftStore.js");
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  assert.equal(d.hashString("a"), d.hashString("a"));
  assert.notEqual(d.hashString("a"), d.hashString("b"));
  d.saveDraft("L1:B1", { html: "<p>draft</p>", baseHash: d.hashString("<p>saved</p>") }, storage);
  const draft = d.loadDraft("L1:B1", storage);
  assert.equal(d.decideDraft(draft, "<p>saved</p>"), "restore", "server unchanged -> auto restore");
  assert.equal(d.decideDraft(draft, "<p>saved by someone else</p>"), "conflict", "server changed -> never auto-apply");
  assert.equal(d.decideDraft(draft, "<p>draft</p>"), "none", "draft already equals saved -> nothing to restore");
  assert.equal(d.decideDraft(null, "x"), "none");
  d.clearDraft("L1:B1", storage);
  assert.equal(d.loadDraft("L1:B1", storage), null);
  mem.set("e-lab:draft:bad", "{not json");
  assert.equal(d.loadDraft("bad", storage), null, "corrupt draft is ignored");
});

await test("component: unsaved draft is restored (server unchanged), NOT applied when the saved value changed, and does not call onChange by itself", async () => {
  const { saveDraft, hashString } = await import("../src/lib/draftStore.js");
  localStorage.clear();
  saveDraft("P:B:html", { html: "<p>typed draft</p>", baseHash: hashString("<p>saved</p>"), savedAt: 1 });
  let changes = 0;
  let container = document.createElement("div"); document.body.appendChild(container);
  let root = createRoot(container);
  root.render(React.createElement(RichTextEditor, { value: "<p>saved</p>", onChange: () => { changes += 1; }, draftScope: "P:B:html" }));
  await tick(40);
  assert.equal(container.querySelector("[contenteditable]").innerHTML, "<p>typed draft</p>");
  assert.ok(container.querySelector('[data-testid="rte-draft-notice"]')?.textContent.includes("Unsaved draft restored"));
  assert.equal(changes, 0, "restoring must not write to the parent/server");
  root.unmount();
  assert.equal(changes, 0, "unmounting an untouched restored draft must not write either");
  container = document.createElement("div"); document.body.appendChild(container);
  root = createRoot(container);
  root.render(React.createElement(RichTextEditor, { value: "<p>newer saved content</p>", onChange: () => { changes += 1; }, draftScope: "P:B:html" }));
  await tick(40);
  assert.equal(container.querySelector("[contenteditable]").innerHTML, "<p>newer saved content</p>", "newer saved content is kept");
  assert.ok(container.querySelector('[data-testid="rte-draft-notice"]')?.textContent.includes("not applied"));
  localStorage.clear();
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
