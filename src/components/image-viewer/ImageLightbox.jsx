import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import {
  BUTTON_ZOOM_STEP, MAX_SCALE, MIN_SCALE, clampPan, fitSize, pinchView, wheelZoomFactor, zoomAround,
} from "./imageViewerCore.js";

// ---------------------------------------------------------------------------
// Shared Image Lightbox.
//
//   <ImageLightboxProvider> ... student pages ... </ImageLightboxProvider>
//   const lightbox = useImageLightbox();   // null outside a provider
//   lightbox.open({ src, originalSrc, alt, caption, trigger })
//
// Almost nothing should call open() directly -- use <ZoomableImage> for JSX
// images, <ZoomableHtml> for rich-text HTML, <EnlargeGraphicButton> for
// canvas/SVG graphics. Outside a provider (admin editor, teacher surfaces)
// all of those render plain, inert images: the viewer is student-only.
// ---------------------------------------------------------------------------

const LightboxContext = createContext(null);
export function useImageLightbox() { return useContext(LightboxContext); }

const Z = 2147483000; // above nav (z-40), sidebars, modals (z-50)
const TOOLBAR_RESERVE = 56; // px kept clear above the fitted image for the toolbar
const IDLE_VIEW = { scale: MIN_SCALE, x: 0, y: 0 };

export function ImageLightboxProvider({ children }) {
  const [image, setImage] = useState(null);
  const triggerRef = useRef(null);

  const openRef = useRef(false);
  const close = useCallback(() => { openRef.current = false; setImage(null); }, []);
  const open = useCallback((next) => {
    if (!next?.src) return;
    const active = typeof document !== "undefined" ? document.activeElement : null;
    const trigger = next.trigger || active;
    if (!openRef.current) triggerRef.current = trigger && trigger !== document.body ? trigger : null;
    openRef.current = true;
    setImage({ src: next.src, originalSrc: next.originalSrc || next.src, alt: next.alt || "", caption: next.caption || "" });
  }, []);

  // Return focus to the originating image once the overlay unmounts.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (image) { wasOpen.current = true; return; }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const el = triggerRef.current;
    triggerRef.current = null;
    if (el && el.isConnected && typeof el.focus === "function") el.focus({ preventScroll: true });
  }, [image]);

  // Context value never changes identity -> opening the viewer re-renders
  // only this provider, never the lesson/question tree below it.
  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <LightboxContext.Provider value={value}>
      {children}
      {image && typeof document !== "undefined" && createPortal(<LightboxOverlay image={image} onClose={close} />, document.body)}
    </LightboxContext.Provider>
  );
}

// Reference-counted body scroll lock (overflow only -> scroll position of the
// page underneath is never touched; scrollbar width is compensated).
let lockCount = 0; let savedOverflow = ""; let savedPadding = "";
export function lockBodyScroll() {
  if (typeof document === "undefined") return () => {};
  const body = document.body;
  if (lockCount === 0) {
    savedOverflow = body.style.overflow; savedPadding = body.style.paddingRight;
    const gap = typeof window !== "undefined" ? window.innerWidth - document.documentElement.clientWidth : 0;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  }
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return; released = true;
    lockCount -= 1;
    if (lockCount === 0) { body.style.overflow = savedOverflow; body.style.paddingRight = savedPadding; }
  };
}

const btn = "inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white disabled:opacity-40 disabled:hover:bg-transparent";

function LightboxOverlay({ image, onClose }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const closeRef = useRef(null);
  const [view, setViewState] = useState(IDLE_VIEW);
  const viewRef = useRef(IDLE_VIEW);
  const [fit, setFit] = useState(null);
  const fitRef = useRef(null);
  const [src, setSrc] = useState(image.originalSrc);
  const [failed, setFailed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const setView = useCallback((v) => { viewRef.current = v; setViewState(v); }, []);
  useEffect(() => { fitRef.current = fit; }, [fit]);

  const metrics = useCallback(() => {
    const stageEl = stageRef.current; const imgEl = imgRef.current;
    const stage = { w: stageEl?.clientWidth || 0, h: stageEl?.clientHeight || 0 };
    const base = fitRef.current || { w: imgEl?.offsetWidth || 0, h: imgEl?.offsetHeight || 0 };
    return { stage, base };
  }, []);

  const recomputeFit = useCallback(() => {
    const imgEl = imgRef.current; const stageEl = stageRef.current;
    if (!imgEl || !stageEl) return;
    const next = fitSize({ w: imgEl.naturalWidth, h: imgEl.naturalHeight }, { w: stageEl.clientWidth, h: stageEl.clientHeight }, 16, 3, TOOLBAR_RESERVE);
    fitRef.current = next; setFit(next);
    const { stage, base } = metrics();
    const v = viewRef.current;
    setView({ scale: v.scale, ...clampPan(v, v.scale, stage, base) });
  }, [metrics, setView]);

  useEffect(() => {
    window.addEventListener("resize", recomputeFit);
    return () => window.removeEventListener("resize", recomputeFit);
  }, [recomputeFit]);

  // Scroll lock, initial focus.
  useLayoutEffect(() => {
    const release = lockBodyScroll();
    closeRef.current?.focus({ preventScroll: true });
    return release;
  }, []);

  const zoomTo = useCallback((nextScale, anchor = { x: 0, y: 0 }) => {
    const { stage, base } = metrics();
    setView(zoomAround(viewRef.current, nextScale, anchor, stage, base));
  }, [metrics, setView]);
  const zoomIn = useCallback(() => zoomTo(viewRef.current.scale * BUTTON_ZOOM_STEP), [zoomTo]);
  const zoomOut = useCallback(() => zoomTo(viewRef.current.scale / BUTTON_ZOOM_STEP), [zoomTo]);
  const reset = useCallback(() => setView(IDLE_VIEW), [setView]);

  const relToCentre = useCallback((clientX, clientY) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: clientX - (r.left + r.width / 2), y: clientY - (r.top + r.height / 2) };
  }, []);

  // Wheel / trackpad zoom -- native, non-passive so the page never scrolls.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      zoomTo(viewRef.current.scale * wheelZoomFactor(e), relToCentre(e.clientX, e.clientY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo, relToCentre]);

  // Keyboard: Escape closes, +/-/0 zoom, arrows pan, Tab is trapped.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onClose(); return; }
      if (e.key === "Tab") {
        const root = rootRef.current; if (!root) return;
        const items = [...root.querySelectorAll("button:not([disabled])")];
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0]; const last = items[items.length - 1];
        const active = document.activeElement;
        if (!root.contains(active)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
      else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomOut(); }
      else if (e.key === "0") { e.preventDefault(); reset(); }
      else if (e.key.startsWith("Arrow") && viewRef.current.scale > 1) {
        e.preventDefault();
        const step = 60; const v = viewRef.current; const { stage, base } = metrics();
        const dx = e.key === "ArrowLeft" ? step : e.key === "ArrowRight" ? -step : 0;
        const dy = e.key === "ArrowUp" ? step : e.key === "ArrowDown" ? -step : 0;
        setView({ scale: v.scale, ...clampPan({ x: v.x + dx, y: v.y + dy }, v.scale, stage, base) });
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, zoomIn, zoomOut, reset, metrics, setView]);

  // Keep focus inside the dialog if something outside grabs it.
  useEffect(() => {
    const onFocusIn = (e) => {
      const root = rootRef.current;
      if (root && !root.contains(e.target)) closeRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  // ---- pointer gestures (pan + pinch) -----------------------------------
  const pointers = useRef(new Map());
  const gesture = useRef({ mode: null, startView: null, startPt: null, pinch: null });
  const flags = useRef({ moved: false, downOnBackdrop: false, pointerSeen: false });

  const onPointerDown = (e) => {
    // Remember what was REALLY pressed: after setPointerCapture the browser
    // retargets the following click to the stage, so click.target alone
    // cannot tell a backdrop tap from a tap on the image.
    flags.current.downOnBackdrop = e.target === e.currentTarget;
    flags.current.pointerSeen = true;
    if (pointers.current.size === 0) flags.current.moved = false;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      flags.current.moved = true;
      const v = viewRef.current;
      const mid = relToCentre((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      gesture.current = { mode: "pinch", pinch: { ...v, dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1, mid } };
    } else if (pts.length === 1) {
      gesture.current = { mode: "pan", startView: viewRef.current, startPt: { x: e.clientX, y: e.clientY } };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { stage, base } = metrics();
    const g = gesture.current;
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const rel = (p) => relToCentre(p.x, p.y);
      setView(pinchView(g.pinch, rel(a), rel(b), stage, base));
    } else if (g.mode === "pan") {
      const dx = e.clientX - g.startPt.x; const dy = e.clientY - g.startPt.y;
      if (Math.hypot(dx, dy) > 6) flags.current.moved = true;
      if (g.startView.scale > 1) {
        setDragging(true);
        setView({ scale: g.startView.scale, ...clampPan({ x: g.startView.x + dx, y: g.startView.y + dy }, g.startView.scale, stage, base) });
      }
    }
  };

  const onPointerEnd = (e) => {
    pointers.current.delete(e.pointerId);
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const left = [...pointers.current.values()];
    if (left.length === 1) {
      // pinch -> pan hand-over without a jump
      gesture.current = { mode: "pan", startView: viewRef.current, startPt: left[0] };
    } else if (left.length === 0) {
      gesture.current = { mode: null };
      setDragging(false);
    }
  };

  // Backdrop (not image, not controls) closes -- but never after a drag /
  // pinch that merely happened to end on the backdrop.
  const pressedBackdrop = (e) => (flags.current.pointerSeen ? flags.current.downOnBackdrop : e.target === e.currentTarget);
  const onStageClick = (e) => {
    const onBackdrop = pressedBackdrop(e);
    flags.current.pointerSeen = false;
    if (!onBackdrop) return;
    if (flags.current.moved) { flags.current.moved = false; return; }
    onClose();
  };

  const onDoubleClick = (e) => {
    if (pressedBackdrop(e)) return;
    if (viewRef.current.scale > 1) reset(); else zoomTo(2.5, relToCentre(e.clientX, e.clientY));
  };

  const label = image.alt ? `Enlarged image: ${image.alt}` : "Enlarged image";
  const zoomPct = Math.round(view.scale * 100);
  const imgStyle = {
    transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
    transformOrigin: "center center",
    marginTop: TOOLBAR_RESERVE,
    ...(fit ? { width: fit.w, height: fit.h } : { maxWidth: "calc(100% - 32px)", maxHeight: `calc(100% - ${32 + TOOLBAR_RESERVE}px)` }),
    objectFit: "contain",
    touchAction: "none",
    userSelect: "none",
    cursor: view.scale > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
    transition: dragging ? "none" : "transform 90ms ease-out",
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-image-lightbox=""
      style={{ position: "fixed", inset: 0, zIndex: Z, background: "rgba(8, 10, 16, 0.86)", overscrollBehavior: "contain" }}
    >
      <div
        ref={stageRef}
        data-lightbox-stage=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onStageClick}
        onDoubleClick={onDoubleClick}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none" }}
      >
        {failed ? (
          <p style={{ color: "#fff" }} className="rounded-md bg-black/60 px-4 py-3 text-sm">This image could not be loaded.</p>
        ) : (
          <img
            ref={imgRef}
            src={src}
            alt={image.alt}
            draggable={false}
            onLoad={recomputeFit}
            onError={() => {
              if (src !== image.src) { setSrc(image.src); setFit(null); fitRef.current = null; } else setFailed(true);
            }}
            style={imgStyle}
          />
        )}
      </div>

      <div
        style={{ position: "absolute", top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))", display: "flex", gap: 4, alignItems: "center", borderRadius: 8, background: "rgba(20,24,34,0.82)", padding: 4 }}
      >
        <button type="button" className={btn} onClick={zoomOut} disabled={view.scale <= MIN_SCALE} aria-label="Zoom out"><ZoomOut size={18} /></button>
        <button type="button" className={`${btn} w-14 text-xs font-semibold tabular-nums`} onClick={reset} aria-label={`Reset zoom (currently ${zoomPct}%)`} disabled={view.scale === 1 && view.x === 0 && view.y === 0}>{zoomPct}%</button>
        <button type="button" className={btn} onClick={zoomIn} disabled={view.scale >= MAX_SCALE} aria-label="Zoom in"><ZoomIn size={18} /></button>
        <button ref={closeRef} type="button" className={btn} onClick={onClose} aria-label="Close image viewer"><X size={20} /></button>
      </div>

      {image.caption && (
        <p style={{ position: "absolute", left: 0, right: 0, bottom: "max(10px, env(safe-area-inset-bottom))", margin: "0 auto", maxWidth: "min(720px, calc(100% - 24px))", pointerEvents: "none", color: "#fff", background: "rgba(20,24,34,0.72)" }} className="w-fit rounded-md px-3 py-1.5 text-center text-xs">
          {image.caption}
        </p>
      )}
    </div>
  );
}
