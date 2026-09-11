// Converts pasted rich content (from ChatGPT, Word, Google Docs, KaTeX
// or MathML) into plain, fully-editable Unicode text — never rendered
// math DOM, never duplicated content. Used by every Admin text field
// that accepts equations: Worked Example's Question/Solution, and the
// Rich Text editor.
//
// THE ROOT CAUSE this fixes: a plain <textarea> (and a naive
// contentEditable paste) extracts pasted content via the browser's
// default HTML->plaintext conversion, which is LOSSY for KaTeX-rendered
// math -- KaTeX builds exponents/fractions/etc using many nested spans
// positioned with CSS, not text that concatenates sensibly. The fix is
// NOT to strip HTML more aggressively (that deletes the math entirely,
// which is exactly the bug being reported) -- it's to find the hidden,
// semantically-correct math source BEFORE anything is removed, convert
// IT to Unicode, and only then produce plain text.
//
// Order of operations, always: identify the math node -> extract its one
// authoritative source (KaTeX's <annotation encoding="application/x-tex">
// or MathML's alttext) -> convert that source to Unicode -> substitute
// the Unicode text in place of the ENTIRE math node (so nothing
// duplicates) -> only then read the surrounding plain text.

const SUB_DIGITS = { "0": "\u2080", "1": "\u2081", "2": "\u2082", "3": "\u2083", "4": "\u2084", "5": "\u2085", "6": "\u2086", "7": "\u2087", "8": "\u2088", "9": "\u2089", "+": "\u208A", "-": "\u208B", "\u2212": "\u208B" };
const SUP_DIGITS = { "0": "\u2070", "1": "\u00B9", "2": "\u00B2", "3": "\u00B3", "4": "\u2074", "5": "\u2075", "6": "\u2076", "7": "\u2077", "8": "\u2078", "9": "\u2079", "+": "\u207A", "-": "\u207B", "\u2212": "\u207B" };

const LATEX_SYMBOLS = [
  [/\\times/g, "\u00D7"],
  [/\\cdot/g, "\u00B7"],
  [/\\rightleftharpoons/g, "\u21CC"],
  [/\\leftrightarrow/g, "\u2194"],
  [/\\rightarrow/g, "\u2192"],
  [/\\leftarrow/g, "\u2190"],
  [/\\pm/g, "\u00B1"],
  [/\\approx/g, "\u2248"],
  [/\\neq/g, "\u2260"],
  [/\\leq/g, "\u2264"],
  [/\\geq/g, "\u2265"],
  [/\\Delta/g, "\u0394"],
  [/\\delta/g, "\u03B4"],
  [/\\log_\{?10\}?/g, "log\u2081\u2080"],
  [/\\ldots/g, "\u2026"],
];

/** Converts a LaTeX source string (as found in a KaTeX/MathML
 * annotation) into plain, editable Unicode -- the exact conversions
 * requested: H_2O -> H\u2082O, H_3O^+ -> H\u2083O\u207A, 10^{-3} -> 10\u207B\u00B3, etc. */
export function latexToUnicode(latex) {
  if (!latex) return "";
  let s = latex;

  // \mathrm{...} / \text{...} wrappers carry no visual meaning once
  // converted to plain Unicode -- keep only their content.
  s = s.replace(/\\(?:mathrm|text|mathbf|mathit)\{([^{}]*)\}/g, "$1");

  // Subscripts / superscripts -- braced group or single character.
  s = s.replace(/_\{([^{}]*)\}/g, (_, g) => [...g].map((c) => SUB_DIGITS[c] ?? c).join(""));
  s = s.replace(/_([0-9+\-\u2212])/g, (_, c) => SUB_DIGITS[c] ?? c);
  s = s.replace(/\^\{([^{}]*)\}/g, (_, g) => [...g].map((c) => SUP_DIGITS[c] ?? c).join(""));
  s = s.replace(/\^([0-9+\-\u2212])/g, (_, c) => SUP_DIGITS[c] ?? c);

  for (const [pattern, replacement] of LATEX_SYMBOLS) s = s.replace(pattern, replacement);

  // Any remaining LaTeX command: drop the backslash, keep the name
  // (best-effort -- better to show "log" than "\log").
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  // Remaining braces are just grouping -- safe to drop once math has
  // been linearized above.
  s = s.replace(/[{}]/g, "");

  // A "-" used as a mathematical/unary minus (before a digit OR a
  // command-turned-word like "log", after =, whitespace, "(", or start)
  // reads better as a true minus sign -- covers both "10^{-3}" and
  // "-\log_{10}(...)" alike, since command-stripping above has already
  // turned "\log" into the plain word "log" by this point.
  s = s.replace(/(^|[\s(=])-(?=[\d\p{L}])/gu, (_, pre) => `${pre}\u2212`);

  // LaTeX source carries no spacing around "=" or "\times" -- add it for
  // readability, matching the requested "2.5 × 10⁻³" output rather than
  // a cramped "2.5×10⁻³".
  s = s.replace(/\s*=\s*/g, " = ");
  s = s.replace(/\s*\u00D7\s*/g, " \u00D7 ");

  return s.replace(/\s+/g, " ").trim();
}

/** Best-effort plain-text extraction from a MathML <math> element when
 * no annotation/alttext is available -- walks the common element types
 * (mrow, mi, mn, mo, msub, msup, msubsup) rather than trusting
 * textContent, since MathML layout elements don't concatenate into
 * correct reading order via textContent alone. */
function mathMLToText(mathEl) {
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    const tag = node.tagName?.toLowerCase();
    const children = Array.from(node.childNodes).map(walk);
    if (tag === "msub") return `${children[0] ?? ""}${[...(children[1] ?? "")].map((c) => SUB_DIGITS[c] ?? c).join("")}`;
    if (tag === "msup") return `${children[0] ?? ""}${[...(children[1] ?? "")].map((c) => SUP_DIGITS[c] ?? c).join("")}`;
    if (tag === "msubsup") {
      const sub = [...(children[1] ?? "")].map((c) => SUB_DIGITS[c] ?? c).join("");
      const sup = [...(children[2] ?? "")].map((c) => SUP_DIGITS[c] ?? c).join("");
      return `${children[0] ?? ""}${sub}${sup}`;
    }
    return children.join("");
  }
  return walk(mathEl).replace(/\s+/g, " ").trim();
}

/** Converts one math container element (a KaTeX ".katex" wrapper, or a
 * bare MathML "<math>") to its single best Unicode text representation.
 * Never reads BOTH the hidden MathML and the visual KaTeX HTML for the
 * same element -- that duplication is exactly the bug being fixed. */
function extractOneEquation(el) {
  const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
  if (annotation?.textContent) return latexToUnicode(annotation.textContent);

  const mathEl = el.tagName?.toLowerCase() === "math" ? el : el.querySelector("math");
  if (mathEl) {
    const alttext = mathEl.getAttribute("alttext");
    if (alttext) return latexToUnicode(alttext);
    return mathMLToText(mathEl);
  }

  // Last resort -- whatever text is actually there. Not ideal (may be
  // the lossy KaTeX visual HTML), but strictly better than deleting it.
  return el.textContent || "";
}

/** The main entry point -- call with a paste ClipboardEvent's
 * clipboardData. Returns the best plain, editable text: normal visible
 * plain text is kept as-is (priority A); otherwise any KaTeX/MathML
 * equation nodes in the pasted HTML are converted to Unicode IN PLACE
 * before the surrounding plain text is read, so nothing is lost or
 * duplicated (priority B). */
export function extractMathAwareText(clipboardData) {
  const plain = clipboardData?.getData("text/plain") ?? "";
  const html = clipboardData?.getData("text/html");

  if (!html) return plain;

  // If the HTML has no math markup at all, the browser's own plain-text
  // extraction is already correct and cheaper to trust.
  if (!/katex|<math[\s>]|application\/x-tex/i.test(html)) return plain || html.replace(/<[^>]*>/g, "");

  const doc = new DOMParser().parseFromString(html, "text/html");

  // KaTeX wraps each equation in one ".katex" element containing BOTH a
  // hidden-but-correct MathML copy and a visual-only HTML copy -- treat
  // ".katex" as the unit to replace, never its children individually,
  // or the visual copy's spans get walked too and produce duplicates.
  doc.querySelectorAll(".katex").forEach((el) => {
    el.replaceWith(doc.createTextNode(extractOneEquation(el)));
  });
  // A bare <math> not wrapped in .katex (Word/Google Docs/other MathML
  // sources) -- same substitute-before-reading approach.
  doc.querySelectorAll("math").forEach((el) => {
    el.replaceWith(doc.createTextNode(extractOneEquation(el)));
  });

  const extracted = (doc.body.textContent || "").replace(/\u00a0/g, " ");
  const normalized = extracted.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return normalized || plain;
}

/** For a plain <textarea>: intercepts paste, extracts math-aware text,
 * and splices it in at the current cursor position (replacing any
 * selection) -- textareas have no rich paste to intercept, so this is a
 * manual insert rather than execCommand. */
export function handleTextareaPaste(event, currentValue, onChange) {
  event.preventDefault();
  const text = extractMathAwareText(event.clipboardData);
  const el = event.target;
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  const next = currentValue.slice(0, start) + text + currentValue.slice(end);
  onChange(next);
  // Restore the cursor just after the inserted text, next tick (after
  // React has re-rendered the field with the new value).
  requestAnimationFrame(() => {
    const pos = start + text.length;
    el.setSelectionRange?.(pos, pos);
  });
}

/** For the Rich Text contentEditable editor: intercepts paste and
 * inserts the math-aware text as plain text via the same insertText
 * command the editor's own formatting buttons already use -- never
 * inserts foreign HTML/rendered math DOM, so the result participates in
 * normal bold/italic/colour/etc formatting exactly like typed text. */
export function handleRichTextPaste(event) {
  event.preventDefault();
  const text = extractMathAwareText(event.clipboardData);
  document.execCommand("insertText", false, text);
}
