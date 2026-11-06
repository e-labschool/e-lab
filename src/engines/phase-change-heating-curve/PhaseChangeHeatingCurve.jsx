import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Flame, Snowflake, Play, Pause, RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { createFrameClock } from "../../lib/frameTime.js";
import { PALETTE, STATE_ACCENT } from "../particle-model-visualizer/data/palette.js";
import ParticleCanvas from "./components/ParticleCanvas.jsx";
import CurveGraph from "./components/CurveGraph.jsx";
import { segColor } from "./lib/colors.js";
import { buildCurve, curveState, SEGMENT_CAPTION, TOTAL_SECONDS_AT_1X } from "./data/curveModel.js";
import { useSize } from "./lib/useSize.js";

// Container width (px) at which the split screen (particles | graph) replaces the stacked layout.
export const WIDE_MIN_WIDTH = 760;
const SPEEDS = [0.5, 1, 2, 4];
const STEPS = 1000;

const pct = (x) => `${Math.round(x * 100)} %`;
const fmtT = (t) => `${t < 0 ? "−" : ""}${Math.abs(Math.round(t))} °C`;

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return undefined;
    const h = (e) => setR(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return r;
}

// Heating AND cooling curve for water at 1 atm, with the particles and the graph driven by ONE progress value
// (0..1 of the active mode). See data/curveModel.js (pure model), lib/particles.js (pure particle model) and
// docs/HEATING_COOLING_CURVE.md.
export default function PhaseChangeHeatingCurve({ compact = false, standalone = false }) {
  const [mode, setMode] = useState("heating");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [toScale, setToScale] = useState(false);

  const curve = useMemo(() => buildCurve(toScale ? "true" : "schematic"), [toScale]);
  const state = useMemo(() => curveState(curve, mode, progress), [curve, mode, progress]);
  const stateRef = useRef(state);
  useLayoutEffect(() => { stateRef.current = state; }, [state]);

  // The only writer of `progress` while playing: a frame loop with the clamped frame time.
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    if (!playing) return undefined;
    const clock = createFrameClock();
    let raf = 0;
    const tick = (now) => {
      const dt = clock.tick(now);
      if (dt > 0) {
        setProgress((p) => {
          const next = Math.min(1, p + (dt * speedRef.current) / TOTAL_SECONDS_AT_1X);
          if (next >= 1) setPlaying(false);
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clock.dispose(); };
  }, [playing]);

  const onPlayPause = useCallback(() => {
    if (playing) { setPlaying(false); return; }
    if (progress >= 1) setProgress(0); // replay from the start of this mode
    setPlaying(true);
  }, [playing, progress]);
  const onReset = useCallback(() => { setPlaying(false); setProgress(0); }, []);
  const onMode = useCallback((m) => { if (m === mode) return; setMode(m); setProgress(0); setPlaying(false); }, [mode]);
  const onScrub = useCallback((v) => { setPlaying(false); setProgress(Math.min(1, Math.max(0, Number(v) / STEPS))); }, []);

  const body = (
    <Workspace
      curve={curve} mode={mode} state={state} stateRef={stateRef} progress={progress} playing={playing} speed={speed} toScale={toScale}
      onPlayPause={onPlayPause} onReset={onReset} onMode={onMode} onScrub={onScrub} onSpeed={setSpeed} onToScale={setToScale}
    />
  );

  return (
    <InteractiveFrame title="Phase Change & Heating Curve" subtitle="Heating and cooling curves: energy, particle motion and temperature in one story" compact={compact} standalone={standalone}>
      {body}
    </InteractiveFrame>
  );
}

function Workspace({ curve, mode, state, stateRef, progress, playing, speed, toScale, onPlayPause, onReset, onMode, onScrub, onSpeed, onToScale }) {
  const { isViewport } = useSimulationPresentation();
  const [rootRef, { width }] = useSize();
  const reduced = useReducedMotion();
  const wide = width === 0 || width >= WIDE_MIN_WIDTH;
  const sub = curve.substance;
  const heating = mode === "heating";
  const atEnd = progress >= 1;

  const newPhaseText = (() => {
    const f = state.phaseFractions;
    return `Solid ${pct(f.solid)} · Liquid ${pct(f.liquid)} · Gas ${pct(f.gas)}`;
  })();
  const accent = segColor(state.segmentKey);

  const modeBtn = (m, label) => (
    <button key={m} type="button" role="radio" aria-checked={mode === m} aria-pressed={mode === m} onClick={() => onMode(m)} className={"sim-btn" + (mode === m ? " sim-btn--primary" : "")} data-testid={`hc-mode-${m}`}>
      {m === "heating" ? <Flame size={14} aria-hidden="true" /> : <Snowflake size={14} aria-hidden="true" />}{label}
    </button>
  );

  const particlePanel = (
    <section className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg border p-3" style={{ borderColor: PALETTE.border, background: PALETTE.panelRaised }} aria-label="Particle container" data-testid="hc-particle-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PALETTE.eyebrow }}>Particles ({sub.name.toLowerCase()})</p>
        <p className="text-xl font-semibold tabular-nums" style={{ color: PALETTE.textPrimary }} data-testid="hc-temp">{fmtT(state.temp)}</p>
      </div>
      <p className="text-xs font-semibold" style={{ color: accent }} data-testid="hc-segment-label">
        {state.segmentLabel}
        <span className="font-normal" style={{ color: PALETTE.textSecondary }}> &mdash; {state.isPlateau ? "temperature constant" : heating ? "temperature rising" : "temperature falling"}</span>
      </p>
      <ParticleCanvas stateRef={stateRef} reducedMotion={reduced} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <Meter label="Kinetic energy (∝ T in K)" value={state.keRelative} color={STATE_ACCENT.gas} testid="hc-ke" />
        <Meter label="Potential energy (arrangement)" value={state.peRelative} color={STATE_ACCENT.solid} testid="hc-pe" />
      </div>
      <p className="text-[11px] tabular-nums" style={{ color: PALETTE.textSecondary }} data-testid="hc-fractions">{newPhaseText}</p>
    </section>
  );

  const graphPanel = (
    <section className="flex min-h-0 min-w-0 flex-col gap-2 rounded-lg border p-3" style={{ borderColor: PALETTE.border, background: PALETTE.panelRaised }} aria-label="Temperature against time graph" data-testid="hc-graph-panel">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PALETTE.eyebrow }}>{heating ? "Heating" : "Cooling"} curve &mdash; {sub.name.toLowerCase()}</p>
        <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: heating ? "#F0A458" : "#7FB4FF" }} data-testid="hc-energy-flow">
          {heating ? <Flame size={13} aria-hidden="true" /> : <Snowflake size={13} aria-hidden="true" />}
          Energy {state.energyFlow}
        </p>
      </div>
      <CurveGraph curve={curve} mode={mode} state={state} />
      <p className="text-[11px] leading-snug" style={{ color: PALETTE.textSecondary }} data-testid="hc-caption">{SEGMENT_CAPTION[state.segmentKey]}</p>
      <p className="text-[11px] leading-snug" style={{ color: PALETTE.textFaint }} data-testid="hc-assumption">
        Assumes constant {heating ? "heating" : "cooling"} power, so time is proportional to energy. {heating ? "" : "The cooling curve is the heating curve reversed: energy is released on condensation and freezing. "}
        {sub.name} at 1 atm: melting point {sub.tMelt} °C, boiling point {sub.tBoil} °C.
        {toScale ? " Time axis to scale." : " Time axis schematic: plateau lengths are shortened (boiling alone is 72 % of the true energy)."}
      </p>
    </section>
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="hc-controls">
      <div role="radiogroup" aria-label="Mode" className="flex items-center gap-1.5">{modeBtn("heating", "Heating")}{modeBtn("cooling", "Cooling")}</div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onPlayPause} className="sim-btn sim-btn--primary" data-testid="hc-play" aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}>
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{playing ? "Pause" : atEnd ? "Replay" : "Play"}
        </button>
        <button type="button" onClick={onReset} className="sim-btn" data-testid="hc-reset" aria-label={`Reset to the start of the ${mode} curve`} title={`Back to the start of ${mode}`}>
          <RotateCcw size={14} aria-hidden="true" />Reset
        </button>
      </div>
      <label className="flex min-w-[200px] flex-1 basis-[240px] items-center gap-2 text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>
        <span className="shrink-0">Progress</span>
        <input type="range" min={0} max={STEPS} step={1} value={Math.round(progress * STEPS)} onChange={(e) => onScrub(e.target.value)} className="h-6 min-w-0 flex-1" style={{ accentColor: "#8FA4FF" }} data-testid="hc-slider" aria-label="Progress along the curve" aria-valuetext={`${fmtT(state.temp)}, ${state.segmentLabel}`} />
      </label>
      <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>
        Speed
        <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))} className="sim-btn h-8 min-h-0 px-1.5" data-testid="hc-speed" aria-label="Animation speed">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}&times;</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: PALETTE.textSecondary }}>
        <input type="checkbox" checked={toScale} onChange={(e) => onToScale(e.target.checked)} className="h-4 w-4" data-testid="hc-to-scale" />
        Time axis to scale
      </label>
    </div>
  );

  const rootStyle = { background: PALETTE.bg, borderColor: PALETTE.border, ...(isViewport ? {} : { height: wide ? "clamp(540px, calc(100dvh - 8rem), 760px)" : undefined }) };

  return (
    <div
      ref={rootRef}
      className={"sim-surface-dark mx-auto flex w-full min-w-0 flex-col gap-3 rounded-xl border p-3 " + (isViewport ? "h-full min-h-0 overflow-y-auto" : "")}
      style={{ maxWidth: isViewport ? undefined : 1500, ...rootStyle }}
      data-testid="hc-root"
      data-layout={wide ? "wide" : "stacked"}
      data-mode={mode}
      data-progress={progress.toFixed(4)}
      data-segment={state.segmentKey}
      data-temp={state.temp.toFixed(2)}
      data-playing={playing ? "1" : "0"}
    >
      <div className={"grid gap-3 " + (wide ? "min-h-0 flex-1" : "shrink-0")} style={wide ? { gridTemplateColumns: "minmax(0, 46fr) minmax(0, 54fr)" } : { gridTemplateColumns: "minmax(0, 1fr)" }}>
        {particlePanel}
        {graphPanel}
      </div>
      {controls}
    </div>
  );
}

function Meter({ label, value, color, testid }) {
  return (
    <div className="min-w-0" data-testid={testid} data-value={value.toFixed(4)}>
      <div className="flex justify-between gap-2 text-[11px]" style={{ color: PALETTE.textSecondary }}>
        <span className="truncate">{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: PALETTE.border }}>
        <div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
      </div>
    </div>
  );
}
