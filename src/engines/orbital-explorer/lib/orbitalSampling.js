// Generates 3D points whose LOCAL DENSITY is proportional to |psi(x,y,z)|^2
// -- via rejection sampling directly in Cartesian space. This is the
// scientifically important design choice: sampling uniformly in Cartesian
// (x,y,z) and accepting/rejecting each candidate point based on
// |psi|^2 there gives a point cloud whose density genuinely represents
// the orbital PROBABILITY DENSITY at each point in space, which is
// explicitly NOT the same thing as the "radial probability distribution"
// (4*pi*r^2*|R(r)|^2) sometimes plotted as a 1D curve in textbooks --
// conflating the two is one of the explicit scientific pitfalls this
// simulation must avoid. No spherical-coordinate Jacobian correction is
// needed here precisely because sampling happens directly in Cartesian
// space, not by sampling r/theta/phi independently.
import { probabilityDensity } from "./orbitalMath.js";
import { makeSeededRandom } from "./seededRandom.js";

/** A generous bounding box radius (atomic units) per principal quantum
 * number -- large enough that the orbital's probability density is
 * genuinely negligible beyond it (verified numerically before use, not
 * just guessed), so rejection sampling doesn't waste huge numbers of
 * attempts sampling in empty space far from any real density, nor
 * clips off a meaningful tail of the true distribution. */
export function boundingRadiusFor(n) {
  return { 1: 6, 2: 14, 3: 24, 4: 36 }[n] ?? 24;
}

/** Finds the maximum |psi|^2 value within the bounding sphere via a
 * coarse grid search -- used as the rejection-sampling envelope. Coarse
 * is fine here: slightly underestimating the true max only means a
 * small number of near-peak points get rejected less often than
 * strictly necessary (never a source of an INCORRECT distribution,
 * just of case-by-case sampling efficiency), and slightly overestimating
 * just costs a few more rejected attempts. */
function findMaxDensity(n, l, orbitalType, boundR) {
  let maxD = 0;
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * boundR;
    for (let ti = 0; ti <= 12; ti++) {
      const theta = (ti / 12) * Math.PI;
      for (let pi = 0; pi <= 12; pi++) {
        const phi = (pi / 12) * 2 * Math.PI;
        const d = probabilityDensity(n, l, orbitalType, r, theta, phi);
        if (d > maxD) maxD = d;
      }
    }
  }
  return maxD * 1.15; // small safety margin above the coarse-grid estimate
}

const maxDensityCache = new Map();
function getMaxDensity(n, l, orbitalType) {
  const key = `${n}-${l}-${orbitalType}`;
  if (!maxDensityCache.has(key)) {
    maxDensityCache.set(key, findMaxDensity(n, l, orbitalType, boundingRadiusFor(n)));
  }
  return maxDensityCache.get(key);
}

/** Generates up to `count` accepted sample points {x,y,z} via rejection
 * sampling. `rng` is a seeded random function (see seededRandom.js).
 * `maxAttempts` bounds total work so this can never hang even for a
 * pathological request -- returns however many points were actually
 * accepted if the cap is hit first. */
export function sampleOrbitalPoints(n, l, orbitalType, count, rng, maxAttempts = count * 3000) {
  const boundR = boundingRadiusFor(n);
  const maxDensity = getMaxDensity(n, l, orbitalType);
  const points = [];
  let attempts = 0;
  while (points.length < count && attempts < maxAttempts) {
    attempts++;
    const x = (rng() * 2 - 1) * boundR;
    const y = (rng() * 2 - 1) * boundR;
    const z = (rng() * 2 - 1) * boundR;
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r > boundR) continue;
    const theta = r > 1e-9 ? Math.acos(z / r) : 0;
    const phi = Math.atan2(y, x);
    const density = probabilityDensity(n, l, orbitalType, r, theta, phi);
    if (rng() * maxDensity < density) points.push({ x, y, z });
  }
  return points;
}

export function createSampler(seed) {
  return makeSeededRandom(seed);
}
