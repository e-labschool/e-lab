import { useEffect, useRef, useState } from "react";
import { Sigma } from "lucide-react";
import { ScientificText, containsScientificMarkup } from "../../lib/scientificContent.jsx";

const SUB = {0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉","+":"₊","-":"₋","=":"₌","(":"₍",")":"₎",a:"ₐ",e:"ₑ",h:"ₕ",i:"ᵢ",j:"ⱼ",k:"ₖ",l:"ₗ",m:"ₘ",n:"ₙ",o:"ₒ",p:"ₚ",r:"ᵣ",s:"ₛ",t:"ₜ",u:"ᵤ",v:"ᵥ",x:"ₓ"};
const SUP = {0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾",n:"ⁿ",i:"ⁱ"};
const mapChars = (text, map) => [...String(text ?? "")].map((ch) => map[ch] ?? ch).join("");

// ---------------------------------------------------------------------
// LaTeX (from a MathML/KaTeX <annotation>) -> plain editable Unicode.
//
// Strategy, per spec: identify the equation node, extract ONE
// representation (the LaTeX source — it's the structured, reliable one;
// KaTeX's *visible* HTML branch is a maze of spacer/strut spans that
// isn't reliable to read text back out of), convert it to Unicode, and
// use THAT as the replacement — never both, never neither.
// ---------------------------------------------------------------------

const LATEX_WRAP_COMMANDS = ["mathrm", "text", "mathbf", "boldsymbol", "mathit", "operatorname", "mathsf"];
const LATEX_SYMBOLS = [
  ["\\rightleftharpoons", "⇌"], ["\\leftrightarrow", "↔"], ["\\rightarrow", "→"], ["\\to", "→"],
  ["\\times", "×"], ["\\cdot", "·"], ["\\pm", "±"], ["\\approx", "≈"], ["\\neq", "≠"],
  ["\\leq", "≤"], ["\\geq", "≥"], ["\\infty", "∞"], ["\\Delta", "Δ"], ["\\delta", "δ"], ["\\circ", "°"],
  ["\\qquad", "  "], ["\\quad", " "], ["\\,", " "], ["\\;", " "], ["\\:", " "], ["\\!", ""], ["\\\\", " "],
];

function stripLatexWrapCommand(str, cmd) {
  const re = new RegExp(`\\\\${cmd}\\{([^{}]*)\\}`, "g");
  let prev;
  do { prev = str; str = str.replace(re, "$1"); } while (str !== prev);
  return str;
}

/** e.g. "\mathrm{pH}=-\log_{10}(2.5\times10^{-3})" -> "pH = −log₁₀(2.5 × 10⁻³)" */
export function convertLatexToUnicode(latex) {
  let s = String(latex ?? "");
  LATEX_WRAP_COMMANDS.forEach((cmd) => { s = stripLatexWrapCommand(s, cmd); });
  LATEX_SYMBOLS.forEach(([cmd, sym]) => { s = s.split(cmd).join(sym); });

  // Sub/superscripts, braced or single-character.
  s = s.replace(/_\{([^{}]*)\}/g, (_, g) => mapChars(g, SUB));
  s = s.replace(/_([^\s{}\\])/g, (_, g) => mapChars(g, SUB));
  s = s.replace(/\^\{([^{}]*)\}/g, (_, g) => mapChars(g, SUP));
  s = s.replace(/\^([^\s{}\\])/g, (_, g) => mapChars(g, SUP));

  // Any remaining backslash-command we don't specifically know becomes
  // its bare name (\log -> log) rather than being dropped silently.
  s = s.replace(/\\([a-zA-Z]+)/g, "$1");
  s = s.replace(/[{}]/g, "");
  // Defensive catch-all: any stray backslash left over at this point
  // (an unrecognised spacing/formatting command) contributes nothing
  // visible rather than leaking a literal "\" into the text.
  s = s.replace(/\\/g, "");

  // Bare "-" at this point is always a mathematical minus, not a hyphen.
  s = s.replace(/-/g, "−");

  // Space out binary-operator-style symbols for readability, matching
  // how these are normally typeset (e.g. "2.5×10⁻³" -> "2.5 × 10⁻³").
  s = s.replace(/\s*([×·→⇌↔±≈≠])\s*/g, " $1 ");
  s = s.replace(/\s*=\s*/g, " = ").replace(/\s+/g, " ").trim();
  return s;
}
const MO_SYMBOL_MAP = { "-": "−", "*": "×", "·": "·" };

/** Fallback for a <math> element that has no <annotation> (semantic LaTeX
 * source) to work from — walks the *presentation* MathML directly so the
 * equation still gets neutralised into plain scaling text instead of
 * being left as browser-native math layout. Less precise than the LaTeX
 * path (no spacing/symbol normalisation beyond the basics) but never
 * leaves the maths un-converted. */
function presentationMathMLToText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "annotation" || tag === "annotation-xml") return "";
  const children = () => [...node.childNodes].map(presentationMathMLToText).join("");
  if (tag === "msup" || tag === "mover") {
    const parts = [...node.children].filter((c) => c.tagName?.toLowerCase() !== "annotation");
    return (parts[0] ? presentationMathMLToText(parts[0]) : "") + mapChars(parts[1] ? presentationMathMLToText(parts[1]) : "", SUP);
  }
  if (tag === "msub" || tag === "munder") {
    const parts = [...node.children];
    return (parts[0] ? presentationMathMLToText(parts[0]) : "") + mapChars(parts[1] ? presentationMathMLToText(parts[1]) : "", SUB);
  }
  if (tag === "msubsup" || tag === "munderover") {
    const parts = [...node.children];
    return (parts[0] ? presentationMathMLToText(parts[0]) : "") + mapChars(parts[1] ? presentationMathMLToText(parts[1]) : "", SUB) + mapChars(parts[2] ? presentationMathMLToText(parts[2]) : "", SUP);
  }
  if (tag === "mfrac") {
    const parts = [...node.children];
    return `(${parts[0] ? presentationMathMLToText(parts[0]) : ""})/(${parts[1] ? presentationMathMLToText(parts[1]) : ""})`;
  }
  if (tag === "msqrt" || tag === "mroot") return `√(${children()})`;
  if (tag === "mspace") return " ";
  if (tag === "mo") {
    const t = children().trim();
    return MO_SYMBOL_MAP[t] ?? t;
  }
  return children();
}

/** Finds every <math> element (KaTeX/MathML's root, regardless of
 * whether a semantic <annotation> is present) and replaces its nearest
 * display wrapper with converted plain text, IN PLACE, before any other
 * processing touches the tree — so the maths is preserved and
 * converted, never silently deleted, and never left as native math
 * layout that Display Settings' text-size can't reach. */
function resolveMathAnnotations(doc) {
  const mathNodes = [...doc.querySelectorAll("math")];
  for (const mathEl of mathNodes) {
    // Prefer the full "display equation" wrapper when present (KaTeX
    // wraps block-mode equations in an outer .katex-display element,
    // which is what actually carries any auto-centering) — replacing
    // just the inner .katex span would leave that wrapper (and its
    // centering) behind.
    const root = mathEl.closest?.(".katex-display") || mathEl.closest?.('[class*="katex"]') || mathEl;
    if (!root || !root.parentNode) continue;
    const annotation = mathEl.querySelector("annotation");
    const annotationLatex = annotation?.textContent?.trim();
    // Preserve real equation structure from KaTeX/MathML instead of
    // flattening fractions into plain text.  The student renderer turns
    // this lightweight marker into compact inline maths.
    const converted = annotationLatex
      ? `⟦math:${annotationLatex}⟧`
      : presentationMathMLToText(mathEl).replace(/\s*=\s*/g, " = ").replace(/,(?=\S)/g, ", ").replace(/\s+/g, " ").trim();
    root.parentNode.replaceChild(doc.createTextNode(converted), root);
  }

  // Defensive fallback: any KaTeX-classed wrapper that somehow has no
  // <math> inside at all (e.g. a source that only ever emitted the
  // visible-HTML branch) still gets flattened to plain text rather than
  // left as unstyled nested spans.
  for (const el of [...doc.querySelectorAll('[class*="katex"]')]) {
    if (!el.parentNode) continue;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    el.parentNode.replaceChild(doc.createTextNode(text), el);
  }
}

const HIDDEN_CLASS_PATTERN = /(^|\s)(sr-only|visually-hidden|screen-reader-text|visuallyhidden)(\s|$)/i;

/** Generic accessibility-only duplicate content unrelated to maths (e.g.
 * a plain "visually hidden" caption some tool adds) — narrow on purpose,
 * since maths is now handled by resolveMathAnnotations() above rather
 * than by skipping nodes and hoping the right text is left over. */
function isHiddenDuplicateNode(node) {
  const cls = typeof node.className === "string" ? node.className : node.getAttribute?.("class") || "";
  if (HIDDEN_CLASS_PATTERN.test(cls)) return true;
  const style = node.getAttribute?.("style") || "";
  if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
  return false;
}

function htmlToChemText(html) {
  if (!html || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  resolveMathAnnotations(doc);
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (isHiddenDuplicateNode(node)) return "";
    const tag = node.tagName.toLowerCase();
    const children = () => [...node.childNodes].map(walk).join("");
    const verticalAlign = node.style?.verticalAlign || "";
    if (tag === "sub" || verticalAlign === "sub") return mapChars(children(), SUB);
    if (tag === "sup" || verticalAlign === "super") return mapChars(children(), SUP);
    if (tag === "br") return "\n";
    if (tag === "msub") {
      const parts = [...node.children]; return (parts[0] ? walk(parts[0]) : "") + mapChars(parts[1] ? walk(parts[1]) : "", SUB);
    }
    if (tag === "msup") {
      const parts = [...node.children]; return (parts[0] ? walk(parts[0]) : "") + mapChars(parts[1] ? walk(parts[1]) : "", SUP);
    }
    if (tag === "msubsup") {
      const parts = [...node.children]; return (parts[0] ? walk(parts[0]) : "") + mapChars(parts[1] ? walk(parts[1]) : "", SUB) + mapChars(parts[2] ? walk(parts[2]) : "", SUP);
    }
    if (tag === "mfrac") {
      const parts = [...node.children]; return `(${parts[0] ? walk(parts[0]) : ""})/(${parts[1] ? walk(parts[1]) : ""})`;
    }
    if (tag === "msqrt") return `√(${children()})`;
    const text = children();
    return ["p","div","li","tr"].includes(tag) ? `${text}\n` : text;
  };
  return walk(doc.body).replace(/\n{3,}/g, "\n\n").trimEnd();
}

/** Same math-resolution pass as the plain-text paste path, but operating
 * on (and returning) an HTML string — used by the Rich Text editor,
 * which needs to keep real formatting (bold/lists/etc) but must NOT keep
 * KaTeX's rendered DOM: that produces dozens of non-semantic spacer
 * spans that look right but can't be edited like normal text. Equations
 * are resolved to plain Unicode text nodes first; everything else about
 * the pasted HTML (formatting, links, line breaks) is left untouched for
 * the caller to sanitize/insert as usual. */
export function resolveMathAnnotationsInHtml(html) {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  resolveMathAnnotations(doc);
  return doc.body.innerHTML;
}

export function getEquationFriendlyClipboardText(event) {
  const html = event.clipboardData?.getData("text/html") || "";
  const rich = htmlToChemText(html);
  return rich || event.clipboardData?.getData("text/plain") || "";
}

export function pasteEquationFriendly(event, value, onChange) {
  const pasted = getEquationFriendlyClipboardText(event);
  if (!pasted) return;
  event.preventDefault();
  const el = event.currentTarget;
  const start = el.selectionStart ?? String(value ?? "").length;
  const end = el.selectionEnd ?? start;
  const next = `${String(value ?? "").slice(0, start)}${pasted}${String(value ?? "").slice(end)}`;
  onChange(next);
  requestAnimationFrame(() => {
    try { el.selectionStart = el.selectionEnd = start + pasted.length; } catch { /* input type may not support selection */ }
  });
}

// ---------------------------------------------------------------------
// Compact "Symbols / Equation" toolbar -- inserts at the cursor position
// rather than requiring the teacher to memorise LaTeX commands. Templates
// (fraction, superscript, subscript, ×10ⁿ) insert an editable snippet and
// place the cursor where the first thing typed should go, using the SAME
// \( \) / \[ \] delimiters the shared renderer (scientificContent.jsx)
// now understands directly -- so nothing typed through this toolbar ever
// needs the ⟦math:...⟧ marker syntax.
// ---------------------------------------------------------------------
const SYMBOL_GROUPS = [
  { label: "Greek", items: [["λ", "λ"], ["ν", "ν"], ["Δ", "Δ"], ["α", "α"], ["β", "β"], ["γ", "γ"], ["μ", "μ"], ["π", "π"], ["θ", "θ"], ["Ω", "Ω"]] },
  { label: "Operators", items: [["×", "×"], ["÷", "÷"], ["±", "±"], ["≈", "≈"], ["≠", "≠"], ["≤", "≤"], ["≥", "≥"], ["∝", "∝"], ["→", "→"], ["⇌", "⇌"]] },
  { label: "Common science", items: [["°C", "°C"], ["mol dm⁻³", "mol dm⁻³"], ["m s⁻¹", "m s⁻¹"], ["kJ mol⁻¹", "kJ mol⁻¹"]] },
];

// Structure/template snippets are inserted as \( \)-delimited LaTeX so
// they render immediately through the same pipeline as everything else.
// `cursor` is the offset (within `insert`) where the caret should land
// after insertion -- e.g. right inside the first {} of a fraction.
const STRUCTURE_TEMPLATES = [
  { label: "x²", insert: "\\(x^2\\)", cursor: 7 },
  { label: "xⁿ", insert: "\\(x^{}\\)", cursor: 5 },
  { label: "x₁", insert: "\\(x_{}\\)", cursor: 5 },
  { label: "Fraction", insert: "\\(\\frac{}{}\\)", cursor: 8 },
  { label: "10ˣ", insert: "\\(10^{}\\)", cursor: 6 },
  { label: "√x", insert: "\\(\\sqrt{}\\)", cursor: 8 },
];

const EQUATION_TEMPLATES = [
  { label: "Inline Equation", insert: "\\(\\)", cursor: 2 },
  { label: "Display Equation", insert: "\n\\[\n\n\\]\n", cursor: 4 },
];

function insertAtCursor(el, value, onChange, snippet, cursorOffset) {
  const start = el?.selectionStart ?? String(value ?? "").length;
  const end = el?.selectionEnd ?? start;
  const before = String(value ?? "").slice(0, start);
  const after = String(value ?? "").slice(end);
  onChange(`${before}${snippet}${after}`);
  const nextCursor = start + (cursorOffset ?? snippet.length);
  requestAnimationFrame(() => {
    try { el.focus(); el.selectionStart = el.selectionEnd = nextCursor; } catch { /* input type may not support selection */ }
  });
}

function EquationToolbar({ targetRef, value, onChange }) {
  const [open, setOpen] = useState(false);
  const insert = (snippet, cursorOffset) => insertAtCursor(targetRef.current, value, onChange, snippet, cursorOffset);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Scientific symbols and equations"
        className="flex items-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-indigo)] hover:text-[var(--color-indigo)]"
      >
        <Sigma size={12} /> Symbols / Equation
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-[280px] rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-2.5 shadow-lg">
          {SYMBOL_GROUPS.map((group) => (
            <div key={group.label} className="mb-2 last:mb-0">
              <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {group.items.map(([label, char]) => (
                  <button key={label} type="button" onClick={() => insert(char, char.length)} className="min-w-[26px] rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mb-2">
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Structure</p>
            <div className="flex flex-wrap gap-1">
              {STRUCTURE_TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => insert(t.insert, t.cursor)} className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Equation</p>
            <div className="flex flex-wrap gap-1">
              {EQUATION_TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => insert(t.insert, t.cursor)} className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-xs text-[var(--color-ink)] hover:border-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)]">
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** An ordinary textarea, plus a compact symbol/equation toolbar and a
 * live preview -- the same rendering pipeline the student page uses
 * (scientificContent.jsx), so what the admin sees in preview is exactly
 * what the student will see (section 12's requirement). Pasted content
 * (after conversion above) still lands as plain editable characters:
 * click anywhere, select part of it, delete/retype, Enter for a new
 * line, all standard textarea behaviour. Nothing here ever creates a
 * non-editable "equation object". */
export default function EquationFriendlyField({ value = "", onChange, className = "", rows = 2, showToolbar = true, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 42)}px`;
  }, [value]);

  const hasMath = containsScientificMarkup(value);

  return (
    <div className="flex flex-col gap-1">
      {showToolbar && <EquationToolbar targetRef={ref} value={value} onChange={(next) => onChange?.(next)} />}
      <textarea
        ref={ref}
        rows={rows}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        onPaste={(e) => pasteEquationFriendly(e, value, (next) => onChange?.(next))}
        className={`${className} resize-y overflow-hidden font-[inherit]`}
        {...props}
      />
      {hasMath && (
        <div className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)]/60 px-2.5 py-1.5">
          <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Preview</p>
          <ScientificText text={value} className="text-sm text-[var(--color-ink)]" />
        </div>
      )}
    </div>
  );
}
