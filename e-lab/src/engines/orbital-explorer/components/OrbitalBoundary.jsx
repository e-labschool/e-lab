import { useMemo } from "react";
import { radialWavefunction } from "../lib/orbitalMath.js";
import { boundingRadiusFor } from "../lib/orbitalSampling.js";

// Soft translucent "orbital region" surface -- the second visual layer
// requested alongside the probability-density point cloud. Reuses the
// SAME sampled points passed to the point cloud (no resampling, no new
// physics) to size itself: it measures where those points actually sit
// rather than guessing a boundary radius. For s orbitals with a radial
// node (2s, 3s, 4s), this renders TWO separate concentric spheres -- one
// per side of the node -- specifically so it never looks like "one
// solid sphere" for 2s, per the explicit requirement. For p orbitals it
// renders two lobes along the orbital's axis with a gap at the origin,
// showing the nodal plane through the nucleus.

const nodeCache = new Map();
/** Radii (ascending, interior only) where radialWavefunction(n,l,r)
 * changes sign -- the orbital's radial nodes, found numerically by
 * scanning the SAME radial function already used for sampling (no
 * separate/competing math). */
function findRadialNodeRadii(n, l, boundR) {
  const key = `${n}-${l}`;
  if (nodeCache.has(key)) return nodeCache.get(key);
  const steps = 4000;
  const nodes = [];
  let prev = radialWavefunction(n, l, (boundR * 0.001));
  for (let i = 1; i <= steps; i++) {
    const r = (i / steps) * boundR;
    const val = radialWavefunction(n, l, r);
    if (prev !== 0 && val !== 0 && Math.sign(val) !== Math.sign(prev)) {
      // linear-interpolate the crossing for a slightly cleaner radius
      const rPrev = ((i - 1) / steps) * boundR;
      const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(val));
      nodes.push(rPrev + t * (r - rPrev));
    }
    prev = val;
  }
  nodeCache.set(key, nodes);
  return nodes;
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.min(sortedArr.length - 1, Math.floor(p * sortedArr.length));
  return sortedArr[idx];
}

// Keyed by the single-letter axis suffix ("x"/"y"/"z"), matching what
// LobePair is actually called with below (type.slice(-1)) -- these were
// previously keyed "px"/"py"/"pz", which never matched, so the lookup
// silently fell through to the [1,0,0] fallback for EVERY p orbital:
// px's dumbbell rendered correctly by coincidence (fallback == its own
// axis), but py and pz's boundary also rendered along x instead of
// their own axis, while their probability-point clouds (sampled
// separately, correctly, straight from the wavefunction) were never
// affected -- hence "dots move, but no separate dumbbell appears".
const AXIS_DIR = {
  x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1],
};

function SphereShell({ radius, color, opacity }) {
  if (!radius || radius <= 0) return null;
  return (
    <mesh>
      <sphereGeometry args={[radius, 28, 20]} />
      {/* FrontSide only -- with DoubleSide, both the near and far
          hemisphere of the surface blend on top of each other from the
          camera's point of view, which visually doubles the opacity and
          makes an otherwise-soft boundary read as a near-solid ball. */}
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={0} />
    </mesh>
  );
}

function LobePair({ radius, axis, color, opacity }) {
  if (!radius || radius <= 0) return null;
  const dir = AXIS_DIR[axis] ?? [1, 0, 0];
  // Elongated ellipsoid lobes: long axis along the orbital's axis,
  // narrower across it -- a soft dumbbell rather than two round balls.
  const long = radius * 0.62;
  const cross = radius * 0.38;
  const offset = radius * 0.5;
  const scale = [
    dir[0] ? long / cross : 1,
    dir[1] ? long / cross : 1,
    dir[2] ? long / cross : 1,
  ];
  return (
    <>
      {[1, -1].map((sign) => (
        <mesh key={sign} position={[dir[0] * offset * sign, dir[1] * offset * sign, dir[2] * offset * sign]} scale={[scale[0] || 1, scale[1] || 1, scale[2] || 1]}>
          <sphereGeometry args={[cross, 20, 16]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} side={0} />
        </mesh>
      ))}
    </>
  );
}

/** `points` is the already-sampled cloud for this orbital ({x,y,z}[]).
 * `n`, `l`, `type` describe the orbital (same shape as ORBITAL_DEFS
 * entries). `axis` is the orientation suffix ("x"/"y"/"z") for p
 * orbitals, unused for s. */
export default function OrbitalBoundary({ points, n, l, type, color, opacity = 0.16 }) {
  const shellRadii = useMemo(() => {
    const boundR = boundingRadiusFor(n);
    const nodes = findRadialNodeRadii(n, l, boundR);
    const bounds = [0, ...nodes, boundR];
    const radii = points.map((p) => Math.hypot(p.x, p.y, p.z)).sort((a, b) => a - b);
    const shells = [];
    for (let i = 0; i < bounds.length - 1; i++) {
      const lo = bounds[i], hi = bounds[i + 1];
      const inShell = radii.filter((r) => r >= lo && r < hi);
      const outer = inShell.length > 0 ? percentile(inShell, 0.85) : (lo > 0 ? lo * 1.15 : null);
      if (outer) shells.push(outer);
    }
    return shells;
  }, [points, n, l]);

  const isP = l === 1;

  return (
    <group>
      {shellRadii.map((radius, i) => {
        // Inner shells rendered a touch more opaque than outer ones so
        // they remain distinguishable rather than washing out under the
        // larger, more numerous outer-shell surface.
        const shellOpacity = opacity * (i === 0 ? 1.15 : 0.85);
        return isP ? (
          <LobePair key={i} radius={radius} axis={type.slice(-1)} color={color} opacity={shellOpacity} />
        ) : (
          <SphereShell key={i} radius={radius} color={color} opacity={shellOpacity} />
        );
      })}
    </group>
  );
}
