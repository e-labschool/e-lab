// Constants and framing maths shared by the 3D scene and its DOM wrapper.
export const BOND_LEN = 1.75; // centre-to-centre distance of a surrounding atom (scene units)
export const FOV = 40;
export const MAX_SLOTS = 6;

/** Fitting distance of the camera for a sphere of radius `rad` in a canvas of the given aspect ratio. */
export function fitDistance(rad, aspect) {
  const vHalf = (FOV * Math.PI) / 360; const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return (rad * 1.08) / Math.sin(Math.min(vHalf, hHalf));
}
