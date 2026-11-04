import { transformOriginCSS } from "./assetConfig.js";

/** Renders one static apparatus image from its config -- position,
 * size, rotation, opacity, stacking order. Swapping the actual artwork
 * later is a change to `asset.src` in assetConfig.js, never to this
 * component or the simulation that uses it.
 *
 * x/y/width/height are PERCENTAGES of the stage container (0-100), not
 * raw pixels -- this is what makes the whole composition scale
 * responsively via plain CSS, without any JS resize/ResizeObserver
 * logic, while the anchor math in assetConfig.js still works
 * identically (rotation angles and fractional anchors are unit-agnostic
 * -- only the final CSS unit differs). */
export default function AssetLayer({ asset }) {
  if (!asset || asset.opacity === 0) return null;
  return (
    <img
      src={asset.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: "absolute",
        left: `${asset.x}%`,
        top: `${asset.y}%`,
        width: `${asset.width}%`,
        height: `${asset.height}%`,
        transform: asset.rotation ? `rotate(${asset.rotation}deg)` : undefined,
        transformOrigin: transformOriginCSS(asset),
        opacity: asset.opacity ?? 1,
        zIndex: asset.zIndex ?? 0,
        transition: asset.transition ?? "transform 200ms ease-out, opacity 200ms ease-out",
        pointerEvents: "none",
      }}
    />
  );
}
