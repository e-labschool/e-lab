#!/usr/bin/env node
// Question stem-placement tests:  node scripts/test-question-layout.mjs
//  - pure module (normalise / with / columns), malformed + string-encoded stimulus
//  - LEGACY IDENTITY: student QuestionRenderer, teacher QuestionPreviewModal and PaperPreview render byte-identically to the
//    frozen pre-feature snapshot (scripts/fixtures/question-legacy-snapshot.json) for questions without placement
//  - placement rendering for all three views, options/parts/answer inputs untouched, marking data never read
import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import { register } from "node:module";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
for (const k of ["window", "document", "HTMLElement", "Node", "MouseEvent", "KeyboardEvent", "Event", "XMLSerializer", "MutationObserver", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) { try { globalThis[k] = dom.window[k]; } catch { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true }); } }
register("./jsx-loader-hooks.mjs", import.meta.url);
register("./image-viewer-loader-hooks.mjs", import.meta.url);
console.warn = () => {};
const React = (await import("react")).default;
const { renderToStaticMarkup } = await import("react-dom/server");
const Q = await import("../src/lib/questionLayout.js");
const QR = (await import("../src/pages/student/solve/QuestionRenderer.jsx")).default;
const QPM = (await import("../src/pages/teacher/qbuilder/components/QuestionPreviewModal.jsx")).default;
const PP = (await import("../src/pages/teacher/qbuilder/components/PaperPreview.jsx")).default;
const { LEGACY_QUESTIONS, LEGACY_DRAFT } = await import("./fixtures/question-legacy-fixture.mjs");
const snap = JSON.parse(fs.readFileSync(new URL("./fixtures/question-legacy-snapshot.json", import.meta.url), "utf8"));
const h = React.createElement;
let n = 0; const t = (name, fn) => { fn(); n += 1; console.log("  ok  ", name); };
const parse = (html) => new dom.window.DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
const student = (q) => renderToStaticMarkup(h(QR, { question: q, questionNumber: 1, answer: null, onAnswer() {}, onFocusInput() {} }));
const modal = (q) => renderToStaticMarkup(h(QPM, { question: { ...q, topicCode: "S1.1", level: "SL", paper: "Paper 1A", difficulty: "Easy", correctAnswer: "A", markscheme: "ms" }, onClose() {} }));
const withPlacement = (q, placement) => ({ ...q, stimulus: Q.withStimulusPlacement(q.stimulus, placement) });

console.log("question layout");
t("normalizePlacement: valid, invalid, defaults, never throws", () => {
  for (const bad of [null, undefined, 5, "left", [], {}, { side: "diagonal" }, { side: 3 }, { width: "half" }]) assert.equal(Q.normalizePlacement(bad), null);
  assert.deepEqual(Q.normalizePlacement({ side: "left" }), { side: "left", width: "half" });
  assert.deepEqual(Q.normalizePlacement({ side: "right", width: "full" }), { side: "right", width: "half" }, "full cannot sit beside text");
  assert.deepEqual(Q.normalizePlacement({ side: "right", width: "third", extra: 1 }), { side: "right", width: "third" });
  assert.deepEqual(Q.normalizePlacement({ side: "above", width: "third" }), { side: "above", width: "full" });
  assert.deepEqual(Q.normalizePlacement({ side: "left", width: "bogus" }), { side: "left", width: "half" });
});
t("getStimulusPlacement handles objects, JSON-encoded strings and junk", () => {
  assert.deepEqual(Q.getStimulusPlacement({ type: "image", placement: { side: "left", width: "third" } }), { side: "left", width: "third" });
  assert.deepEqual(Q.getStimulusPlacement(JSON.stringify({ type: "image", placement: { side: "below" } })), { side: "below", width: "full" });
  for (const junk of [null, undefined, "not json", 7, [], { type: "image" }, { placement: "left" }]) assert.equal(Q.getStimulusPlacement(junk), null);
});
t("withStimulusPlacement copies, sets, removes and leaves every other field untouched", () => {
  const s = { type: "image", src: "a.png", alt: "x", caption: "c" };
  const a = Q.withStimulusPlacement(s, { side: "left", width: "third" });
  assert.deepEqual(a, { ...s, placement: { side: "left", width: "third" } }); assert.equal("placement" in s, false);
  const b = Q.withStimulusPlacement(a, null); assert.deepEqual(b, s);
  assert.deepEqual(Q.withStimulusPlacement(a, { side: "nope" }), s);
  assert.equal(Q.withStimulusPlacement(null, { side: "left" }), null);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a, "JSON round trip");
});
t("stemColumns: spans, order, phone order", () => {
  assert.equal(Q.stemColumns(null), null);
  assert.deepEqual(Q.stemColumns({ side: "left", width: "third" }), { stacked: false, mediaFirst: true, mediaSpan: 4, stemSpan: 8, phoneMediaFirst: true });
  assert.deepEqual(Q.stemColumns({ side: "right", width: "twothirds" }), { stacked: false, mediaFirst: false, mediaSpan: 8, stemSpan: 4, phoneMediaFirst: true });
  assert.equal(Q.stemColumns({ side: "below" }).mediaFirst, false);
  for (const w of Object.keys(Q.STEM_WIDTHS)) for (const side of Q.STEM_SIDES) { const c = Q.stemColumns({ side, width: w }); assert.ok(c.mediaSpan + (c.stacked ? 0 : c.stemSpan) <= 12 || c.stacked); }
});

t("LEGACY IDENTITY: student QuestionRenderer is byte-identical for every existing question shape", () => {
  for (const q of LEGACY_QUESTIONS) assert.equal(student(q), snap.student[q.id], q.id);
});
t("LEGACY IDENTITY: teacher preview modal is byte-identical", () => {
  for (const q of LEGACY_QUESTIONS) assert.equal(modal(q), snap.modal[q.id], q.id);
});
t("LEGACY IDENTITY: printed paper preview is byte-identical", () => {
  assert.equal(renderToStaticMarkup(h(PP, { draft: LEGACY_DRAFT, totalMarks: 5 })), snap.paper);
});
t("junk / null placement values also render the legacy markup", () => {
  for (const junk of [null, "left", { side: "x" }, 5]) {
    const q = { ...LEGACY_QUESTIONS[0], stimulus: { ...LEGACY_QUESTIONS[0].stimulus, placement: junk } };
    assert.equal(student(q).replace(/\s+/g, " ").length > 0, true);
    assert.equal(student(q), snap.student[q.id]);
  }
});

t("student view: placement left/third puts the visual left (DOM first), text second, options and answer inputs outside the stem row", () => {
  const q = withPlacement(LEGACY_QUESTIONS[0], { side: "left", width: "third" });
  const doc = parse(student(q));
  const row = doc.querySelector('[data-testid="stem-layout"] .lb-row');
  assert.ok(row);
  const cells = [...row.children];
  assert.deepEqual(cells.map((c) => c.hasAttribute("data-stem-media") ? "media" : "text"), ["media", "text"]);
  assert.deepEqual(cells.map((c) => c.style.getPropertyValue("--lb-span")), ["4", "8"]);
  assert.ok(cells[0].querySelector("img"));
  assert.match(cells[1].textContent, /17 protons/);
  assert.equal(doc.querySelectorAll('input[type="radio"]').length, 4, "all MCQ options still render");
  assert.equal(row.querySelectorAll("input").length, 0, "answer controls are NOT inside the stem layout");
});
t("student view: right placement keeps text first in the DOM and marks the visual 'first on phones'", () => {
  const doc = parse(student(withPlacement(LEGACY_QUESTIONS[0], { side: "right", width: "half" })));
  const cells = [...doc.querySelector(".lb-row").children];
  assert.deepEqual(cells.map((c) => c.hasAttribute("data-stem-media") ? "media" : "text"), ["text", "media"]);
  assert.equal(cells[1].dataset.mobile, "first");
});
t("student view: above / below stack in the chosen order", () => {
  for (const [side, expect] of [["above", ["media", "text"]], ["below", ["text", "media"]]]) {
    const doc = parse(student(withPlacement(LEGACY_QUESTIONS[0], { side })));
    assert.deepEqual([...doc.querySelector(".lb-row").children].map((c) => c.hasAttribute("data-stem-media") ? "media" : "text"), expect, side);
  }
});
t("calculation + parts question with a table visual: placement applies, parts remain", () => {
  const q = withPlacement({ ...LEGACY_QUESTIONS[2], stimulus: { type: "table", table: { headers: ["a"], rows: [["1"]] } } }, { side: "right", width: "third" });
  const doc = parse(student(q));
  assert.ok(doc.querySelector('[data-testid="stem-layout"] table'));
  assert.equal(doc.querySelectorAll("textarea").length, 2, "both part answer fields are still there");
});
t("teacher preview modal + printed paper honour the placement", () => {
  const q = withPlacement(LEGACY_QUESTIONS[0], { side: "left", width: "half" });
  const m = parse(modal(q));
  assert.equal(m.querySelector('[data-testid="stem-layout"]')?.dataset.side, "left");
  assert.equal(m.querySelectorAll("li").length >= 4, true, "options list intact");
  const draft = { ...LEGACY_DRAFT, questions: [{ ...LEGACY_DRAFT.questions[0], stimulus: Q.withStimulusPlacement(LEGACY_DRAFT.questions[0].stimulus, { side: "right", width: "third" }) }, LEGACY_DRAFT.questions[1]] };
  const p = parse(renderToStaticMarkup(h(PP, { draft, totalMarks: 5 })));
  assert.equal(p.querySelectorAll('[data-testid="stem-layout"]').length, 1, "only the question with a placement changes");
  assert.match(p.body.textContent, /Explain\./);
});
t("no question data other than visual_data.placement is read or changed (marking safe)", () => {
  const q = LEGACY_QUESTIONS[0];
  const before = JSON.stringify({ o: q.options, p: q.parts, t: q.questionText, m: q.marks, ty: q.questionType });
  const placed = withPlacement(q, { side: "left" });
  assert.equal(JSON.stringify({ o: placed.options, p: placed.parts, t: placed.questionText, m: placed.marks, ty: placed.questionType }), before);
  const { placement, ...rest } = placed.stimulus; assert.ok(placement); assert.deepEqual(rest, q.stimulus);
});

console.log(`\n${n} question layout tests passed`);
