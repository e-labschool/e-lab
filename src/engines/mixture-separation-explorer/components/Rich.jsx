// Glossary tooltips. <Term id="solubility"> is a button that shows the definition on hover, focus or tap (and closes on Escape);
// <Rich text="..."/> turns the first occurrence of every glossary word in a plain string into a <Term>.
import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY, splitTerms } from "../model/glossary.js";

export function Term({ id, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const tipId = useId();
  const ref = useRef(null);
  const btnRef = useRef(null);
  const tipRef = useRef(null);
  const def = GLOSSARY[id];
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("pointerdown", onDown, true); };
  }, [open]);
  // The tooltip is portalled INTO the dashboard root (so it also shows in real fullscreen and is not clipped by the panels).
  const root = open ? btnRef.current?.closest(".sd-root") : null;
  useLayoutEffect(() => {
    if (!open || !root || !btnRef.current) { setPos(null); return; }
    const rr = root.getBoundingClientRect(); const br = btnRef.current.getBoundingClientRect();
    const w = Math.min(280, rr.width - 12); const h = tipRef.current?.offsetHeight ?? 90;
    const left = Math.max(6, Math.min(br.left - rr.left, rr.width - w - 6));
    const below = br.bottom - rr.top + 6; const above = br.top - rr.top - h - 6;
    setPos({ left, top: below + h > rr.height - 4 && above > 4 ? above : below, w });
  }, [open, root, id]);
  if (!def) return <>{children ?? id}</>;
  return (
    <span className="ms-term-wrap" ref={ref} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button ref={btnRef} type="button" className="ms-term" aria-describedby={open ? tipId : undefined} aria-expanded={open} onClick={() => setOpen((v) => !v)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} data-testid={`term-${id.replace(/\s+/g, "-")}`}>
        {children ?? id}
      </button>
      {open && root && createPortal(<span ref={tipRef} role="tooltip" id={tipId} className="ms-tip" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: pos?.w ?? 260, visibility: pos ? "visible" : "hidden" }}><strong>{id}</strong>{def}</span>, root)}
    </span>
  );
}

export function Rich({ text, skip }) {
  const parts = useMemo(() => splitTerms(text, skip), [text, skip]);
  return <>{parts.map((p, i) => (p.term ? <Term key={i} id={p.term}>{p.text}</Term> : <Fragment key={i}>{p.text}</Fragment>))}</>;
}
