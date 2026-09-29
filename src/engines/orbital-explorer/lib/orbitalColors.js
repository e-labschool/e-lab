// Per-shell/sublevel color system for Build an Atom -- deliberately
// SEPARATE from ProbabilityCloud's FAMILY_COLOR (s/p/d only, used by
// Explore an Orbital), because Build an Atom needs 1s and 2s -- both
// "s family" -- to read as different colors when they overlap around
// the same nucleus. Keyed by the base orbital id (the sublevel, not the
// individual px/py/pz/dxy/... orientation) so all three 2p orientations
// share one color family, per the brief. Consistent across every
// element: 1s is always this blue, whichever atom is selected.
export const SHELL_COLOR = {
  "1s": "#2196F3", // vivid electric blue
  "2s": "#FFA726", // orange / amber
  "2p": "#FF4D6D", // pink / red family
  "3s": "#26E0F5", // cyan
  "3p": "#B455E8", // purple / magenta family
  "3d": "#4CD164", // green family
  "4s": "#2FE0A8", // teal-green -- distinct from both 2s (amber) and 3d (green)
};

/** Maps an individual orbital id (e.g. "2px", "3dxy", "1s") to its
 * shell-level color key (e.g. "2p", "3d", "1s"). */
export function shellKeyFor(orbitalId) {
  // strip any orientation suffix (x/y/z/xy/xz/yz/x2y2/z2) down to n+letter
  const match = /^(\d)([spd])/.exec(orbitalId);
  return match ? `${match[1]}${match[2]}` : orbitalId;
}

export function colorForOrbitalId(orbitalId) {
  return SHELL_COLOR[shellKeyFor(orbitalId)] ?? "#9CA3AF";
}
