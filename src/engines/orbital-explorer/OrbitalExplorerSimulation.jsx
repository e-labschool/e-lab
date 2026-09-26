import { useState, useMemo, useCallback } from "react";
import { Info } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ThreeCanvas from "../../components/3d/ThreeCanvas.jsx";
import { ORBITAL_DEFS } from "./lib/orbitalMath.js";
import { sampleOrbitalPoints, createSampler, boundingRadiusFor } from "./lib/orbitalSampling.js";
import { BASE_ORBITALS, ORIENTATIONS, ORIENTATION_LABELS, defaultOrientationFor } from "./lib/orbitalDefinitions.js";
import ProbabilityCloud, { FAMILY_COLOR } from "./components/ProbabilityCloud.jsx";
import AtomBuilder from "./components/AtomBuilder.jsx";

function Nucleus() {
  return (
    <mesh>
      <sphereGeometry args={[0.35, 16, 16]} />
      <meshStandardMaterial color="#F5C542" emissive="#8a6400" emissiveIntensity={0.6} />
    </mesh>
  );
}

const BASE_LABELS = { "1s": "1s", "2s": "2s", "2p": "2p", "3s": "3s", "3p": "3p", "3d": "3d", "4s": "4s" };
const DETECTION_STEPS = [1, 10, 100, 1000];
const INITIAL_1S_COUNT = 1400; // "beautiful but not excessively dense" default cloud

function familyOf(base) {
  if (base.includes("s")) return "s";
  if (base.includes("p")) return "p";
  return "d";
}

export default function OrbitalExplorerSimulation({ compact = false }) {
  const [mode, setMode] = useState("explore"); // "explore" | "build"
  const [baseOrbital, setBaseOrbital] = useState("1s");
  const [orientation, setOrientation] = useState(null); // null for s orbitals (no orientation to choose)
  const [seed, setSeed] = useState(1);
  const [detectionCount, setDetectionCount] = useState(INITIAL_1S_COUNT);
  const [showHelp, setShowHelp] = useState(false);
  const [viewKey, setViewKey] = useState(0); // bumped to remount ThreeCanvas -- the camera-reset mechanism

  const orbitalId = orientation ?? baseOrbital;
  const def = ORBITAL_DEFS[orbitalId];
  const family = familyOf(baseOrbital);
  const radialNodes = def.n - def.l - 1;
  const angularNodes = def.l;

  const points = useMemo(() => {
    const rng = createSampler(seed);
    return sampleOrbitalPoints(def.n, def.l, def.type, detectionCount, rng);
  }, [def, detectionCount, seed]);

  const handleSelectBase = useCallback((base) => {
    setBaseOrbital(base);
    setOrientation(ORIENTATIONS[base] ? defaultOrientationFor(base) : null);
    setDetectionCount(base === "1s" ? INITIAL_1S_COUNT : 400);
    setSeed((s) => s + 1);
    setViewKey((k) => k + 1); // auto-reframe the camera for the newly selected orbital's own scale
  }, []);

  const handleSelectOrientation = useCallback((o) => {
    setOrientation(o);
    setSeed((s) => s + 1);
  }, []);

  const handleAddDetections = useCallback((n) => {
    setDetectionCount((c) => c + n);
  }, []);

  const handleClear = useCallback(() => {
    setDetectionCount(0);
    setSeed((s) => s + 1);
  }, []);

  return (
    <InteractiveFrame title="Orbital Explorer" subtitle="Explore atomic orbitals and electron probability distributions" compact={compact}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 1180 }}>
        {/* mode tabs */}
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setMode("explore")} aria-pressed={mode === "explore"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "explore" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Explore an Orbital
          </button>
          <button type="button" onClick={() => setMode("build")} aria-pressed={mode === "build"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "build" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Build an Atom
          </button>
          <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label="About this simulation" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-faint)]">
            <Info size={13} />
          </button>
        </div>

        {showHelp && (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-xs text-[var(--color-ink-soft)]">
            <ul className="list-disc space-y-1 pl-4">
              <li>Cloud density represents relative electron probability density.</li>
              <li>Each detection point represents a simulated position measurement, not a separate electron.</li>
              <li>Colours distinguish orbital families and are not the orbital&rsquo;s actual colour.</li>
              <li>{"Electron trajectories are not represented \u2014 orbitals are probability distributions, not paths."}</li>
            </ul>
          </div>
        )}

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
                      className={`rounded-md px-2 py-1.5 text-xs font-semibold ${baseOrbital === base ? "text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                      style={baseOrbital === base ? { backgroundColor: FAMILY_COLOR[familyOf(base)] } : undefined}
                    >
                      {BASE_LABELS[base]}
                    </button>
                  ))}
                </div>
              </div>

              {ORIENTATIONS[baseOrbital] && (
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
                <p className="mt-1 text-[9.5px] text-[var(--color-ink-faint)]">Boundary Surface and Cross-section are not yet available.</p>
              </div>
            </div>

            {/* CENTER: 3D viewer */}
            <div className="relative">
              <ThreeCanvas key={viewKey} height={compact ? 380 : 500} cameraDistance={boundingRadiusFor(def.n) * 1.9} fallbackDescription="This device can't render the 3D orbital view. Try a device with WebGL support." fallbackLabel="Orbital viewer">
                <color attach="background" args={["#0A0E1A"]} />
                <Nucleus />
                <ProbabilityCloud points={points} family={family} />
              </ThreeCanvas>
            </div>

            {/* RIGHT: detections + orbital info */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Simulated Detections</p>
                <p className="mt-0.5 text-[10.5px] text-[var(--color-ink-faint)]">Each point is a simulated position measurement, not a separate electron.</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {DETECTION_STEPS.map((step) => (
                    <button key={step} type="button" onClick={() => handleAddDetections(step)} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                      {`+${step}`}
                    </button>
                  ))}
                  <button type="button" onClick={handleClear} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                    Clear
                  </button>
                </div>
                <p className="mt-2 text-sm font-bold text-[var(--color-ink)]">{detectionCount.toLocaleString()} detections</p>
              </div>

              <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital Information</p>
                <p className="mt-1 text-lg font-bold" style={{ color: FAMILY_COLOR[family] }}>{ORIENTATION_LABELS[orbitalId] ? `${def.n}${ORIENTATION_LABELS[orbitalId]}` : orbitalId}</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-ink-soft)]">
                  <dt>n</dt><dd className="text-right">{def.n}</dd>
                  <dt>l</dt><dd className="text-right">{def.l}</dd>
                  <dt>Radial nodes</dt><dd className="text-right">{radialNodes}</dd>
                  <dt>Angular nodes</dt><dd className="text-right">{angularNodes}</dd>
                </dl>
              </div>
            </div>
          </div>
        )}
      </div>
    </InteractiveFrame>
  );
}
