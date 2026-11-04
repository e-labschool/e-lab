import { useImageLightbox } from "./ImageLightbox.jsx";
import { resolveOriginalImageSrc } from "./imageViewerCore.js";

/** Drop-in replacement for <img> on student-facing images. Renders the SAME
 * single <img> element with the SAME className (so floated/wrapped layout is
 * untouched) and, inside an ImageLightboxProvider, adds click/tap + keyboard
 * (Enter/Space) activation, role=button, tabindex, accessible name and a
 * focus ring (see [data-zoomable-image] in index.css). Outside a provider it
 * is a plain <img> -- admin editor surfaces stay inert.
 *
 * Clicks are stopped from bubbling and default-prevented so an image inside
 * a <label> (MCQ option) never selects the option. */
export default function ZoomableImage({ src, alt = "", originalSrc, caption, onClick, onKeyDown, ...rest }) {
  const lightbox = useImageLightbox();
  if (!lightbox || !src) return <img src={src} alt={alt} onClick={onClick} onKeyDown={onKeyDown} {...rest} />;

  const open = (el) => lightbox.open({ src, originalSrc: originalSrc || resolveOriginalImageSrc(src), alt, caption, trigger: el });
  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      role="button"
      tabIndex={0}
      aria-label={alt ? `Enlarge image: ${alt}` : "Enlarge image"}
      data-zoomable-image=""
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(e); open(e.currentTarget); }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); e.stopPropagation(); open(e.currentTarget);
        }
      }}
    />
  );
}
