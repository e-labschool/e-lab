import { useEffect, useRef } from "react";

const SUB = {0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉","+":"₊","-":"₋","=":"₌","(":"₍",")":"₎",a:"ₐ",e:"ₑ",h:"ₕ",i:"ᵢ",j:"ⱼ",k:"ₖ",l:"ₗ",m:"ₘ",n:"ₙ",o:"ₒ",p:"ₚ",r:"ᵣ",s:"ₛ",t:"ₜ",u:"ᵤ",v:"ᵥ",x:"ₓ"};
const SUP = {0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹","+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾",n:"ⁿ",i:"ⁱ"};
const mapChars = (text, map) => [...String(text ?? "")].map((ch) => map[ch] ?? ch).join("");

function htmlToChemText(html) {
  if (!html || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
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
