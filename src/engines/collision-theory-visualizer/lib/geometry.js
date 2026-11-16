// Pure geometry for the magnified collision view. Everything is derived from a REAL recorded collision (see
// CollisionEngine events): the approach direction, the line of centres and both reactive-site orientations are the real
// values; only the length of the path and the time scale are chosen so both molecules always stay inside the viewBox.
export const VIEW = { w: 200, h: 140, r: 15, contact: 30 };
const KAPPA = VIEW.contact / 16; // display units per world unit (contact distance 2R = 16)

/**
 * Returns the display geometry of one collision event.
 *   start / contact / end : { ax, ay, bx, by } centres of A (or the solid site) and B
 *   pre / post : unit vectors of the relative velocity (A - B) before / after the elastic bounce
 */
export function eventGeometry(ev) {
  const tile = ev.kind === 1;
  const dl = Math.hypot(ev.dx, ev.dy) || 1;
  const dxn = ev.dx / dl; const dyn = ev.dy / dl; // unit vector B -> A
  const ul = Math.hypot(ev.ux, ev.uy) || 1;
  let ux = ev.ux / ul; let uy = ev.uy / ul;
  // the recorded pair is approaching: relative velocity of A points toward B (against d). Guard rounding.
  const toward = ux * -dxn + uy * -dyn;
  if (toward < 0.05) { ux = -dxn; uy = -dyn; }
  // elastic bounce along the line of centres (n = A -> B)
  const nx = -dxn; const ny = -dyn;
  const un = ux * nx + uy * ny;
  let px = ux - 2 * un * nx; let py = uy - 2 * un * ny;
  const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;
  const L = (tile ? 12 : 36); // world units travelled before / after contact
  const wA = tile ? 0 : 0.5; // share of the relative displacement carried by A (the solid site does not move)
  const cx = VIEW.w / 2; const cy = VIEW.h / 2;
  const at = (rx, ry) => ({ ax: cx + wA * rx * KAPPA, ay: cy + wA * ry * KAPPA, bx: cx - (1 - wA) * rx * KAPPA, by: cy - (1 - wA) * ry * KAPPA });
  const d0x = dxn * 16; const d0y = dyn * 16;
  return {
    pre: { x: ux, y: uy }, post: { x: px, y: py }, tile,
    start: at(d0x - ux * L, d0y - uy * L),
    contact: at(d0x, d0y),
    end: at(d0x + px * L, d0y + py * L),
  };
}

/** Position at animation progress s in [0,1]: 0..0.45 approach, 0.45..0.55 contact, 0.55..1 separation. */
export function positionAt(g, s) {
  const lerp = (a, b, f) => a + (b - a) * f;
  let from = g.start; let to = g.contact; let f;
  if (s <= 0.45) { f = s / 0.45; } else if (s < 0.55) { from = g.contact; to = g.contact; f = 0; } else { from = g.contact; to = g.end; f = Math.min(1, (s - 0.55) / 0.45); }
  const e = f * f * (3 - 2 * f); // smooth start/stop
  const ff = s <= 0.45 ? f : e;
  return { ax: lerp(from.ax, to.ax, ff), ay: lerp(from.ay, to.ay, ff), bx: lerp(from.bx, to.bx, ff), by: lerp(from.by, to.by, ff) };
}

export const OUTCOME_TEXT = [
  { key: "success", title: "Reaction", detail: "Energy at least Ea and the reactive sites face each other." },
  { key: "low", title: "No reaction: too little energy", detail: "The sites face each other but the collision energy is below Ea." },
  { key: "orient", title: "No reaction: wrong orientation", detail: "The collision energy is at least Ea but the reactive sites do not face each other." },
  { key: "both", title: "No reaction: too little energy and wrong orientation", detail: "Below Ea and the reactive sites do not face each other." },
];
