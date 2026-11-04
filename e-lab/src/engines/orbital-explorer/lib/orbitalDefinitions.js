// UI-facing orbital catalogue -- separate from ORBITAL_DEFS in
// orbitalMath.js (which is keyed by the internal id used for the math),
// this describes how orbitals are grouped/labelled for the selector.
export const BASE_ORBITALS = ["1s", "2s", "2p", "3s", "3p", "3d", "4s"];

export const ORIENTATIONS = {
  "2p": ["2px", "2py", "2pz"],
  "3p": ["3px", "3py", "3pz"],
  "3d": ["3dxy", "3dxz", "3dyz", "3dx2y2", "3dz2"],
};

export const ORIENTATION_LABELS = {
  "2px": "px", "2py": "py", "2pz": "pz",
  "3px": "px", "3py": "py", "3pz": "pz",
  "3dxy": "dxy", "3dxz": "dxz", "3dyz": "dyz", "3dx2y2": "dx\u00B2\u2212y\u00B2", "3dz2": "dz\u00B2",
};

export function defaultOrientationFor(base) {
  return ORIENTATIONS[base]?.[0] ?? base;
}
