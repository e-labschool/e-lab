// ============================================================================
// e-Lab shared scientific-content rendering pipeline.
//
// ONE place that understands teacher-authored scientific notation, reused
// by every Learn block (student render) AND the admin editor's own
// preview -- so the two can never drift apart, and no block reimplements
// its own regex/math parser.
//
// Recognises THREE input forms, and only these three (anything else is
// left as plain text, exactly as the teacher typed it):
//   1. ⟦math:...⟧        -- e-Lab's existing compact marker (unchanged,
//                            still produced by pasting a real KaTeX/MathML
//                            equation -- see EquationFriendlyField.jsx).
//   2. \( ... \)          -- standard inline LaTeX delimiters.
//   3. \[ ... \]          -- standard LaTeX display-equation delimiters.
//
// Storage is never rewritten to make this work: forms 2 and 3 are matched
// and rendered directly from the teacher-authored source at DISPLAY time,
// every time, so existing content and freshly typed/pasted content are
// both handled without any migration step.
// ============================================================================

function escapeMathHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----------------------------------------------------------------------
// Root cause of "IE_1(Al)&lt;IE_1(Mg)" showing up literally on screen
// (and of authors reaching for manual \quad/&nbsp; hacks that happen to
// dodge it): by the time a \( \)/\[ \]/⟦math:...⟧ region reaches this
// module, its SOURCE TEXT may already have gone through one layer of
// HTML-entity encoding, from one of two upstream, independently correct
// steps that have nothing to do with maths and must not change:
//   1. Rich Text (contentEditable) HTML -- when a teacher types a
//      literal "<" inside a \[ \] block, the browser's own innerHTML
//      serialiser (standard, unavoidable DOM behaviour) stores it as the
//      TEXT "&lt;", not the character "<". That's correct for HTML
//      storage -- it is NOT correct as LaTeX *source*.
//   2. Every EquationFriendlyField-backed plain-text field (Key Idea,
//      Definition, Worked Example, ...) -- renderScientificText()
//      below correctly escapes the WHOLE string first (so stray "&"/
//      "<"/">" in ordinary prose can never break the markup), then
//      looks for \( \)/\[ \] on the escaped string. That also means any
//      "<"/">" a teacher typed *inside* a math region is "&lt;"/"&gt;"
//      by the time the math delimiters are matched.
// Either way, renderCompactLatex() then receives the literal six
// characters "&lt;" as its "<" and (correctly, on its own terms) escapes
// the "&" again for display -- "&amp;lt;" in the final HTML, which the
// browser shows as the literal text "&lt;".
//
// The fix is narrow and happens at exactly one, shared, trusted point:
// decode ONLY the text already captured as a math region's source (see
// replaceScientificMarkup below), never anything outside it. Ordinary
// prose is never touched by this function, so normal rich-text
// sanitization (DOMPurify in learnBlockRegistry.jsx's sanitizeHtml, and
// escapeMathHtml's own escaping of prose) is completely unaffected --
// this only ever un-does ONE accidental layer of entity-encoding on
// text that is about to be re-parsed and re-escaped as LaTeX source
// anyway, never dangerouslySetInnerHTML'd raw.
const MATH_SOURCE_ENTITY_RE = /&(lt|gt|amp|quot|apos|#39|nbsp|#x?[0-9a-fA-F]+);/gi;
const MATH_SOURCE_ENTITY_MAP = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'", "#39": "'", nbsp: " " };

function decodeMathSourceEntities(value) {
  return String(value ?? "").replace(MATH_SOURCE_ENTITY_RE, (match, name) => {
    const lower = name.toLowerCase();
    if (MATH_SOURCE_ENTITY_MAP[lower] != null) return MATH_SOURCE_ENTITY_MAP[lower];
    if (lower[0] === "#") {
      const isHex = lower[1] === "x";
      const codePoint = Number.parseInt(lower.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try { return String.fromCodePoint(codePoint); } catch { return match; }
      }
    }
    return match;
  });
}

function readBraceGroup(source, start) {
  if (source[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return { value: source.slice(start + 1, i), end: i + 1 };
  }
  return null;
}

// Symbol/command table. Ordering matters: a command that is a strict
// prefix of another (\le vs \leq, \ge vs \geq) MUST have the longer form
// listed first, or the shorter form would always match first and leave a
// stray "q" (etc) behind as literal text.
const LATEX_COMMANDS = [
  ["\\rightleftharpoons", "⇌"], ["\\leftrightarrow", "↔"],
  ["\\rightarrow", "→"], ["\\to", "→"],
  ["\\times", "×"], ["\\cdot", "·"], ["\\div", "÷"], ["\\pm", "±"],
  ["\\approx", "≈"], ["\\propto", "∝"], ["\\neq", "≠"],
  ["\\leq", "≤"], ["\\le", "≤"], ["\\geq", "≥"], ["\\ge", "≥"],
  // \lt / \gt -- LaTeX's own escaped forms for literal "<"/">" (needed
  // because bare "<"/">" are sometimes special to LaTeX tooling).
  // Mapped to the HTML entity directly (not the raw character) since
  // LATEX_COMMANDS' replacement text is injected into `out` unescaped
  // below -- a raw "<"/">" there would corrupt the surrounding HTML.
  ["\\lt", "&lt;"], ["\\gt", "&gt;"],
  ["\\infty", "∞"], ["\\degree", "°"], ["\\circ", "°"],
  ["\\sum", "∑"], ["\\sqrt", "√"],
  // Greek -- uppercase before lowercase where names could otherwise
  // collide is not actually needed here (LaTeX case is significant and
  // \Delta / \delta are already distinct tokens), listed together by letter
  // for maintainability.
  ["\\Delta", "Δ"], ["\\delta", "δ"],
  ["\\Sigma", "Σ"], ["\\sigma", "σ"],
  ["\\Omega", "Ω"], ["\\omega", "ω"],
  ["\\alpha", "α"], ["\\beta", "β"], ["\\gamma", "γ"],
  ["\\lambda", "λ"], ["\\nu", "ν"], ["\\mu", "μ"], ["\\pi", "π"],
  ["\\rho", "ρ"], ["\\theta", "θ"],
];

// Chemistry-notation preprocessing -- additive only, never removes or
// duplicates spacing the author already typed.
//
// Root cause this fixes: this renderer emits literal source characters
// (including plain spaces) as-is -- it does NOT collapse whitespace the
// way real LaTeX math mode does. So "Mg:1s^2" renders exactly as typed,
// with "Mg:" and "1s^2" visually touching, simply because the author's
// raw source has no space/space-command between the colon and the
// electron-configuration term. This is a preprocessing gap, not a
// whitespace-collapsing bug.
//
// Fix: recognise the narrow "<label>:<config-term>" shape -- a colon
// immediately (zero characters in between) followed by an orbital term
// (`\d[spdf]^`, e.g. `1s^2`) or a noble-gas core (`[Ne]`, `[Ar]`, `[Kr]`,
// `[Xe]`) -- and insert a `\,` (thin space, the same space command
// already used between orbital terms) right after the colon.
//
// Deliberately narrow: the lookahead requires the config-term to sit
// *immediately* after the colon, so it only fires on the true
// "just-typed-without-a-space" case:
//   - Any colon that already has a space or a space command after it
//     (`Mg: 1s^2`, `Mg:\,1s^2`, `Mg:\;1s^2`, `Mg:\quad 1s^2`, ...) is left
//     completely untouched -- the lookahead's next character would be a
//     space/backslash, not a digit or `[`, so it never matches.
//   - A colon anywhere else in ordinary maths/prose (`f(x): domain`,
//     ratios, labels, etc.) is untouched -- the lookahead specifically
//     requires the electron-configuration shape right after it.
//   - It never doubles up: since it only matches when there is NOTHING
//     between the colon and the config-term, a colon that already got a
//     `\,` inserted (by this same rule or by the author) can never match
//     again on a second pass.
const CHEM_LABEL_COLON_RE = /:(?=\d[spdf]\^|\[(?:He|Ne|Ar|Kr|Xe|Rn)\])/g;

function preprocessChemistryNotation(src) {
  return src.replace(CHEM_LABEL_COLON_RE, ":\\,");
}

/** Small dependency-free renderer for the equation shapes used in Learn.
 * Deliberately renders maths inline/compactly: no large equation cards,
 * no heavy math-typesetting library loaded per paragraph. */
export function renderCompactLatex(latex) {
  const src = preprocessChemistryNotation(String(latex ?? "").trim());
  let out = "";
  for (let i = 0; i < src.length;) {
    if (src.startsWith("\\frac", i)) {
      const a = readBraceGroup(src, i + 5);
      const b = a && readBraceGroup(src, a.end);
      if (a && b) {
        out += `<span class="inline-flex align-middle flex-col items-center leading-none mx-1"><span class="border-b border-current px-1 pb-[2px]">${renderCompactLatex(a.value)}</span><span class="px-1 pt-[2px]">${renderCompactLatex(b.value)}</span></span>`;
        i = b.end; continue;
      }
    }
    if (src.startsWith("\\boxed", i)) {
      const g = readBraceGroup(src, i + 6);
      if (g) { out += `<span class="inline-block rounded border border-[var(--color-indigo)]/45 px-2 py-0.5 font-semibold">${renderCompactLatex(g.value)}</span>`; i = g.end; continue; }
    }
    // \text{...} -- plain (non-italic) text within an equation, e.g.
    // \text{isotope-35}. Its content is recursively rendered (not just
    // escaped verbatim) so a nested command like \% inside \text{} still
    // resolves correctly, matching real LaTeX's \text behaviour.
    if (src.startsWith("\\text", i) || src.startsWith("\\mathrm", i)) {
      const skip = src.startsWith("\\text", i) ? 5 : 7;
      const g = readBraceGroup(src, i + skip);
      if (g) { out += `<span class="not-italic font-sans">${renderCompactLatex(g.value)}</span>`; i = g.end; continue; }
    }
    // \qquad checked before \quad since both start with "\q" -- a shared
    // prefix, so the longer command must be tried first or it would never
    // be reached (\quad would always match its own prefix of \qquad first
    // and leave a stray "quad" behind).
    if (src.startsWith("\\qquad", i)) { out += `<span class="inline-block w-[2em]"></span>`; i += 6; continue; }
    if (src.startsWith("\\quad", i)) { out += `<span class="inline-block w-[1em]"></span>`; i += 5; continue; }
    if (src.startsWith("\\%", i)) { out += "%"; i += 2; continue; }
    if (src.startsWith("\\,", i) || src.startsWith("\\;", i) || src.startsWith("\\:", i)) { out += " "; i += 2; continue; }
    if (src.startsWith("\\!", i)) { i += 2; continue; }

    const cmd = LATEX_COMMANDS.find(([name]) => src.startsWith(name, i));
    if (cmd) { out += cmd[1]; i += cmd[0].length; continue; }

    if ((src[i] === "_" || src[i] === "^") && src[i + 1] === "{") {
      const g = readBraceGroup(src, i + 1);
      if (g) { const tag = src[i] === "_" ? "sub" : "sup"; out += `<${tag}>${renderCompactLatex(g.value)}</${tag}>`; i = g.end; continue; }
    }
    if ((src[i] === "_" || src[i] === "^") && i + 1 < src.length) {
      const tag = src[i] === "_" ? "sub" : "sup"; out += `<${tag}>${escapeMathHtml(src[i + 1])}</${tag}>`; i += 2; continue;
    }
    if (src[i] === "\\") {
      // Any remaining backslash-command we don't specifically know
      // becomes its bare name (\log -> log) rather than leaking a
      // literal backslash into student-facing text.
      const m = src.slice(i).match(/^\\([A-Za-z]+)/);
      if (m) { out += escapeMathHtml(m[1]); i += m[0].length; continue; }
      i += 1; continue; // lone trailing backslash -- drop it, never crash
    }
    if (src[i] !== "{" && src[i] !== "}") out += escapeMathHtml(src[i]);
    i += 1;
  }
  return out;
}

function inlineWrap(innerHtml) {
  return `<span class="inline-math align-middle whitespace-nowrap font-serif text-[1.03em]">${innerHtml}</span>`;
}

// A real block-level "display equation" would need a <div>, but this
// content is injected via dangerouslySetInnerHTML into contexts that are
// sometimes themselves inline (a <span>, a <p>) -- a literal <div> there
// is invalid nesting that browsers silently "fix" by breaking the DOM
// apart unpredictably. Using a <span> with CSS display:block instead gets
// the same centred, own-line visual result while staying valid inside
// ANY ancestor element.
function displayWrap(innerHtml) {
  return `<span class="my-2 block overflow-x-auto text-center font-serif text-[1.05em] leading-relaxed">${innerHtml}</span>`;
}

// Combined tokenizer: identifies all three supported forms in one pass,
// left-to-right, non-overlapping -- so normal text and math segments are
// split safely and nothing is ever double-processed. Order in the
// alternation does not affect correctness here (the three forms use
// disjoint delimiters), only which capture group is populated.
const SCI_MARKUP_RE = /⟦math:([\s\S]*?)⟧|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;

function replaceScientificMarkup(source) {
  return source.replace(SCI_MARKUP_RE, (match, markerLatex, displayLatex, inlineLatex) => {
    try {
      // decodeMathSourceEntities() is applied ONLY to the already-
      // delimited math source captured by the regex above -- never to
      // `source` as a whole -- see the comment on
      // decodeMathSourceEntities() for exactly why this one decode is
      // both necessary and safe. renderCompactLatex() re-escapes
      // everything it emits via escapeMathHtml(), so a decoded "<"/">"/
      // "&" here always comes back out as a single, correct HTML entity
      // -- never as raw markup.
      if (markerLatex != null) return inlineWrap(renderCompactLatex(decodeMathSourceEntities(markerLatex)));
      if (displayLatex != null) return displayWrap(renderCompactLatex(decodeMathSourceEntities(displayLatex)));
      if (inlineLatex != null) return inlineWrap(renderCompactLatex(decodeMathSourceEntities(inlineLatex)));
      return match;
    } catch {
      // A malformed expression must never blank the block or crash the
      // page -- fall back to the original, unrendered source text so the
      // student still sees SOMETHING sensible, and the admin can see
      // exactly what needs fixing.
      return match;
    }
  });
}

/** For HTML-context content (the Rich Text block's stored HTML): replaces
 * every recognised math form with rendered markup, leaving all other
 * markup (bold, lists, links, line breaks...) untouched. Safe to call on
 * content that has already been resolved from pasted KaTeX/MathML (see
 * resolveMathAnnotationsInHtml in EquationFriendlyField.jsx) or on plain
 * typed \( \) / \[ \] text -- both paths land here. */
export function renderScientificMarkup(html) {
  try {
    return replaceScientificMarkup(String(html ?? ""));
  } catch {
    return String(html ?? "");
  }
}

// Backward-compatible alias -- existing call sites in LearnBlockRenderer.jsx
// used this name before the pipeline was centralized here.
export const renderMathMarkersInHtml = renderScientificMarkup;

/** For plain-text-context content (every EquationFriendlyField-backed
 * Learn field: Key Idea, Definition, Real-Life, Think/Reveal, Practical,
 * Worked Example, Compare & Contrast, etc). Escapes the raw text first
 * (so a stray "&"/"<"/">" in ordinary prose can never break the markup),
 * THEN recognises math segments on the escaped string -- safe because
 * none of the three delimiter forms use characters escapeMathHtml
 * touches. Preserves line breaks as <br />. */
export function renderScientificText(text) {
  const escaped = escapeMathHtml(text ?? "");
  const withMath = replaceScientificMarkup(escaped);
  return withMath.replace(/\n/g, "<br />");
}

export function ScientificText({ text, className = "" }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderScientificText(text) }} />;
}

// Backward-compatible alias.
export const CompactMathText = ScientificText;

/** True if the given plain-text/HTML source contains any recognised
 * scientific-markup form -- used by the admin editor to decide whether a
 * preview strip is worth showing at all. */
export function containsScientificMarkup(source) {
  SCI_MARKUP_RE.lastIndex = 0;
  return SCI_MARKUP_RE.test(String(source ?? ""));
}
