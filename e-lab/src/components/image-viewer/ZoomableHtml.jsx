import { useLayoutEffect, useRef } from "react";
import { useImageLightbox } from "./ImageLightbox.jsx";
import { getImageOriginalSrc, isZoomEligibleImage } from "./imageViewerCore.js";

/** Rich-text HTML container (dangerouslySetInnerHTML) with delegated image
 * zoom: ONE click/keydown listener on the container, no per-image React
 * wiring. After the HTML is committed, eligible <img> elements only gain
 * attributes (tabindex, role, aria-label, data-zoomable-image) -- nothing in
 * the DOM structure, classes, inline styles or float behaviour changes, so
 * text wrapping is identical. Inert without an ImageLightboxProvider.
 * Images inside links, [data-no-zoom], or marked presentational are skipped. */
export default function ZoomableHtml({ html, as: Tag = "div", ...rest }) {
  const lightbox = useImageLightbox();
  const ref = useRef(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !lightbox) return;
    root.querySelectorAll("img").forEach((img) => {
      if (!isZoomEligibleImage(img)) return;
      const alt = img.getAttribute("alt") || "";
      img.setAttribute("data-zoomable-image", "");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", alt ? `Enlarge image: ${alt}` : "Enlarge image");
    });
  }, [html, lightbox]);

  const imgFromEvent = (e) => {
    if (!lightbox) return null;
    const img = e.target?.closest?.("img[data-zoomable-image]");
    return img && ref.current?.contains(img) ? img : null;
  };
  const openFor = (img) => lightbox.open({
    src: img.getAttribute("src") || img.currentSrc,
    originalSrc: getImageOriginalSrc(img),
    alt: img.getAttribute("alt") || "",
    trigger: img,
  });

  return (
    <Tag
      {...rest}
      ref={ref}
      onClick={(e) => { const img = imgFromEvent(e); if (img) { e.preventDefault(); e.stopPropagation(); openFor(img); } }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        const img = imgFromEvent(e);
        if (img && e.target === img) { e.preventDefault(); e.stopPropagation(); openFor(img); }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
