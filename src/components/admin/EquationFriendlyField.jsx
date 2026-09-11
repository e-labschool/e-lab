import { useEffect, useRef } from "react";

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

  // Bare "-" at this point is always a mathematical minus, not a hyphen.
  s = s.replace(/-/g, "−");

  // Space out binary-operator-style symbols for readability, matching
  // how these are normally typeset (e.g. "2.5×10⁻³" -> "2.5 × 10⁻³").
  s = s.replace(/\s*([×·→⇌↔±≈≠])\s*/g, " $1 ");
  s = s.replace(/\s*=\s*/g, " = ").replace(/\s+/g, " ").trim();
  return s;
}
/** Finds every <annotation> (KaTeX/MathML's raw-source element) and
 * replaces its nearest .katex/<math> ancestor with the converted plain
 * text, IN PLACE, before any other processing touches the tree — so the
 * maths is preserved and converted, never silently deleted, and never
 * left duplicated alongside the visible rendering it replaces. */
function resolveMathAnnotations(doc) {
  const annotations = [...doc.querySelectorAll("annotation")];
  for (const annotation of annotations) {
    const root = annotation.closest?.('[class*="katex"]') || annotation.closest?.("math") || annotation.parentElement;
    if (!root || !root.parentNode) continue;
    const converted = convertLatexToUnicode(annotation.textContent || "");
    root.parentNode.replaceChild(doc.createTextNode(converted), root);
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

/** A completely ordinary textarea — this is the whole point. Pasted
 * content (after conversion above) lands as plain editable characters:
 * click anywhere, select part of it, delete/retype, Enter for a new
 * line, all standard textarea behaviour. Nothing here ever creates a
 * non-editable "equation object". */
export default function EquationFriendlyField({ value = "", onChange, className = "", rows = 2, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 42)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      onPaste={(e) => pasteEquationFriendly(e, value, (next) => onChange?.(next))}
      className={`${className} resize-y overflow-hidden font-[inherit]`}
      {...props}
    />
  );
}
