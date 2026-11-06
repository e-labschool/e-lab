// The geometry of the continuous instrument drawing. PURE. World units are arbitrary drawing units (about 1 unit = 1 px at zoom 1); NOT to scale.
// Layout depends on the container: a wide scene gets a wide ion source, a tall (phone) scene a narrow, tall one. The analyser block depends on the selected analyser:
// a magnetic sector (Dempster-type 180 degree geometry rotated so that the ion beam flows left to right) OR a straight flight tube. Never both.
import { SECTOR } from "../physics/sector.js";

export const SECTOR_SCALE = 560; // world units per metre in the sector drawing (R_DET = 0.1 m -> 56 units)
export const TOF_UNITS = 520; // length of the drawn flight tube in world units (L = 1 m is the physical value; the drawing is shortened)
export const GLYPH_SCALE = 11; // world units per angstrom for the molecule glyphs

export function makeWorld({ tall = false, analyser = "sector" } = {}) {
  const preW = tall ? 214 : 400; const fragW = tall ? 250 : 540; const H = tall ? 380 : 216;
  const preX0 = 22; const preX1 = preX0 + preW; const beamX = preX1 + 26; const fragX0 = beamX + 26; const fragX1 = fragX0 + fragW; const slitX = fragX1 + 22;
  const yc = H / 2;
  const accelX0 = slitX + 6; const accelX1 = accelX0 + 78; const plateX = accelX1 + 16;
  const w = {
    tall, analyser, H, yc,
    chamber: { x0: 0, x1: slitX, y0: 0, y1: H },
    reservoir: { x0: -290, x1: -96, y0: yc - 168, y1: yc + 168 }, valveX: -78, inletX: 0,
    preZone: { x0: preX0, x1: preX1, y0: 16, y1: H - 16 }, fragZone: { x0: fragX0, x1: fragX1, y0: 16, y1: H - 16 },
    beamX, filamentY: H + 18, trapY: -18,
    pump: { x: fragX0 + fragW * 0.72, y: H + 40 },
    slit: { x: slitX, y: yc }, accel: { x0: accelX0, x1: accelX1, d: accelX1 - accelX0 }, plateX,
  };
  if (analyser === "tof") {
    const L = TOF_UNITS;
    w.tof = { x0: plateX, x1: plateX + L, L, y: yc, h: Math.min(80, H * 0.46) };
    w.detector = { x: plateX + L + 10, y: yc };
    w.extent = { x0: -300, x1: w.detector.x + 70, y0: -34, y1: H + 70 };
  } else {
    const s = SECTOR_SCALE;
    w.sector = { s, entry: { x: plateX, y: yc }, boxW: SECTOR.H * s, boxH: SECTOR.W * s, rDet: SECTOR.R_DET * s };
    // screen mapping of the original plane (x along the plate, y away from it): X = plateX + y s, Y = yc + x s
    w.sectorXY = (xo, yo) => ({ x: plateX + yo * s, y: yc + xo * s });
    w.detector = { x: plateX, y: yc + 2 * SECTOR.R_DET * s };
    w.extent = { x0: -300, x1: plateX + w.sector.boxW + 30, y0: -34, y1: Math.max(H + 70, yc + w.sector.boxH + 40) };
  }
  return w;
}

/** The world rectangle each stage frames (the camera), before it is fitted to the aspect ratio of the scene. */
export function cameraRect(world, stage) {
  const { yc, H, chamber, preZone, fragZone, beamX, plateX } = world;
  const pad = 22;
  const R = (x0, y0, x1, y1) => ({ x0, y0, x1, y1 });
  const hh = world.tall ? H / 2 + 36 : H / 2 + 52;
  if (stage === 1) return world.tall ? R(world.reservoir.x0 - 20, yc - 200, preZone.x1 + 20, yc + 200) : R(world.reservoir.x0 - 16, yc - 192, preZone.x1 + 16, yc + 192);
  if (stage === 2) return world.tall ? R(preZone.x0 - pad, -40, fragZone.x1 + pad, H + 40) : R(preZone.x0 + 180, yc - hh, fragZone.x1 + pad, yc + hh + 8);
  if (stage === 3) return R(fragZone.x0 - 20, yc - hh + 6, chamber.x1 + 12, yc + hh + 22);
  if (stage === 4 || stage === 5) {
    if (world.analyser === "tof") return world.tall ? R(world.slit.x - 40, yc - 70, world.tof.x1 + 70, yc + 160) : R(world.accel.x0 - 40, yc - 82, world.tof.x1 + 76, yc + 110);
    const sx = world.sector;
    return world.tall ? R(plateX - 70, yc - 40, plateX + sx.boxW + 20, yc + sx.boxH + 20) : R(world.slit.x - 20, yc - 36, plateX + sx.boxW + 24, yc + sx.boxH * 0.86 + 10);
  }
  return R(world.extent.x0, world.extent.y0, world.extent.x1, world.extent.y1);
}
/** Fit a rect into a w x h pixel box (meet): returns the viewBox and the pixel/unit scale k. */
export function fitCamera(rect, w, h) {
  const rw = rect.x1 - rect.x0; const rh = rect.y1 - rect.y0;
  const k = Math.min(w / rw, h / rh);
  const vw = w / k; const vh = h / k;
  const cx = (rect.x0 + rect.x1) / 2; const cy = (rect.y0 + rect.y1) / 2;
  return { x: cx - vw / 2, y: cy - vh / 2, w: vw, h: vh, k };
}
export const lerpCam = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });
export const REGION_OF_STAGE = { 1: "inlet", 2: "ionisation", 3: "fragmentation", 4: "analyser", 5: "detector", 6: "detector" };
