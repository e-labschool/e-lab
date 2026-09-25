import { useMemo } from "react";
import { ORBITAL_DEFS } from "../lib/orbitalMath.js";
import { sampleOrbitalPoints, createSampler } from "../lib/orbitalSampling.js";
import ProbabilityCloud from "./ProbabilityCloud.jsx";

function Nucleus() {
  return (
    <mesh>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial color="#F5C542" emissive="#8a6400" emissiveIntensity={0.6} />
    </mesh>
  );
}

const POINTS_PER_ORBITAL = 550; // modest per-orbital count -- several
// orbitals render simultaneously here (unlike single-orbital Explore
// mode), so this is deliberately lower per cloud to stay performant
// and legible with multiple overlapping clouds at once.

function familyOf(id) {
  if (id.includes("s")) return "s";
  if (id.includes("p")) return "p";
  return "d";
}

/** Renders every orbital in `visibleIds` as its own ProbabilityCloud,
 * all sharing the same nucleus/origin -- never offset apart, per the
 * explicit requirement that Atom View shows real spatial overlap, not
 * separate little atoms. `highlightedId`, if set, renders that one
 * orbital at full opacity/size while others dim -- the link back to
 * the orbital box diagram and electron-by-electron builder. */
export default function AtomViewer({ occupiedIds, visibleIds, highlightedId }) {
  const clouds = useMemo(() => {
    return occupiedIds
      .filter((id) => visibleIds.has(id))
      .map((id) => {
        const def = ORBITAL_DEFS[id];
        const rng = createSampler(id.charCodeAt(0) * 97 + id.length); // deterministic per-orbital seed
        const points = sampleOrbitalPoints(def.n, def.l, def.type, POINTS_PER_ORBITAL, rng);
        return { id, points, family: familyOf(id) };
      });
  }, [occupiedIds, visibleIds]);

  const anyHighlighted = Boolean(highlightedId);

  return (
    <>
      <Nucleus />
      {clouds.map((c) => (
        <ProbabilityCloud
          key={c.id}
          points={c.points}
          family={c.family}
          size={anyHighlighted && c.id !== highlightedId ? 0.06 : 0.09}
          opacity={anyHighlighted ? (c.id === highlightedId ? 0.9 : 0.15) : 0.55}
        />
      ))}
    </>
  );
}
