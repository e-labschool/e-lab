// The asset-driven architecture's core: every piece of apparatus is a
// plain config object (image + position/size/rotation + named anchors
// in FRACTIONAL local coordinates), never a hand-drawn shape. Swapping
// in a final rendered asset later means changing this config, never the
// simulation component.
//
// anchors: { anchorName: { fx, fy } } -- fx/fy are 0-1 fractions of the
// asset's OWN width/height, in its unrotated local space (e.g. a
// beaker's pour lip might be { fx: 0.92, fy: 0.02 }: near the top-right
// corner). This is what lets the same anchor definition keep working
// regardless of the asset's actual on-screen size or rotation.
import { rotatePoint } from "../../lib/geometry.js";

/** Resolves one named anchor of an asset into SCENE (absolute)
 * coordinates, accounting for the asset's rotation around its own
 * transformOrigin -- reuses the same rotatePoint() already verified for
 * the SVG apparatus, so a rotated asset's anchors are computed with the
 * exact same geometry its visual rotation uses, never a separate
 * approximation. */
export function resolveAnchor(asset, anchorKey) {
  const frac = asset.anchors?.[anchorKey];
  if (!frac) return null;
  const local = { x: asset.x + frac.fx * asset.width, y: asset.y + frac.fy * asset.height };
  if (!asset.rotation) return local;
  const originFx = asset.transformOrigin?.fx ?? 0.5;
  const originFy = asset.transformOrigin?.fy ?? 1;
  const pivot = { x: asset.x + originFx * asset.width, y: asset.y + originFy * asset.height };
  return rotatePoint(local, pivot, asset.rotation);
}

/** The CSS transform-origin string matching an asset's fractional
 * transformOrigin, so the rendered <img>'s rotation pivots around
 * exactly the point resolveAnchor() assumes. */
export function transformOriginCSS(asset) {
  const fx = (asset.transformOrigin?.fx ?? 0.5) * 100;
  const fy = (asset.transformOrigin?.fy ?? 0.5) * 100;
  return `${fx}% ${fy}%`;
}
