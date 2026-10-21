// Pure, DOM-free helpers behind the shared Image Lightbox. Kept in a plain
// .js file so the Node/jsdom test-suite can exercise the REAL production
// maths (zoom clamp, pan clamp, pinch/anchored zoom, original-source
// resolution) without any React/JSX.

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
export const BUTTON_ZOOM_STEP = 1.5;

export function clampScale(scale, min = MIN_SCALE, max = MAX_SCALE) {
  if (!Number.isFinite(scale)) return min;
  return Math.min(max, Math.max(min, scale));
}

/** Largest legal pan offset on one axis: how far the zoomed image overhangs
 * the stage on each side. Zero when the zoomed image still fits (no pan). */
export function maxPanFor(baseSize, scale, stageSize) {
  return Math.max(0, (baseSize * scale - stageSize) / 2);
}

/** Clamps a pan offset so the image can never be dragged out of view.
 * base = fitted (scale 1) displayed size, stage = viewport of the stage. */
export function clampPan(pan, scale, stage, base) {
  const mx = maxPanFor(base.w, scale, stage.w);
  const my = maxPanFor(base.h, scale, stage.h);
  return {
    x: Math.min(mx, Math.max(-mx, Number.isFinite(pan.x) ? pan.x : 0)),
    y: Math.min(my, Math.max(-my, Number.isFinite(pan.y) ? pan.y : 0)),
  };
}

/** Returns the view ({scale,x,y}) after zooming to nextScale while keeping
 * the content point under `anchor` (pointer position relative to the stage
 * CENTRE) stationary. Result is clamped. */
export function zoomAround(view, nextScale, anchor, stage, base) {
  const scale = clampScale(nextScale);
  const ratio = scale / view.scale;
  const pan = {
    x: anchor.x - (anchor.x - view.x) * ratio,
    y: anchor.y - (anchor.y - view.y) * ratio,
  };
  return { scale, ...clampPan(pan, scale, stage, base) };
}

/** Wheel / trackpad delta -> multiplicative zoom factor. ctrlKey is how
 * browsers report a trackpad pinch, which arrives in much smaller deltas. */
export function wheelZoomFactor({ deltaY = 0, deltaMode = 0, ctrlKey = false }) {
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY;
  const k = ctrlKey ? 0.01 : 0.0015;
  return Math.exp(-Math.max(-300, Math.min(300, px)) * k);
}

/** Two-finger pinch: start snapshot + current points -> next view. The
 * content point that was under the starting midpoint follows the current
 * midpoint, so pinch also pans. */
export function pinchView(start, a, b, stage, base) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const scale = clampScale(start.scale * (dist / start.dist));
  const cx = (start.mid.x - start.x) / start.scale;
  const cy = (start.mid.y - start.y) / start.scale;
  return { scale, ...clampPan({ x: mid.x - cx * scale, y: mid.y - cy * scale }, scale, stage, base) };
}

/** Fit an image of natural size into a stage (minus padding) preserving
 * aspect ratio. Upscaling of small rasters is capped so they stay legible
 * without turning into mush. reserveTop keeps room for the toolbar so it never
 * covers the fitted image. Returns null when natural size is unknown. */
export function fitSize(natural, stage, padding = 16, maxUpscale = 3, reserveTop = 0) {
  if (!natural?.w || !natural?.h || !stage?.w || !stage?.h) return null;
  const availW = Math.max(1, stage.w - padding * 2);
  const availH = Math.max(1, stage.h - padding * 2 - reserveTop);
  const k = Math.min(availW / natural.w, availH / natural.h, maxUpscale);
  return { w: Math.round(natural.w * k), h: Math.round(natural.h * k) };
}

/** Picks the widest candidate of an <img srcset>. */
export function pickLargestSrcset(srcset) {
  if (!srcset) return "";
  let best = ""; let bestW = -1;
  for (const part of String(srcset).split(",")) {
    const [url, desc] = part.trim().split(/\s+/);
    if (!url) continue;
    const w = desc ? parseFloat(desc) : 0;
    if (w > bestW) { best = url; bestW = w; }
  }
  return best;
}

/** Resolves the highest-resolution ORIGINAL for a displayed image URL.
 * e-Lab stores Learn/question images as public objects in Supabase Storage
 * (…/storage/v1/object/public/<bucket>/<path>) and keeps no separate
 * thumbnail files, but Supabase's on-the-fly transformer URL
 * (…/storage/v1/render/image/public/<bucket>/<path>?width=…) would yield a
 * resized copy -- so that form is mapped back to the untouched object URL.
 * Anything else (external URLs, data:, blob:) is returned unchanged. */
export function resolveOriginalImageSrc(src) {
  const value = String(src ?? "").trim();
  if (!value || /^(data|blob):/i.test(value)) return value;
  try {
    const url = new URL(value, "http://x.invalid");
    const m = url.pathname.match(/^(.*\/storage\/v1)\/render\/image\/(public|authenticated|sign)\/(.+)$/);
    if (!m) return value;
    if (m[2] !== "public") return value; // signed/auth URLs carry tokens: leave untouched
    const rebuilt = `${m[1]}/object/public/${m[3]}`;
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(value);
    return isAbsolute ? `${url.origin}${rebuilt}` : rebuilt;
  } catch {
    return value;
  }
}

/** Original source for an <img> DOM element: explicit data attribute, then
 * the widest srcset entry, then the Supabase-resolved src. */
export function getImageOriginalSrc(img) {
  if (!img) return "";
  const explicit = img.getAttribute?.("data-original-src") || img.getAttribute?.("data-full-src");
  if (explicit) return resolveOriginalImageSrc(explicit);
  const fromSet = pickLargestSrcset(img.getAttribute?.("srcset"));
  if (fromSet) return resolveOriginalImageSrc(fromSet);
  return resolveOriginalImageSrc(img.getAttribute?.("src") || img.currentSrc || "");
}

export function isZoomEligibleImage(img) {
  if (!img || img.tagName !== "IMG") return false;
  if (!(img.getAttribute("src") || img.getAttribute("srcset"))) return false;
  if (img.closest("[data-no-zoom]")) return false;
  if (img.closest("a[href]")) return false; // keep ordinary link behaviour
  if (img.getAttribute("role") === "presentation" || img.getAttribute("aria-hidden") === "true") return false;
  return true;
}
