import { Maximize2 } from "lucide-react";
import { useImageLightbox } from "./ImageLightbox.jsx";

/** Turns a <canvas>, inline <svg>, or image URL into a URL the lightbox can
 * show. Canvas -> PNG data URL; SVG -> serialised data URL. Returns "" when
 * the graphic cannot be exported (e.g. a tainted cross-origin canvas, WebGL
 * without preserveDrawingBuffer). */
export function graphicToImageSrc(target) {
  if (!target) return "";
  if (typeof target === "string") return target;
  try {
    const tag = String(target.tagName || "").toLowerCase();
    if (tag === "canvas") return target.toDataURL("image/png");
    if (tag === "svg") {
      const clone = target.cloneNode(true);
      if (!clone.getAttribute("xmlns")) clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      const box = target.getBoundingClientRect?.();
      if (!clone.getAttribute("width") && box?.width) clone.setAttribute("width", String(Math.round(box.width)));
      if (!clone.getAttribute("height") && box?.height) clone.setAttribute("height", String(Math.round(box.height)));
      const xml = new XMLSerializer().serializeToString(clone);
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    }
    if (tag === "img") return target.currentSrc || target.src || "";
  } catch { /* fall through */ }
  return "";
}

/** Small reusable "Enlarge" button for NON-image graphics (simulation
 * canvases, SVG charts) that cannot be treated as ordinary <img>s.
 *
 * Usage (from a simulation, without touching shared viewer code):
 *   const chartRef = useRef(null);
 *   <svg ref={chartRef} ...>...</svg>
 *   <EnlargeGraphicButton getTarget={() => chartRef.current} label="Z vs P graph" />
 *
 * getTarget is called at click time, so the snapshot reflects the CURRENT
 * state of the graphic. It may return a canvas, an <svg>, an <img> or a URL
 * string. The snapshot is a static image (not live) and, like any image in
 * the viewer, can be zoomed and panned. Renders nothing outside an
 * ImageLightboxProvider. */
export default function EnlargeGraphicButton({ getTarget, label = "graphic", className = "" }) {
  const lightbox = useImageLightbox();
  if (!lightbox) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        const src = graphicToImageSrc(getTarget?.());
        if (src) lightbox.open({ src, alt: label, trigger: e.currentTarget });
      }}
      aria-label={`Enlarge ${label}`}
      title={`Enlarge ${label}`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-indigo)] ${className}`}
    >
      <Maximize2 size={15} />
    </button>
  );
}
