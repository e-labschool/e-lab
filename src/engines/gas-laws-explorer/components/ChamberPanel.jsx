import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Lock, Pause, Play } from "lucide-react";
import { VARS, formatValue } from "../model.js";
import { createRenderer } from "../render.js";
import { VAR_CHIP } from "../theme.js";
import { AmountChip } from "./ControlPanel.jsx";
import { DashPanel, LiveStrip } from "../../../components/simulation/SimulationDashboard.jsx";

const CALLOUT = {
  pv: { text: "Piston moves with the volume", icon: "move" },
  vt: { text: "Piston is free", icon: "move" },
  pt: { text: "Piston is fixed", icon: "lock" },
  vn: { text: "Piston is free", icon: "move" },
};

// Animated chamber. Owns ONLY the rAF loop + canvas sizing; the physics lives
// in `sim` (physics.js) and the drawing in render.js. Loop + ResizeObserver are
// torn down on unmount. The canvas is absolutely positioned inside its box, so
// it can never push its parent larger.
function Chamber({ sim, reducedMotion, label }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const renderer = createRenderer();
    const view = { cssW: 300, cssH: 300, dpr: 1, reducedMotion };
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      view.cssW = Math.max(60, Math.floor(rect.width));
      view.cssH = Math.max(60, Math.floor(rect.height));
      view.dpr = dpr;
      canvas.width = Math.round(view.cssW * dpr);
      canvas.height = Math.round(view.cssH * dpr);
      canvas.style.width = `${view.cssW}px`;
      canvas.style.height = `${view.cssH}px`;
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(wrap);
    let raf = 0;
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      sim.advance(dt);
      renderer.draw(ctx, sim, view);
      canvas.dataset.pistonH = sim.pistonH.toFixed(2); // read-only hook for tests / debugging
      canvas.dataset.particles = String(sim.particles.length);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [sim, reducedMotion]);
  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} role="img" aria-label={label} className="block" data-testid="gas-canvas" />
    </div>
  );
}

/** Chamber column: the animated cylinder (the main focus) with a short piston caption and play/pause. */
export function ChamberPanel({ sim, state, accent, playing, onTogglePlay, reducedMotion }) {
  const callout = CALLOUT[state.mode];
  const label = `Gas cylinder with ${Math.round(sim.particles.length)} particles at ${state.T.toFixed(0)} kelvin, ${state.V.toFixed(1)} litres, ${state.P.toFixed(2)} atmospheres, ${state.n.toFixed(2)} moles`;
  return (
    <DashPanel ariaLabel="Gas chamber" grow noBody className="!p-1.5">
      <div className="sd-chamber" data-testid="chamber">
        <Chamber sim={sim} reducedMotion={reducedMotion} label={label} />
        <div className="sd-chamber-badge" style={{ background: accent.soft, borderColor: accent.border, color: accent.text }} data-testid="piston-callout">
          {callout.icon === "lock" ? <Lock size={13} className="shrink-0" aria-hidden="true" /> : <ArrowUpDown size={13} className="shrink-0" aria-hidden="true" />}
          {callout.text}
        </div>
        <button
          type="button" className="sd-chamber-btn" onClick={onTogglePlay} data-testid="play-pause"
          aria-label={playing ? "Pause simulation" : "Play simulation"} title={playing ? "Pause simulation" : "Play simulation"}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
        <p className="sd-chamber-foot" title="Particles are a visual sample of the gas (1 particle is about 0.05 mol), not every molecule.">
          1 particle ≈ 0.05 mol (visual sample)
        </p>
      </div>
    </DashPanel>
  );
}

/** One-line strip of the four variables; the amount also follows the chosen unit. */
export function LiveValues({ state, unit }) {
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(`Pressure ${state.P.toFixed(2)} atmospheres, volume ${state.V.toFixed(1)} litres, temperature ${state.T.toFixed(0)} kelvin, amount ${state.n.toFixed(2)} moles.`);
    }, 700);
    return () => clearTimeout(t);
  }, [state.P, state.V, state.T, state.n]);
  const item = (k) => ({
    id: k,
    label: k,
    value: k === "n" ? <AmountChip n={state.n} unit={unit} /> : `${formatValue(k, state[k])} ${VARS[k].unit}`,
    bg: VAR_CHIP[k],
    testId: `live-${k}`,
    title: VARS[k].name,
  });
  return (
    <>
      <LiveStrip items={["P", "V", "T", "n"].map(item)} />
      <p className="sd-sr" role="status" aria-live="polite">{announce}</p>
    </>
  );
}
