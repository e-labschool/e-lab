import { boundingRadiusFor } from "../lib/orbitalSampling.js";
import ProbabilityCloud from "./ProbabilityCloud.jsx";
import OrbitalBoundary from "./OrbitalBoundary.jsx";
import OrbitalAxes from "./OrbitalAxes.jsx";
import NucleusDot from "./NucleusDot.jsx";

/** Renders every orbital in `visibleIds` as its own probability-density
 * point cloud PLUS a translucent boundary region, all sharing the same
 * nucleus/origin -- never offset apart, per the explicit requirement
 * that Atom View shows real spatial overlap, not separate little atoms.
 * `clouds` come from useOrbitalClouds (sampled one orbital per task and
 * cached, OE-10); toggling visibility/highlight never re-samples.
 * `highlightedId`, if set, renders that one orbital at full opacity/size
 * while others dim -- the link back to the legend/info panel and the
 * orbital box diagram. */
export default function AtomViewer({ clouds, maxN, visibleIds, highlightedId }) {
  const anyHighlighted = Boolean(highlightedId);
  const axisLength = boundingRadiusFor(maxN) * 0.58;

  return (
    <>
      <NucleusDot />
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
