// Keyboard alternative for the 3D camera (WCAG 2.1.1): arrow keys orbit, + / - zoom, 0 resets.  Pure maths + a key mapper.
export const ORBIT_STEP = (12 * Math.PI) / 180; // radians per key press
export const KEY_HELP = "Keyboard: arrow keys rotate the view, + and - zoom, 0 resets the view.";

/** Map a keyboard event to a camera action, or null.  Shift makes the orbit step three times smaller. */
export function cameraKeyAction(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const s = e.shiftKey ? 1 / 3 : 1;
  switch (e.key) {
    case "ArrowLeft": return { type: "orbit", az: -ORBIT_STEP * s, pol: 0 };
    case "ArrowRight": return { type: "orbit", az: ORBIT_STEP * s, pol: 0 };
    case "ArrowUp": return { type: "orbit", az: 0, pol: -ORBIT_STEP * s };
    case "ArrowDown": return { type: "orbit", az: 0, pol: ORBIT_STEP * s };
    case "+": case "=": case "PageUp": return { type: "zoom", factor: 0.85 };
    case "-": case "_": case "PageDown": return { type: "zoom", factor: 1 / 0.85 };
    case "0": case "Home": return { type: "reset" };
    default: return null;
  }
}

/** Rotate a camera position about `target` by (az, pol) radians; polar angle is clamped away from the poles.  Returns [x,y,z]. */
export function orbitPosition(pos, target, az, pol) {
  const dx = pos[0] - target[0], dy = pos[1] - target[1], dz = pos[2] - target[2];
  const r = Math.hypot(dx, dy, dz) || 1;
  let theta = Math.atan2(dx, dz); let phi = Math.acos(Math.max(-1, Math.min(1, dy / r)));
  theta += az; phi = Math.max(0.12, Math.min(Math.PI - 0.12, phi + pol));
  return [target[0] + r * Math.sin(phi) * Math.sin(theta), target[1] + r * Math.cos(phi), target[2] + r * Math.sin(phi) * Math.cos(theta)];
}
