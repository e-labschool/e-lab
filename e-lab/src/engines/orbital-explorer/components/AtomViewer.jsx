import { useMemo } from "react";
import { ORBITAL_DEFS } from "../lib/orbitalMath.js";
import { sampleOrbitalPoints, createSampler, boundingRadiusFor } from "../lib/orbitalSampling.js";
import { colorForOrbitalId } from "../lib/orbitalColors.js";
import ProbabilityCloud from "./ProbabilityCloud.jsx";
import OrbitalBoundary from "./OrbitalBoundary.jsx";
import OrbitalAxes from "./OrbitalAxes.jsx";

function Nucleus() {
  return (
    <mesh>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial color="#F5C542" emissive="#8a6400" emissiveIntensity={0.6} />
    </mesh>
  );
}

/** Renders every orbital in `visibleIds` as its own probability-density
 * point cloud PLUS a translucent boundary region, all sharing the same
 * nucleus/origin -- never offset apart, per the explicit requirement
 * that Atom View shows real spatial overlap, not separate little atoms.
 * `highlightedId`, if set, renders that one orbital at full opacity/size
 * while others dim -- the link back to the legend/info panel and the
 * orbital box diagram. `pointsPerOrbital` drives the adaptive quality
 * tier (desktop defaults to the full ~10,000/orbital density). */
export default function AtomViewer({ occupiedIds, visibleIds, highlightedId, pointsPerOrbital = 10000 }) {
  const maxN = useMemo(() => Math.max(1, ...occupiedIds.map((id) => parseInt(id[0], 10))), [occupiedIds]);

  // Sampling is deterministic per (orbital id, point count) -- the seed
  // never changes across renders -- so this memo only re-runs when the
  // actual set of occupied orbitals or the density tier changes, never
  // on unrelated UI state (toggling visibility/highlight does NOT
  // regenerate any point cloud, it only changes which already-computed
  // clouds are shown and at what opacity).
  const clouds = useMemo(() => {
    return occupiedIds.map((id) => {
      const def = ORBITAL_DEFS[id];
      const rng = createSampler(id.charCodeAt(0) * 97 + id.length + pointsPerOrbital);
      const points = sampleOrbitalPoints(def.n, def.l, def.type, pointsPerOrbital, rng);
      return { id, def, points, color: colorForOrbitalId(id) };
    });
  }, [occupiedIds, pointsPerOrbital]);

  const anyHighlighted = Boolean(highlightedId);
  const axisLength = boundingRadiusFor(maxN) * 0.58;

  return (
    <>
      <Nucleus />
      <OrbitalAxes length={axisLength} />
      {clouds
        .filter((c) => visibleIds.has(c.id))
        .map((c) => {
          const dimmed = anyHighlighted && c.id !== highlightedId;
          const cloudOpacity = anyHighlighted ? (c.id === highlightedId ? 0.92 : 0.1) : 0.62;
          const boundaryOpacity = anyHighlighted ? (c.id === highlightedId ? 0.22 : 0.03) : 0.14;
          return (
            <group key={c.id}>
              <OrbitalBoundary points={c.points} n={c.def.n} l={c.def.l} type={c.def.type} color={c.color} opacity={boundaryOpacity} />
              <ProbabilityCloud points={c.points} color={c.color} size={dimmed ? 0.045 : 0.055} opacity={cloudOpacity} />
            </group>
          );
        })}
    </>
  );
}
