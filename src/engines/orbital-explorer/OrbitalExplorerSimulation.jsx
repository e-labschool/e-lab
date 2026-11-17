import { readableInk } from "../../components/interactive-shell/contrastInk.js";
import { useState, useMemo, useCallback } from "react";
import { Info } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ThreeCanvas from "../../components/3d/ThreeCanvas.jsx";
import { ORBITAL_DEFS } from "./lib/orbitalMath.js";
import { sampleOrbitalPoints, createSampler, boundingRadiusFor } from "./lib/orbitalSampling.js";
import { BASE_ORBITALS, ORIENTATIONS, ORIENTATION_LABELS, defaultOrientationFor } from "./lib/orbitalDefinitions.js";
import ProbabilityCloud, { FAMILY_COLOR } from "./components/ProbabilityCloud.jsx";
import RadialPlot from "./components/RadialPlot.jsx";
import NucleusDot, { NucleusNote } from "./components/NucleusDot.jsx";
import AtomBuilder from "./components/AtomBuilder.jsx";

const BASE_LABELS = { "1s": "1s", "2s": "2s", "2p": "2p", "3s": "3s", "3p": "3p", "3d": "3d", "4s": "4s", "4p": "4p" };
const DETECTION_STEPS = [1, 10, 100, 1000];
const INITIAL_1S_COUNT = 1400; // "beautiful but not excessively dense" default cloud
const MAX_DETECTIONS = 40000; // cap: every change re-samples the cloud, so unbounded counts froze the page (OE-03)
const DEFAULT_COUNT = { s: 2500, p: 5000, d: 8000 }; // enough points for p and d shapes to be recognisable (OE-04)
const HYDROGENIC_NOTE = "Hydrogen-like orbitals: the shapes and node counts are correct for any atom, but every orbital here is drawn with the hydrogen (Z = 1) radial function, so SIZES are not scaled for heavier atoms (in real atoms inner orbitals are far more compact).";

const SHAPE_TEXT = { s: "Spherically symmetric.", p: "Two lobes along one axis with a node at the nucleus.", d: "Four lobes (or two lobes and a ring) with two angular nodes." };

const ORIENTATION_COLORS = ["#FF8A65", "#4FC3F7", "#FFD54F", "#BA68C8", "#81C784"];

function familyOf(base) {
  if (base.includes("s")) return "s";
  if (base.includes("p")) return "p";
  return "d";
}

export default function OrbitalExplorerSimulation({ compact = false, standalone = false }) {
  const [mode, setMode] = useState("explore"); // "explore" | "build"
  const [baseOrbital, setBaseOrbital] = useState("1s");
  const [orientation, setOrientation] = useState(null); // null for s orbitals (no orientation to choose)
  const [seed, setSeed] = useState(1);
  const [detectionCount, setDetectionCount] = useState(INITIAL_1S_COUNT);
  const [showHelp, setShowHelp] = useState(false);
  const [showAll, setShowAll] = useState(false); // OE-06: draw all three p / all five d orientations together
  const [compareBase, setCompareBase] = useState(""); // OE-06: second radial curve on the same axes ("" = none)
  const [viewKey, setViewKey] = useState(0); // bumped to remount ThreeCanvas -- the camera-reset mechanism

  const orbitalId = orientation ?? baseOrbital;
  const def = ORBITAL_DEFS[orbitalId];
  const family = familyOf(baseOrbital);
  const compareDef = compareBase && compareBase !== baseOrbital ? ORBITAL_DEFS[ORIENTATIONS[compareBase]?.[0] ?? compareBase] : null;
  const radialNodes = def.n - def.l - 1;
  const angularNodes = def.l;

  const group = ORIENTATIONS[baseOrbital] && showAll ? ORIENTATIONS[baseOrbital] : null;
  const points = useMemo(() => {
    const rng = createSampler(seed);
    return sampleOrbitalPoints(def.n, def.l, def.type, detectionCount, rng);
  }, [def, detectionCount, seed]);
  // All orientations: each is sampled on its own (detectionCount in total, split evenly) and drawn in its own colour.
  const groupPoints = useMemo(() => {
    if (!group) return null;
    const each = Math.ceil(detectionCount / group.length);
    return group.map((id, i) => {
      const d = ORBITAL_DEFS[id];
      return { id, points: sampleOrbitalPoints(d.n, d.l, d.type, each, createSampler(seed * 31 + i + 1)) };
    });
  }, [group, detectionCount, seed]);

  const handleSelectBase = useCallback((base) => {
    setBaseOrbital(base);
    setOrientation(ORIENTATIONS[base] ? defaultOrientationFor(base) : null);
    setDetectionCount(base === "1s" ? INITIAL_1S_COUNT : DEFAULT_COUNT[familyOf(base)]);
    setSeed((s) => s + 1);
    setViewKey((k) => k + 1); // auto-reframe the camera for the newly selected orbital's own scale
  }, []);

  const handleSelectOrientation = useCallback((o) => {
    setOrientation(o);
    setSeed((s) => s + 1);
  }, []);

  const handleAddDetections = useCallback((n) => {
    setDetectionCount((c) => Math.min(MAX_DETECTIONS, c + n));
  }, []);

  const handleClear = useCallback(() => {
    setDetectionCount(0);
    setSeed((s) => s + 1);
  }, []);

  return (
    <InteractiveFrame title="Orbital Explorer" subtitle="Explore atomic orbitals and electron probability distributions" compact={compact} standalone={standalone}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 1180 }}>
        {/* mode tabs */}
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setMode("explore")} aria-pressed={mode === "explore"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "explore" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Explore an Orbital
          </button>
          <button type="button" onClick={() => setMode("build")} aria-pressed={mode === "build"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "build" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Atom View (all occupied orbitals)
          </button>
          <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label="About this simulation" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-faint)]">
            <Info size={13} />
          </button>
        </div>

        {showHelp && (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-xs text-[var(--color-ink-soft)]">
            <ul className="list-disc space-y-1 pl-4">
              <li>{HYDROGENIC_NOTE}</li>
              <li>The nucleus is drawn far larger than real scale (a real nucleus is about 10{"\u207B\u2075"} of an orbital radius).</li>
              <li>Cloud density represents relative electron probability density.</li>
              <li>Each detection point represents a simulated position measurement, not a separate electron.</li>
              <li>Colours distinguish orbital families and are not the orbital&rsquo;s actual colour.</li>
              <li>{"Electron trajectories are not represented \u2014 orbitals are probability distributions, not paths."}</li>
            </ul>
          </div>
        )}

        <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-[11px] text-[var(--color-ink-soft)]">{HYDROGENIC_NOTE}</p>

        {mode === "build" && <AtomBuilder compact={compact} />}

        {mode === "explore" && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[210px_minmax(0,1fr)_230px]">
            {/* LEFT: orbital controls */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital Controls</p>

              <div>
                <p className="mb-1 text-[10px] font-semibold text-[var(--color-ink-soft)]">Select an Orbital</p>
                <div className="grid grid-cols-2 gap-1">
                  {BASE_ORBITALS.map((base) => (
                    <button
                      key={base}
                      type="button"
                      onClick={() => handleSelectBase(base)}
                      aria-pressed={baseOrbital === base}
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold border ${baseOrbital === base ? "" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                      style={baseOrbital === base ? { backgroundColor: FAMILY_COLOR[familyOf(base)], color: readableInk(FAMILY_COLOR[familyOf(base)]), borderColor: "var(--sim-btn-border-hover)" } : undefined}
                    >
                      {BASE_LABELS[base]}
                    </button>
                  ))}
                </div>
              </div>

              {ORIENTATIONS[baseOrbital] && (
                <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[var(--color-ink)]">
                  <input type="checkbox" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setSeed((x) => x + 1); }} data-testid="show-all-orientations" className="mt-0.5" />
                  <span>Show all {ORIENTATIONS[baseOrbital].length === 3 ? "three p" : "five d"} orbitals together (one colour each)</span>
                </label>
              )}

              {ORIENTATIONS[baseOrbital] && !group && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold text-[var(--color-ink-soft)]">Orientation</p>
                  <div className="flex flex-col gap-1">
                    {ORIENTATIONS[baseOrbital].map((o) => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => handleSelectOrientation(o)}
                        aria-pressed={orientation === o}
                        className={`rounded-md px-2 py-1 text-left text-[11px] font-medium ${orientation === o ? "border border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
                      >
                        {ORIENTATION_LABELS[o]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-1 text-[10px] font-semibold text-[var(--color-ink-soft)]">Display Mode</p>
                <button type="button" aria-pressed="true" className="w-full rounded-md border border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] px-2 py-1.5 text-left text-[11px] font-semibold text-[var(--color-indigo)]">
                  Probability Cloud
                </button>
                <p className="mt-1 text-[10px] text-[var(--color-ink-soft)]">Brighter, denser regions are where the electron is more likely to be found.</p>
              </div>
            </div>

            {/* CENTER: 3D viewer */}
            <div className="relative" role="group" aria-label={`3D view of the ${def.n}${ORIENTATION_LABELS[orbitalId] ?? baseOrbital.slice(1)} orbital: ${detectionCount.toLocaleString()} simulated position detections. ${radialNodes} radial node${radialNodes === 1 ? "" : "s"}, ${angularNodes} angular node${angularNodes === 1 ? "" : "s"}. Drag to rotate, scroll to zoom; use the Reset view button to recentre.`}>
              <ThreeCanvas key={viewKey} keyboard ariaLabel={`3D probability cloud of the ${orbitalId} orbital, ${detectionCount.toLocaleString()} detections. ${SHAPE_TEXT[familyOf(baseOrbital)]}`} height={compact ? 380 : 500} cameraDistance={boundingRadiusFor(def.n) * 1.9} fallbackDescription="This device can't render the 3D orbital view. Try a device with WebGL support." fallbackLabel="Orbital viewer">
                <color attach="background" args={["#0A0E1A"]} />
                <NucleusDot />
                {groupPoints
                  ? groupPoints.map((g, i) => <ProbabilityCloud key={g.id} points={g.points} family={family} color={ORIENTATION_COLORS[i % ORIENTATION_COLORS.length]} />)
                  : <ProbabilityCloud points={points} family={family} />}
              </ThreeCanvas>
              <NucleusNote />
            </div>

            {/* RIGHT: detections + orbital info */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Simulated Detections</p>
                <p className="mt-0.5 text-[10.5px] text-[var(--color-ink-faint)]">Each point is a simulated position measurement, not a separate electron.</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DETECTION_STEPS.map((step) => (
                    <button key={step} type="button" onClick={() => handleAddDetections(step)} disabled={detectionCount >= MAX_DETECTIONS} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30 disabled:cursor-not-allowed disabled:opacity-50">
                      {`+${step}`}
                    </button>
                  ))}
                  <button type="button" onClick={handleClear} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                    Clear
                  </button>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--color-ink)]">{detectionCount.toLocaleString()} detections</p>
                <p className="text-[10.5px] text-[var(--color-ink-soft)]" role="status" aria-live="polite">{detectionCount >= MAX_DETECTIONS ? `Maximum of ${MAX_DETECTIONS.toLocaleString()} detections reached (more points would only slow the page down). Press Clear to start again.` : `Up to ${MAX_DETECTIONS.toLocaleString()} detections.`}</p>
              </div>

              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital Information</p>
                <p className="mt-1 text-lg font-bold" style={{ color: FAMILY_COLOR[family] }}>{group ? `${baseOrbital} (all ${group.length})` : ORIENTATION_LABELS[orbitalId] ? `${def.n}${ORIENTATION_LABELS[orbitalId]}` : orbitalId}</p>
                {group && (
                  <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--color-ink-soft)]" aria-label="Colour key">
                    {group.map((id, i) => (
                      <li key={id} className="flex items-center gap-1"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ORIENTATION_COLORS[i % ORIENTATION_COLORS.length] }} />{ORIENTATION_LABELS[id]}</li>
                    ))}
                  </ul>
                )}
                <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-soft)]">
                  <dt>n</dt><dd className="text-right">{def.n}</dd>
                  <dt>l</dt><dd className="text-right">{def.l}</dd>
                  <dt>Radial nodes</dt><dd className="text-right">{radialNodes}</dd>
                  <dt>Angular nodes</dt><dd className="text-right">{angularNodes}</dd>
                </dl>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Radial distribution</p>
                <RadialPlot n={def.n} l={def.l} color={FAMILY_COLOR[family]} compare={compareDef ? { n: compareDef.n, l: compareDef.l, label: compareBase } : null} />
                <label className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-ink-soft)]">Compare with
                  <select value={compareDef ? compareBase : ""} onChange={(e) => setCompareBase(e.target.value)} data-testid="radial-compare-select" aria-label="Compare the radial distribution with another orbital" className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-1.5 py-0.5 text-[11px] text-[var(--color-ink)]">
                    <option value="">none</option>
                    {BASE_ORBITALS.filter((b) => b !== baseOrbital).map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </InteractiveFrame>
  );
}
