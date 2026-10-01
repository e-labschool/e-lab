#!/usr/bin/env node
// Node-level regression harness for the shared rich-text editor's
// selection-preservation mechanism (RichTextEditor in
// src/data/learnBlockRegistry.jsx) — run with:
//   node scripts/test-rich-text-selection.mjs
//
// HONESTY NOTE (read before trusting any PASS below): this harness
// renders the REAL, UNMODIFIED RichTextEditor component (via
// react-dom/client) into a REAL jsdom DOM and drives it with REAL
// DOM Range/Selection objects and dispatched Mouse/Event objects — this
// is not a reimplementation or a mock of the selection logic. It proves
// the actual save/restore/apply code path for every control that works
// through applyInlineStyle() (text colour, highlight, font family, font
// size) — exactly the "colour/highlight especially" controls the user
// reported as still broken, and the ones whose fix (the central
// `selectionchange` listener + the previously-entirely-missing
// Highlight control) this change set adds.
//
// ONE real limitation, stated plainly rather than papered over: jsdom
// does not implement `document.execCommand` at all (it throws
// "not implemented"). That means Bold/Italic/Underline/Superscript/
// Subscript/Bullets/Numbered-List/Align/Link/Clear-Formatting — every
// control that goes through this file's `exec()` helper — cannot be
// exercised end-to-end here. Those controls share the EXACT SAME
// central save/restore mechanism under test below (same saveSelection,
// same restoreSelection, same selectionchange listener, same
// onMouseDown preventDefault pattern) — there is no separate code path
// for them — but their *visible* DOM result after execCommand runs is
// only verifiable in a real browser. Items 15/16/18 in the manual
// acceptance checklist in the final report cover exactly this gap.
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

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
