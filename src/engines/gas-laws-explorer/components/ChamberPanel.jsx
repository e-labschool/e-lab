import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpDown, Lock, Pause, Play } from "lucide-react";
import { VARS, formatValue } from "../model.js";
import { createRenderer } from "../render.js";
import { DECK_RESERVE, computeDeckLayout } from "../deckLayout.js";
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
function Chamber({ sim, reducedMotion, label, bottomInset = 0 }) {
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
    <div ref={wrapRef} className="absolute inset-0" style={bottomInset ? { bottom: bottomInset } : undefined}>
      <canvas ref={canvasRef} role="img" aria-label={label} className="block" data-testid="gas-canvas" />
    </div>
  );
}


// ---------------------------------------------------------------------------
// Instrument deck: two digital instruments mounted on a plinth directly under the
// cylinder's base. They show the SAME resolved state values (and formatValue
// precision / units) as the Controls panel and the live strip -- nothing is
// calculated here. The deck is positioned from computeLayout() (the renderer's own
// geometry) so it always sits exactly under the drawn base; it is DOM, not canvas.
// ---------------------------------------------------------------------------
function useDeckGeometry(boxRef) {
  const [geo, setGeo] = useState(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const n = computeDeckLayout(el.clientWidth, el.clientHeight);
      setGeo((g) => (g && g.left === n.left && g.top === n.top && g.width === n.width && g.reserve === n.reserve ? g : n));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [boxRef]);
  return geo;
}

function Gauge({ k, tone, text, short, state }) {
  const v = VARS[k];
  return (
    <div className={`gl-gauge gl-gauge--${tone}`} role="group" aria-label={`${text} instrument`} data-testid={`gauge-${k}`}>
      <span className="gl-gauge-label"><i aria-hidden="true" />{short ? <><span className="gl-l-full">{text}</span><span className="gl-l-short">{short}</span></> : text}</span>
      <span className="gl-gauge-read" data-testid={`gauge-${k}-value`}>
        <b>{formatValue(k, state[k])}</b>{" "}<small>{v.unit}</small>
      </span>
    </div>
  );
}

export function InstrumentDeck({ state, geo }) {
  if (!geo) return null;
  return (
    <div
      className="gl-deck" data-testid="instrument-deck" role="group" aria-label="Instruments"
      style={{ left: geo.left, top: geo.top, width: geo.width, height: geo.height }}
    >
      <Gauge k="P" tone="p" text="PRESSURE" short="PRESS." state={state} />
      <Gauge k="T" tone="t" text="TEMPERATURE" short="TEMP" state={state} />
    </div>
  );
}

/** Chamber column: the animated cylinder (the main focus) with a short piston caption and play/pause. */
export function ChamberPanel({ sim, state, accent, playing, onTogglePlay, reducedMotion }) {
  const callout = CALLOUT[state.mode];
  const boxRef = useRef(null);
  const geo = useDeckGeometry(boxRef);
  const label = `Gas cylinder with ${Math.round(sim.particles.length)} particles at ${state.T.toFixed(0)} kelvin, ${state.V.toFixed(1)} litres, ${state.P.toFixed(2)} atmospheres, ${state.n.toFixed(2)} moles`;
  return (
    <DashPanel ariaLabel="Gas chamber" grow noBody className="!p-1.5">
      <div className="sd-chamber" data-testid="chamber" ref={boxRef}>
        <Chamber sim={sim} reducedMotion={reducedMotion} label={label} bottomInset={geo ? geo.reserve : DECK_RESERVE} />
        <InstrumentDeck state={state} geo={geo} />
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
export function LiveValues({ state, unit, note }) {
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
    <div className="gl-live">
      <LiveStrip items={["P", "V", "T", "n"].map(item)} />
      {note && <p className="gl-note" title={note} aria-live="polite" aria-atomic="true" data-testid="what-is-happening">{note}</p>}
      <p className="sd-sr" role="status" aria-live="polite">{announce}</p>
    </div>
  );
}
