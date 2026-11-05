// The 180-degree magnetic-sector analyser of stage 6 (a Dempster-type geometry; real instruments use 60 or 90 degree sectors, the physics is the same).
//
// Plane of the drawing: x to the right, y up. Ions leave the source and enter the field region through a slit at the origin moving along +y. The field B is uniform,
// perpendicular to the plane (out of the page), so the force z e v x B points to +x and a positive ion moves on a CIRCLE of radius r about the point (r, 0).
// It returns to the plate y = 0 at x = 2 r after half a turn. A detector slit sits at x = 2 R_DET (half-width SLIT in radius terms). The field region is the box
// 0 <= x <= W, 0 <= y <= H: an ion whose arc would leave it hits the wall at the point where the circle first reaches the boundary.
import { fieldForMz, radiusFromMz } from "./kinematics.js";

export const SECTOR = Object.freeze({
  W: 0.40, // m, width of the field region
  H: 0.20, // m, height of the field region
  R_DET: 0.10, // m, radius of the path that arrives at the detector slit (slit centre at x = 0.20 m)
  SLIT: 0.0012, // m, half-width of the slit in terms of the path radius (landing window = +-2 SLIT in x; separates neighbouring m/z up to about 30)
  B_MIN: 0.1, B_MAX: 0.8, // T
  V_MIN: 500, V_MAX: 5000, // V
});

/** Where an ion with the given m/z ends up for the accelerating voltage V and the field B. */
export function sectorTrajectory(mz, V, B, geom = SECTOR) {
  const r = radiusFromMz(mz, V, B);
  const { W, H, R_DET, SLIT } = geom;
  let outcome; let end; let sweep; // sweep: angle (rad) turned through before the end, 0..pi
  if (r > H || 2 * r > W) {
    // leaves the box: first reach of x = W (right wall) or y = H (top wall) along theta; x = r (1 - cos th), y = r sin th
    let th = Math.PI;
    if (2 * r > W) th = Math.min(th, Math.acos(1 - W / r)); // right wall
    let wall = "outer wall (right)";
    if (r > H) { const thTop = Math.asin(H / r); if (thTop < th) { th = thTop; wall = "outer wall (top)"; } }
    sweep = th; outcome = "wall"; end = { x: r * (1 - Math.cos(th)), y: r * Math.sin(th), where: wall };
  } else {
    sweep = Math.PI; end = { x: 2 * r, y: 0, where: "plate" };
    outcome = Math.abs(r - R_DET) <= SLIT ? "detector" : "plate";
  }
  return { mz, r, outcome, end, sweep, hitsDetector: outcome === "detector" };
}

/** Point on the circular path at turning angle th (0..sweep). */
export const sectorPoint = (r, th) => ({ x: r * (1 - Math.cos(th)), y: r * Math.sin(th) });

/** B (T) that centres ions of the given m/z on the detector for the accelerating voltage V. */
export const tunedField = (mz, V, geom = SECTOR) => fieldForMz(mz, V, geom.R_DET);

/** Plain-language result for the readout. */
export function outcomeText(t) {
  if (t.outcome === "detector") return "Reaches the detector: this m/z is recorded.";
  if (t.outcome === "wall") return `Radius too large: the ion hits the ${t.end.where} and is lost.`;
  return t.r < SECTOR.R_DET ? "Radius too small: the ion lands on the plate before the detector slit." : "Radius too large: the ion lands on the plate beyond the detector slit.";
}
