// BA-12: where a flying particle starts and ends, in pixels inside the atom stage, from the REAL positions of the control
// row it belongs to and the nucleus / outer electron ring.  Pure (takes plain rectangles) so it can be tested in Node.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const centre = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/**
 * rects: { stage, row, nucleus, ring } are { left, top, width, height } (viewport pixels); row/nucleus/ring may be null.
 * Returns { start, target } relative to the stage's top-left, or null when the stage has no size or the row is unknown.
 * start is the control row's centre, clamped into the stage so a control that sits outside it (side panel) makes the
 * particle enter from the nearest edge.  Protons and neutrons go to the nucleus; electrons to the top of the outer ring.
 */
export function flightEndpoints(type, rects) {
  const { stage, row, nucleus, ring } = rects;
  if (!stage || !stage.width || !stage.height || !row) return null;
  const rel = (p) => ({ x: p.x - stage.left, y: p.y - stage.top });
  const c = rel(centre(row));
  const start = { x: clamp(c.x, 0, stage.width), y: clamp(c.y, 0, stage.height) };
  const home = nucleus ? rel(centre(nucleus)) : { x: stage.width / 2, y: stage.height / 2 };
  let target = home;
  if (type === "electron" && ring) target = { x: home.x, y: home.y - ring.height / 2 };
  return { start, target };
}
