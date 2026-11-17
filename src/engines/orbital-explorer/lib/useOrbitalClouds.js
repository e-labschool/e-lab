import { useEffect, useState } from "react";
import { ORBITAL_DEFS } from "./orbitalMath.js";
import { colorForOrbitalId } from "./orbitalColors.js";
import { cloudFor, getCloud, hasCloud } from "./cloudCache.js";

/** OE-10: samples the clouds of `ids` one orbital per task (so the page stays responsive and can say what it is doing)
 *  instead of all at once inside render.  Clouds that are already cached are returned immediately.
 *  Returns { clouds: [{ id, def, points, color }], done, total, pending }. */
export function useOrbitalClouds(ids, pointsPer) {
  const [, setTick] = useState(0);
  const idsKey = ids.join(",");
  useEffect(() => {
    const missing = ids.filter((id) => !hasCloud(id, pointsPer));
    if (!missing.length) return undefined;
    let cancelled = false; let timer = 0; let i = 0;
    const step = () => {
      if (cancelled) return;
      cloudFor(missing[i], pointsPer); i += 1;
      setTick((t) => t + 1);
      if (i < missing.length) timer = setTimeout(step, 0);
    };
    timer = setTimeout(step, 0);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, pointsPer]);
  const clouds = ids.filter((id) => hasCloud(id, pointsPer)).map((id) => ({ id, def: ORBITAL_DEFS[id], points: getCloud(id, pointsPer), color: colorForOrbitalId(id) }));
  return { clouds, done: clouds.length, total: ids.length, pending: clouds.length < ids.length };
}
