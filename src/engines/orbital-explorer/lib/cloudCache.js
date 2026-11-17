// Sampled probability clouds, cached per (orbital, point count) so stepping through elements only samples new orbitals (OE-10).
// Deterministic: the seed depends only on the orbital id and the point count.
import { ORBITAL_DEFS } from "./orbitalMath.js";
import { sampleOrbitalPoints, createSampler } from "./orbitalSampling.js";

const CACHE = new Map();
const MAX_ENTRIES = 160;
const keyOf = (id, points) => `${id}:${points}`;

export const hasCloud = (id, points) => CACHE.has(keyOf(id, points));
export const getCloud = (id, points) => CACHE.get(keyOf(id, points)) ?? null;

export function cloudFor(id, points) {
  const key = keyOf(id, points);
  let cloud = CACHE.get(key);
  if (!cloud) {
    const def = ORBITAL_DEFS[id];
    cloud = sampleOrbitalPoints(def.n, def.l, def.type, points, createSampler(id.charCodeAt(0) * 97 + id.length + points));
    if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value);
    CACHE.set(key, cloud);
  }
  return cloud;
}

export function clearCloudCache() { CACHE.clear(); }
