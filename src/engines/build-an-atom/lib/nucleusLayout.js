// Sunflower/phyllotaxis packing for nucleons -- verified numerically:
// each particle's position depends only on ITS OWN index, never on the
// total count, so adding or removing a nucleon only adds/removes one
// position at the edge of the cluster rather than reshuffling every
// existing particle. This is what makes "the nucleus rearranges
// smoothly" true by construction rather than by animation trickery.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function nucleonPosition(index, spacing = 7.5) {
  const r = spacing * Math.sqrt(index + 0.5);
  const theta = index * GOLDEN_ANGLE;
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}

/** Gives protons and neutrons their OWN dedicated slot sequence (even
 * slots for protons, odd for neutrons) rather than a single counter
 * shared between both -- this is what makes each individual particle's
 * position depend ONLY on its own index within its own type, never on
 * how many of the OTHER type currently exist. (An earlier version of
 * this function used one shared incrementing counter; verified
 * numerically that it silently repositioned existing protons whenever
 * the neutron count changed to something lower than the proton count's
 * index -- e.g. proton #3 moved when neutrons went from 8 down to 2.
 * The dedicated-slot version below was verified to have no such case.)
 * Protons and neutrons still visually intermix through the cluster
 * (even/odd slots interleave spatially via the golden-angle formula),
 * they just don't share a mutable counter. */
export function buildNucleusLayout(protonCount, neutronCount) {
  const items = [];
  for (let i = 0; i < protonCount; i++) items.push({ type: "proton", key: `p${i}`, ...nucleonPosition(i * 2) });
  for (let i = 0; i < neutronCount; i++) items.push({ type: "neutron", key: `n${i}`, ...nucleonPosition(i * 2 + 1) });
  return items;
}
