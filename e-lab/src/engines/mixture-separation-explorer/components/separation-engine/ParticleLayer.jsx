import Particles from "../visuals/Particles.jsx";

/** Thin wrapper around the existing, already-verified Particles.jsx --
 * see LiquidLayer.jsx for why this engine reuses rather than redraws. */
export default function ParticleLayer({ layout, visibleCount, color, clipId }) {
  return <Particles layout={layout} visibleCount={visibleCount} color={color} clipId={clipId} />;
}
