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

/** Small dependency-free renderer for the equation shapes used in Learn.
 * Deliberately renders maths inline/compactly: no large equation cards,
 * no heavy math-typesetting library loaded per paragraph. */
export function renderCompactLatex(latex) {
  const src = String(latex ?? "").trim();
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
      if (markerLatex != null) return inlineWrap(renderCompactLatex(markerLatex));
      if (displayLatex != null) return displayWrap(renderCompactLatex(displayLatex));
      if (inlineLatex != null) return inlineWrap(renderCompactLatex(inlineLatex));
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
