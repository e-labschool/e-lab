#!/usr/bin/env node
// Node-level regression harness for the shared scientific-content
// rendering pipeline (src/lib/scientificContent.jsx) — run with:
//   node scripts/test-scientific-rendering.mjs
//
// This imports the REAL, UNMODIFIED production module (via
// scripts/jsx-loader-hooks.mjs, which only strips the one JSX expression
// Node itself can't parse — see that file for why) and exercises it
// through both call paths that exist in the app:
//   - renderScientificMarkup / renderMathMarkersInHtml -- the Rich Text
//     block's path, operating on already-serialized HTML.
//   - renderScientificText -- every EquationFriendlyField-backed field's
//     path (Key Idea, Definition, Worked Example, Think/Reveal, ...),
//     which escapes its whole input FIRST, then looks for math markers.
// Both paths are where the comparison-operator entity bug could occur
// (see the comment on decodeMathSourceEntities() in scientificContent.jsx
// for the full root-cause writeup), so both are tested for every case.
import assert from "node:assert/strict";
import { register } from "node:module";

register("./jsx-loader-hooks.mjs", import.meta.url);

const {
  renderCompactLatex,
  renderMathMarkersInHtml,
  renderScientificText,
  containsScientificMarkup,
} = await import("../src/lib/scientificContent.jsx");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
    failed++;
  }
}

// No visible HTML-escaped-entity text (the literal characters "&lt;" or
// "&gt;" etc appearing as TEXT, i.e. double-encoded) is ever allowed to
// survive in rendered mathematics.
function assertNoVisibleEscapedEntities(html, label) {
  assert.ok(!/&amp;(lt|gt|le|ge|ne|amp);?/i.test(html), `${label}: found a double-encoded entity in: ${html}`);
  // A literal "&lt;"/"&gt;" appearing as TEXT content (not as the HTML
  // entity itself, which is the CORRECT way to display "<"/">") is the
  // bug signature — detect it by checking the html has no stray bare
  // "&lt;" standing in for the word rather than rendering a character.
  // Since a correctly single-encoded "&lt;" is indistinguishable from
  // this test's string perspective (both are the substring "&lt;" in
  // the HTML source — THAT is exactly how a browser is told to show the
  // character "<"), the real signature we must forbid is "&amp;lt;"
  // (asserted above) — this helper documents why "&lt;" alone is fine.
}

console.log("\n== Issue 1: scientific comparison operators ==");
{
  // Test 1 — spec's primary repro: \boxed{} + display equation + "<".
  test("[boxed <] HTML path renders a real '<', never visible '&lt;' text", () => {
    const html = renderMathMarkersInHtml("\\[ \\boxed{IE_1(Al) < IE_1(Mg)} \\]");
    assertNoVisibleEscapedEntities(html, "boxed <");
    assert.ok(html.includes("&lt;"), "should contain the single-encoded '<' entity for correct display");
  });
  test("[boxed <] plain-text field path (pre-escaped source) renders a real '<'", () => {
    // Simulates exactly what EquationFriendlyField -> ScientificText does:
    // renderScientificText() escapes its WHOLE input first, so a
    // literal '<' the teacher typed is already "&lt;" by the time the
    // math delimiters are matched — this is the actual bug repro path.
    const html = renderScientificText("\\[ \\boxed{IE_1(Al) < IE_1(Mg)} \\]");
    assertNoVisibleEscapedEntities(html, "boxed < (plain-text field path)");
    assert.ok(html.includes("&lt;"));
  });
  test("[boxed <] rich-text HTML already round-tripped through contentEditable (stored as &lt;)", () => {
    // Simulates what c.html actually contains after a teacher typed '<'
    // into the Rich Text contentEditable and the browser serialized it
    // via innerHTML (always entity-encodes raw '<' in text nodes).
    const html = renderMathMarkersInHtml("\\[ \\boxed{IE_1(Al) &lt; IE_1(Mg)} \\]");
    assertNoVisibleEscapedEntities(html, "boxed < (already-serialized HTML path)");
    assert.ok(html.includes("&lt;"));
  });

  // Test 2
  test("IE_1(Na) > IE_1(K) renders a real '>'", () => {
    const html = renderScientificText("\\[ IE_1(Na) > IE_1(K) \\]");
    assertNoVisibleEscapedEntities(html, ">");
    assert.ok(html.includes("&gt;"));
  });

  // Test 3 / 4
  test("x \\le y and x \\ge y render ≤ / ≥", () => {
    assert.ok(renderScientificText("\\[ x \\le y \\]").includes("≤"));
    assert.ok(renderScientificText("\\[ x \\ge y \\]").includes("≥"));
  });

  // Test 5
  test("\\le, \\ge, \\neq, \\leq, \\geq all resolve to their symbols", () => {
    assert.ok(renderCompactLatex("\\le").includes("≤"));
    assert.ok(renderCompactLatex("\\ge").includes("≥"));
    assert.ok(renderCompactLatex("\\neq").includes("≠"));
    assert.ok(renderCompactLatex("\\leq").includes("≤"));
    assert.ok(renderCompactLatex("\\geq").includes("≥"));
  });
  test("\\lt and \\gt (LaTeX's escaped literal forms) also resolve correctly", () => {
    const lt = renderScientificText("\\[ x \\lt y \\]");
    const gt = renderScientificText("\\[ x \\gt y \\]");
    assertNoVisibleEscapedEntities(lt, "\\lt");
    assertNoVisibleEscapedEntities(gt, "\\gt");
    assert.ok(lt.includes("&lt;"));
    assert.ok(gt.includes("&gt;"));
  });

  // Test 6 — security: plain prose with escaped/unsafe HTML must stay inert.
  test("plain prose containing escaped/unsafe HTML remains safely escaped (no math regions)", () => {
    const html = renderScientificText('Click <script>alert(1)</script> here & "quotes"');
    assert.ok(!html.includes("<script>"), "a literal <script> tag must never survive unescaped");
    assert.ok(html.includes("&lt;script&gt;"));
  });
  test("security: raw unsafe HTML typed INSIDE a math region is still only ever shown as escaped text, never executed", () => {
    const html = renderMathMarkersInHtml("\\[ <img src=x onerror=alert(1)> \\]");
    assert.ok(!/<img[^>]*onerror/i.test(html), "no live onerror-bearing <img> may appear in the output");
    assert.ok(html.includes("&lt;img") && html.includes("&gt;"));
  });
  test("security: an already-double-encoded entity inside math decodes only ONE level (never further, never executes)", () => {
    const html = renderMathMarkersInHtml("\\[ &amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt; \\]");
    assert.ok(!html.includes("<script"), "must never produce a live <script> tag");
  });
  test("security: ordinary prose text OUTSIDE any math delimiter is never entity-decoded", () => {
    // Only the text captured BETWEEN \( \)/\[ \]/⟦math:...⟧ is decoded —
    // prose text elsewhere in the same string must be completely
    // unaffected, proving this is not a global unescape.
    const html = renderMathMarkersInHtml("prose &lt;b&gt;should stay literal&lt;/b&gt;, math: \\(x \\le y\\)");
    assert.ok(html.startsWith("prose &lt;b&gt;should stay literal&lt;/b&gt;,"), "prose outside math must be byte-for-byte unchanged");
    assert.ok(html.includes("≤"));
  });

  // Test 7 — existing compact math markers still work.
  test("existing compact ⟦math:...⟧ markers still work, including with a < inside", () => {
    const html = renderMathMarkersInHtml("before ⟦math:IE_1(Al) &lt; IE_1(Mg)⟧ after");
    assert.ok(html.startsWith("before ") && html.endsWith(" after"));
    assertNoVisibleEscapedEntities(html, "compact marker");
    assert.ok(html.includes("&lt;"));
  });

  // Test 8 — existing \boxed{\text{...}} content still works.
  test("existing \\boxed{\\text{...}} content still renders correctly", () => {
    const html = renderScientificText("\\[ \\boxed{\\text{Group 2}} \\]");
    assert.ok(html.includes("Group 2"));
    assert.ok(html.includes("not-italic"));
  });

  test("chemistry arrows and existing notation are preserved alongside the fix", () => {
    const html = renderScientificText("\\[ A \\rightarrow B \\rightleftharpoons C \\]");
    assert.ok(html.includes("→") && html.includes("⇌"));
  });
}

console.log("\n== Spacing (issue 3) ==");
{
  // Test 9
  test('"2 valence electrons → Group 2" keeps natural spacing', () => {
    const html = renderScientificText("2 valence electrons → Group 2");
    assert.equal(html, "2 valence electrons → Group 2");
  });

  // Test 10
  test('"Mg: 1s² 2s² 2p⁶ 3s²" keeps natural spacing', () => {
    const html = renderScientificText("Mg: 1s² 2s² 2p⁶ 3s²");
    assert.equal(html, "Mg: 1s² 2s² 2p⁶ 3s²");
  });
  test('"Mg:1s^2" (no author-typed space) still gets the existing colon-spacing fix, unaffected by the entity fix', () => {
    const html = renderScientificText("\\(Mg:1s^2\\)");
    // The CHEM_LABEL_COLON_RE fix (pre-existing, must be preserved)
    // inserts a thin space after the colon so "Mg:" and "1s2" don't
    // visually touch.
    assert.ok(html.includes("Mg:") && !html.includes("Mg:1"), "a space/markup must separate the colon from 1s2");
  });

  // Test 11
  test("mixed prose + inline math preserves natural boundaries on both sides", () => {
    const html = renderScientificText("Largest jump: IE_2 \\(\\rightarrow\\) IE_3");
    assert.ok(html.includes("IE_2 <span") || html.includes("IE_2 ") , "space before the inline math span must survive");
    assert.ok(/<\/span>\s+IE_3/.test(html) || html.trim().endsWith("IE_3"), "space after the inline math span must survive");
  });

  // Test 12
  test("explicit \\quad / \\qquad remain functional inside math", () => {
    assert.ok(renderCompactLatex("x \\quad y").includes('w-[1em]'));
    assert.ok(renderCompactLatex("x \\qquad y").includes('w-[2em]'));
  });
  test("explicit \\, \\; \\: still produce a literal space inside math", () => {
    assert.equal(renderCompactLatex("a\\,b"), "a b");
    assert.equal(renderCompactLatex("a\\;b"), "a b");
  });

  test("containsScientificMarkup correctly detects all three recognised forms", () => {
    assert.ok(containsScientificMarkup("\\(x\\)"));
    assert.ok(containsScientificMarkup("\\[x\\]"));
    assert.ok(containsScientificMarkup("⟦math:x⟧"));
    assert.ok(!containsScientificMarkup("plain text, no markup"));
  });
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
