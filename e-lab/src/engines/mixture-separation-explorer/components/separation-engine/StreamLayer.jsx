import PourStream from "../visuals/PourStream.jsx";

/** Thin wrapper around the existing, already-verified PourStream.jsx --
 * its endpoints MUST come from resolveAnchor() (assetConfig.js), never
 * a guessed coordinate -- this is what prevents the stream-misses-the-
 * funnel class of bug from recurring in the new engine. */
export default function StreamLayer({ from, to, progress, liquidColor, particleColor }) {
  if (!from || !to) return null;
  return <PourStream fromX={from.x} fromY={from.y} toX={to.x} toY={to.y} progress={progress} liquidColor={liquidColor} particleColor={particleColor} />;
}
