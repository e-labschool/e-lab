import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ParticleChamber from "../particle-model-visualizer/components/ParticleChamber.jsx";
import ChamberWalls from "../particle-model-visualizer/components/ChamberWalls.jsx";
import { PALETTE } from "../particle-model-visualizer/data/palette.js";
import PhaseParticles from "./components/PhaseParticles.jsx";
import HeatingCurve from "./components/HeatingCurve.jsx";
import StatusStrip from "./components/StatusStrip.jsx";
import PhaseCaption from "./components/PhaseCaption.jsx";
import TemperatureReadout from "./components/TemperatureReadout.jsx";
import BunsenBurner from "./components/BunsenBurner.jsx";
import { stageKeyAt, DONE_AT } from "./data/timeline.js";

const FALLBACK_DESCRIPTION =
  "A single glass chamber shows the same particles heating from solid through liquid to gas, alongside a synchronized heating curve.";

// A simple, non-interactive teaching animation — reuses the glass chamber
// and particle-rendering infrastructure built for the Particle Model
// Visualizer (imported read-only, nothing there is modified) rather than
// duplicating it. See PhaseParticles.jsx for how the single shared clock
// keeps the 3D chamber and the 2D graph perfectly in step.
export default function PhaseChangeHeatingCurve({ compact = false }) {
  const clockRef = useRef({ t: 0, finished: false });
  const heatingCurveRef = useRef(null);
  const temperatureRef = useRef(null);
  const [stageKey, setStageKey] = useState("solidHeat");
  const [finished, setFinished] = useState(false);
  const [runId, setRunId] = useState(0);

  // The single outer render-loop for everything outside the 3D canvas:
  // reads the clock PhaseParticles is advancing and pushes it straight
  // into the graph's SVG via refs (no per-frame React state), only
  // touching React state when the discrete stage actually changes.
  useEffect(() => {
    let raf;
    const tick = () => {
      const t = clockRef.current.t;
      heatingCurveRef.current?.render(t);
      temperatureRef.current?.render(t);
      const key = stageKeyAt(Math.min(t, DONE_AT));
      setStageKey((prev) => (prev === key ? prev : key));
      setFinished((prev) => (prev === clockRef.current.finished ? prev : clockRef.current.finished));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleReplay() {
    setRunId((id) => id + 1); // remounts PhaseParticles, which resets clockRef.current itself
    setFinished(false);
    setStageKey("solidHeat");
    heatingCurveRef.current?.render(0);
    temperatureRef.current?.render(0);
  }

  const body = (
    <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: PALETTE.border, background: PALETTE.bg }}>
      <div className="pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: PALETTE.eyebrow }}>
          Phase Change &amp; Heating Curve
        </p>
        {!compact && (
          <p className="text-xs" style={{ color: PALETTE.textFaint }}>
            See what happens to particles as energy is added.
          </p>
        )}
      </div>

      {/* Side by side from tablet width up — only genuinely small mobile
          screens stack these, since watching the particles and the graph
          together is the whole point of the animation. */}
      <div className="flex flex-col gap-3 md:flex-row">
        <div
          className="flex flex-col gap-2.5 rounded-lg border px-3 py-3 md:w-1/2"
          style={{ borderColor: PALETTE.border, background: PALETTE.panel }}
        >
          <TemperatureReadout ref={temperatureRef} />

          {/* Chamber and burner are grouped with a tight gap so the flame
              sits close under the glass, visually heating it — the rest of
              the panel keeps its normal spacing. */}
          <div className="flex flex-col items-center gap-1">
            <ParticleChamber height={compact ? 300 : 340} fallbackDescription={FALLBACK_DESCRIPTION}>
              <ChamberWalls />
              <PhaseParticles key={runId} clockRef={clockRef} />
            </ParticleChamber>
            <BunsenBurner active={!finished} />
          </div>

          <PhaseCaption stageKey={stageKey} />
        </div>

        <div className="md:w-1/2">
          <HeatingCurve ref={heatingCurveRef} />
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center gap-2">
        <StatusStrip stageKey={stageKey} />
        {finished && (
          <button
            type="button"
            onClick={handleReplay}
            className="flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
            style={{ borderColor: PALETTE.borderStrong, color: PALETTE.textPrimary, background: PALETTE.panelRaised }}
          >
            <RotateCcw size={13} /> Replay
          </button>
        )}
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="Phase Change & Heating Curve" subtitle="See what happens to particles as energy is added.">
      {body}
    </InteractiveFrame>
  );
}
