import Liquid from "../visuals/Liquid.jsx";

/** Thin wrapper around the existing, already-verified Liquid.jsx --
 * takes an "interior" rect (the container's usable inside area, in the
 * SAME percentage/stage-space as everything else) rather than deriving
 * a shape from a hand-drawn apparatus outline, since that outline is
 * now a supplied image, not something this engine draws itself. */
export default function LiquidLayer({ interior, level, color, opacity = 0.55, turbidity = 0, clipId }) {
  return <Liquid x={interior.x} y={interior.y} width={interior.width} height={interior.height} level={level} color={color} opacity={opacity} turbidity={turbidity} clipId={clipId} />;
}
