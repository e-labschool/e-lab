import { useState, useMemo, useCallback } from "react";
import { Info } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ThreeCanvas from "../../components/3d/ThreeCanvas.jsx";
import { ORBITAL_DEFS } from "./lib/orbitalMath.js";
import { sampleOrbitalPoints, createSampler } from "./lib/orbitalSampling.js";
import { BASE_ORBITALS, ORIENTATIONS, ORIENTATION_LABELS, defaultOrientationFor } from "./lib/orbitalDefinitions.js";
import ProbabilityCloud, { FAMILY_COLOR } from "./components/ProbabilityCloud.jsx";
import { boundingRadiusFor } from "./lib/orbitalSampling.js";

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
  const [baseOrbital, setBaseOrbital] = useState("1s");
  const [orientation, setOrientation] = useState(null); // null for s orbitals (no orientation to choose)
  const [seed, setSeed] = useState(1);
  const [detectionCount, setDetectionCount] = useState(INITIAL_1S_COUNT);
  const [showHelp, setShowHelp] = useState(false);

  const orbitalId = orientation ?? baseOrbital;
  const def = ORBITAL_DEFS[orbitalId];
  const family = familyOf(baseOrbital);

  const points = useMemo(() => {
    const rng = createSampler(seed);
    return sampleOrbitalPoints(def.n, def.l, def.type, detectionCount, rng);
  }, [def, detectionCount, seed]);

  const handleSelectBase = useCallback((base) => {
    setBaseOrbital(base);
    setOrientation(ORIENTATIONS[base] ? defaultOrientationFor(base) : null);
    setDetectionCount(base === "1s" ? INITIAL_1S_COUNT : 400);
    setSeed((s) => s + 1);
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
    <InteractiveFrame title="Orbital Explorer" subtitle="Visualize atomic orbitals through their quantum-mechanical probability distributions." compact={compact}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 1000 }}>
        {/* orbital selector */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {BASE_ORBITALS.map((base) => (
            <button
              key={base}
              type="button"
              onClick={() => handleSelectBase(base)}
              aria-pressed={baseOrbital === base}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${baseOrbital === base ? "text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
              style={baseOrbital === base ? { backgroundColor: FAMILY_COLOR[familyOf(base)] } : undefined}
            >
              {BASE_LABELS[base]}
            </button>
          ))}
          <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label="About this simulation" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-faint)]">
            <Info size={13} />
          </button>
        </div>

        {/* orientation selector -- only shown when relevant */}
        {ORIENTATIONS[baseOrbital] && (
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {ORIENTATIONS[baseOrbital].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => handleSelectOrientation(o)}
                aria-pressed={orientation === o}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${orientation === o ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)] border" : "border border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
              >
                {ORIENTATION_LABELS[o]}
              </button>
            ))}
          </div>
        )}

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

        {/* 3D viewer */}
        <ThreeCanvas height={compact ? 340 : 460} cameraDistance={boundingRadiusFor(def.n) * 1.9} fallbackDescription="This device can't render the 3D orbital view. Try a device with WebGL support." fallbackLabel="Orbital viewer">
          <color attach="background" args={["#0A0E1A"]} />
          <Nucleus />
          <ProbabilityCloud points={points} family={family} />
        </ThreeCanvas>

        {/* simulated detections */}
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Simulated Detections</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">
            Each point represents a simulated position measurement from an identically prepared atom. Many measurements reveal the orbital probability distribution.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {DETECTION_STEPS.map((step) => (
              <button key={step} type="button" onClick={() => handleAddDetections(step)} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                {`+${step}`}
              </button>
            ))}
            <button type="button" onClick={handleClear} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
              Clear
            </button>
            <span className="ml-auto text-xs font-semibold text-[var(--color-ink)]">{detectionCount.toLocaleString()} detections</span>
          </div>
        </div>
      </div>
    </InteractiveFrame>
  );
}
