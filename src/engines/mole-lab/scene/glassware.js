// Laboratory glassware as pure profile maths (no three.js): each vessel is a surface of revolution r(y).  The SAME profile gives the
// drawn glass AND the volume <-> liquid-height relation, so a level in the picture is always the level the calibration says
// (a volumetric flask's mark sits exactly where the profile holds its nominal volume).  Units: scene units; volumes in mL.
//
//   const g = makeVessel("flask", 100);   g.heightAt(60) -> y of 60 mL;  g.volumeAt(y) -> mL;  g.innerR(y);  g.profile (outer, for the lathe)

const STEPS = 160;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Base shapes in "design" units; `inner(y)` is the inner radius.  `ref` = [y of the nominal volume, nominal volume in design units] fixes the mL scale. */
const SHAPES = {
  beaker: { H: 2.0, wall: 0.045, base: 0.1, mouthR: 0.78, inner: (y) => (y < 0.1 ? 0 : 0.735 - 0.03 * smooth(1.92, 2.0, y)), nominalMl: 250, nominalY: 1.82, label: "beaker" },
  cylinder: { H: 2.6, wall: 0.035, base: 0.12, mouthR: 0.3, inner: (y) => (y < 0.12 ? 0 : 0.255 + 0.02 * smooth(2.5, 2.6, y)), nominalMl: 100, nominalY: 2.35, label: "measuring cylinder" },
  // volumetric flask: a bulb, a long narrow neck and ONE ring mark on the neck (design for 100 mL; other sizes scale uniformly)
  flask: { H: 2.75, wall: 0.04, base: 0.07, mouthR: 0.17, markY: 2.12, nominalMl: 100, nominalY: 2.12, label: "volumetric flask",
    inner: (y) => {
      if (y < 0.07) return 0;
      const R = 0.6; const yc = 0.62;
      if (y <= 1.0) return Math.max(0.3, Math.sqrt(Math.max(0, R * R - (y - yc) ** 2)));
      const t = smooth(1.0, 1.62, y); const r0 = Math.sqrt(R * R - (1.0 - yc) ** 2);
      return r0 * (1 - t) + 0.115 * t + (y > 2.6 ? 0.04 * smooth(2.6, 2.75, y) : 0);
    } },
  // reagent bottle used for the stock solution (a stoppered volumetric flask in the lab); drawn with the flask profile
};

export const VESSEL_KINDS = Object.freeze(Object.keys(SHAPES));
export const flaskScale = (capacityMl) => Math.min(1.45, Math.max(0.7, Math.cbrt(capacityMl / 100)));

/** Build a vessel.  `capacityMl` matters for flasks (size scale) and the printed labels; beaker/cylinder have fixed shapes. */
export function makeVessel(kind, capacityMl = SHAPES[kind]?.nominalMl) {
  const sh = SHAPES[kind]; if (!sh) throw new Error(`Unknown vessel kind "${kind}"`);
  const s = kind === "flask" ? flaskScale(capacityMl) : 1;
  const H = sh.H * s; const dy = H / STEPS;
  const ys = []; const rIn = []; const rOut = []; const vol = [0];
  for (let i = 0; i <= STEPS; i += 1) {
    const y = i * dy; ys.push(y);
    const ri = sh.inner(y / s) * s; rIn.push(ri); rOut.push(ri > 0 ? ri + sh.wall * s : sh.inner(sh.base * 1.2 / s) * s + sh.wall * s);
  }
  for (let i = 1; i <= STEPS; i += 1) vol.push(vol[i - 1] + Math.PI * ((rIn[i] ** 2 + rIn[i - 1] ** 2) / 2) * dy);
  // calibrate: the nominal volume sits at the nominal height; for a flask that is the ring mark, for the others the top graduation
  const nomY = sh.nominalY * s; const nomUnits = interp(ys, vol, nomY);
  // flasks are CALIBRATED to their own capacity at the mark; beaker and cylinder keep one fixed scale
  const k = (kind === "flask" ? capacityMl : sh.nominalMl) / nomUnits;
  const volumeAt = (y) => k * interp(ys, vol, Math.min(H, Math.max(0, y)));
  const heightAt = (ml) => { const target = Math.max(0, ml) / k; if (target >= vol[STEPS]) return H; let lo = 0; let hi = STEPS; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (vol[m] < target) lo = m; else hi = m; } const span = vol[hi] - vol[lo]; return ys[lo] + (span > 0 ? ((target - vol[lo]) / span) * dy : 0); };
  const innerR = (y) => interp(ys, rIn, Math.min(H, Math.max(0, y)));
  const outerR = (y) => interp(ys, rOut, Math.min(H, Math.max(0, y)));
  const markY = kind === "flask" ? sh.markY * s : null;
  return { kind, capacityMl, scale: s, height: H, ys, rIn, rOut, volumeAt, heightAt, innerR, outerR, markY, wall: sh.wall * s, base: sh.base * s, mouthR: sh.mouthR * s, usableMl: k * vol[STEPS], k, spoutX: (rOut[STEPS] || sh.mouthR * s) };
}

function interp(xs, vs, x) {
  const n = xs.length - 1; if (x <= xs[0]) return vs[0]; if (x >= xs[n]) return vs[n];
  const t = (x - xs[0]) / (xs[n] - xs[0]) * n; const i = Math.min(n - 1, Math.floor(t)); const f = t - i; return vs[i] * (1 - f) + vs[i + 1] * f;
}

/** Profile points [r, y] (outer wall, rim, inner wall) for a closed LatheGeometry of the glass body (thick base and wall). */
export function glassProfile(v) {
  const pts = []; const step = 4;
  pts.push([0, 0]);
  for (let i = 0; i <= STEPS; i += step) pts.push([Math.max(0.0001, v.rOut[i]), v.ys[i]]);
  if ((STEPS % step) !== 0) pts.push([v.rOut[STEPS], v.ys[STEPS]]);
  pts.push([Math.max(v.rIn[STEPS] + 0.004, v.rOut[STEPS] + v.wall * 0.2), v.height + 0.012]); // rounded lip
  pts.push([v.rIn[STEPS], v.height]);
  for (let i = STEPS; i >= 0; i -= step) { if (v.rIn[i] > 0.001 && v.ys[i] >= v.base) pts.push([v.rIn[i], v.ys[i]]); }
  pts.push([0, v.base]);
  return pts;
}
/** Profile of the LIQUID up to volume `ml` (inner wall, flat top at the level).  Returns { pts, level }. */
export function liquidProfile(v, ml) {
  const level = Math.min(v.height, v.heightAt(ml)); const pts = []; pts.push([0, v.base]);
  for (let i = 0; i <= STEPS; i += 2) { const y = v.ys[i]; if (y < v.base) continue; if (y >= level) break; pts.push([Math.max(0.0001, v.rIn[i] - 0.004), y]); }
  const rTop = Math.max(0.0001, v.innerR(level) - 0.004); pts.push([rTop, level], [0, level]);
  return { pts, level, rTop };
}
/** Graduation levels (mL) printed on a vessel, with the y they sit at. */
export function graduations(v) {
  const step = v.kind === "beaker" ? 50 : v.kind === "cylinder" ? 10 : 0; const out = [];
  if (!step) return out;
  const major = v.kind === "beaker" ? 50 : 20;
  for (let ml = step; ml <= v.capacityMl + 1e-6; ml += step) out.push({ ml, y: v.heightAt(ml), major: ml % major === 0 });
  return out;
}
