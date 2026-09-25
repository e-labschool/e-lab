// Hydrogen-like wavefunction math for the orbital probability visualizations.
// Uses the GENERAL formula via associated Laguerre polynomials (computed
// through their standard three-term recurrence) rather than hand-typing
// specific polynomial coefficients per (n,l) pair -- the recurrence is a
// well-established, independently verifiable piece of math, and using it
// generically removes the risk of mis-transcribing a specific high-order
// polynomial's coefficients from memory. Atomic units (a0 = 1): this is a
// VISUALIZATION of orbital shape/structure, not a literal-energy
// calculation, so absolute length units don't matter -- only the correct
// number and placement of radial/angular nodes and the correct relative
// density distribution do.

/** Associated Laguerre polynomial L_k^alpha(x) via the standard
 * three-term recurrence:
 *   L_0 = 1
 *   L_1 = 1 + alpha - x
 *   L_k = ((2k-1+alpha-x) L_{k-1} - (k-1+alpha) L_{k-2}) / k
 */
function laguerre(k, alpha, x) {
  if (k === 0) return 1;
  if (k === 1) return 1 + alpha - x;
  let Lkm2 = 1;
  let Lkm1 = 1 + alpha - x;
  let Lk = Lkm1;
  for (let i = 2; i <= k; i++) {
    Lk = ((2 * i - 1 + alpha - x) * Lkm1 - (i - 1 + alpha) * Lkm2) / i;
    Lkm2 = Lkm1;
    Lkm1 = Lk;
  }
  return Lk;
}

function factorial(n) {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

/** Radial wavefunction R_nl(r), normalized such that
 * integral_0^inf |R_nl(r)|^2 r^2 dr = 1. */
export function radialWavefunction(n, l, r) {
  const rho = (2 * r) / n;
  const norm = Math.sqrt(
    ((2 / n) ** 3 * factorial(n - l - 1)) / (2 * n * factorial(n + l))
  );
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** Real angular wavefunctions (the standard chemistry-convention real
 * spherical harmonics), each normalized so integral |Y|^2 dOmega = 1
 * over the full sphere. theta = polar angle from +z, phi = azimuthal
 * angle in the xy-plane from +x. */
export function angularWavefunction(orbitalType, theta, phi) {
  const st = Math.sin(theta), ct = Math.cos(theta);
  switch (orbitalType) {
    case "s":
      return 1 / Math.sqrt(4 * Math.PI);
    case "pz":
      return Math.sqrt(3 / (4 * Math.PI)) * ct;
    case "px":
      return Math.sqrt(3 / (4 * Math.PI)) * st * Math.cos(phi);
    case "py":
      return Math.sqrt(3 / (4 * Math.PI)) * st * Math.sin(phi);
    case "dz2":
      return Math.sqrt(5 / (16 * Math.PI)) * (3 * ct * ct - 1);
    case "dxz":
      return Math.sqrt(15 / (4 * Math.PI)) * st * ct * Math.cos(phi);
    case "dyz":
      return Math.sqrt(15 / (4 * Math.PI)) * st * ct * Math.sin(phi);
    case "dxy":
      return Math.sqrt(15 / (16 * Math.PI)) * st * st * Math.sin(2 * phi);
    case "dx2y2":
      return Math.sqrt(15 / (16 * Math.PI)) * st * st * Math.cos(2 * phi);
    default:
      return 0;
  }
}

/** Full wavefunction value psi(n, l, orbitalType, r, theta, phi) --
 * combines the radial and angular parts. l is redundant with
 * orbitalType but kept explicit to select the correct radial function
 * without re-deriving l from a string. */
export function wavefunction(n, l, orbitalType, r, theta, phi) {
  return radialWavefunction(n, l, r) * angularWavefunction(orbitalType, theta, phi);
}

/** |psi|^2 -- probability density at a point. */
export function probabilityDensity(n, l, orbitalType, r, theta, phi) {
  const psi = wavefunction(n, l, orbitalType, r, theta, phi);
  return psi * psi;
}

export const ORBITAL_DEFS = {
  "1s": { n: 1, l: 0, type: "s", family: "s" },
  "2s": { n: 2, l: 0, type: "s", family: "s" },
  "2px": { n: 2, l: 1, type: "px", family: "p" },
  "2py": { n: 2, l: 1, type: "py", family: "p" },
  "2pz": { n: 2, l: 1, type: "pz", family: "p" },
  "3s": { n: 3, l: 0, type: "s", family: "s" },
  "3px": { n: 3, l: 1, type: "px", family: "p" },
  "3py": { n: 3, l: 1, type: "py", family: "p" },
  "3pz": { n: 3, l: 1, type: "pz", family: "p" },
  "3dxy": { n: 3, l: 2, type: "dxy", family: "d" },
  "3dxz": { n: 3, l: 2, type: "dxz", family: "d" },
  "3dyz": { n: 3, l: 2, type: "dyz", family: "d" },
  "3dx2y2": { n: 3, l: 2, type: "dx2y2", family: "d" },
  "3dz2": { n: 3, l: 2, type: "dz2", family: "d" },
  "4s": { n: 4, l: 0, type: "s", family: "s" },
};
