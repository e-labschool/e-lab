import AssetLayer from "./AssetLayer.jsx";

// The shared design-space every technique's asset configs and overlay
// geometry are expressed in -- percentages of these dimensions, not raw
// pixels, which is what lets the whole composition scale responsively
// via plain CSS (no JS resize/ResizeObserver logic needed). The SVG
// overlay below uses a matching viewBox so its own coordinate space
// lines up exactly with the asset layer's percentage space.
export const STAGE_WIDTH = 100;
export const STAGE_HEIGHT = 62.5;

/**
 * Composites the static apparatus images (AssetLayer, one per config in
 * `assets`) with a dynamic SVG overlay (`overlay` -- LiquidLayer/
 * ParticleLayer/StreamLayer/LabelLayer instances) into one responsive
 * stage. Apparatus images render first (as HTML <img>, absolutely
 * positioned by percentage), the SVG overlay renders on top, sharing
 * the exact same coordinate space so anchor-derived stream/particle
 * positions always land on the correct part of the apparatus.
 */
export default function SeparationStage({ assets, overlay, ariaLabel }) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg bg-[var(--color-paper-raised)]" style={{ aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}` }} role="img" aria-label={ariaLabel}>
      {assets.map((asset) => (
        <AssetLayer key={asset.id} asset={asset} />
      ))}
      <svg viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`} className="absolute inset-0 h-full w-full" style={{ zIndex: 50 }}>
        {overlay}
      </svg>
    </div>
  );
}
