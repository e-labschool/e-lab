import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Lock, Pause, Play } from "lucide-react";
import { VARS, displayAmount, formatScientific, formatValue, moleculeCount } from "../model.js";
import { createRenderer } from "../render.js";
import { VAR_CHIP } from "../theme.js";
import { AmountChip } from "./ControlPanel.jsx";

const CALLOUT = {
  pv: { text: "Move piston to change volume", icon: "move" },
  vt: { text: "Piston is free: volume responds to temperature", icon: "move" },
  pt: { text: "Piston is fixed: volume stays constant", icon: "lock" },
  vn: { text: "Piston is free: volume responds to the amount of gas", icon: "move" },
};

// Animated chamber. Owns ONLY the rAF loop + canvas sizing; the physics lives
// in `sim` (physics.js) and the drawing in render.js. Loop + ResizeObserver are
// torn down on unmount.
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

function LiveChip({ k, state, unit, dense }) {
  const v = VARS[k];
  return (
    <div className={"flex min-w-0 flex-col items-center justify-center rounded-lg px-1.5 text-center " + (dense ? "py-1" : "py-2")} style={{ background: VAR_CHIP[k] }} data-testid={`live-${k}`}>
      <dt className="text-[11.5px] leading-tight text-[#33415F]">{v.name === "Amount of gas" ? "Amount (n)" : `${v.name} (${k})`}</dt>
      <dd className={"font-bold tabular-nums text-[#14226B] " + (dense ? "text-[16px]" : "text-[19px]") + " leading-tight"}>
        {k === "n" ? (
          <AmountChip n={state.n} unit={unit} />
        ) : `${formatValue(k, state[k])} ${v.unit}`}
      </dd>
      {k === "n" && (
        <span className="text-[10px] leading-tight text-[#33415F]" data-testid="live-n-alt">
          {unit === "molecules" ? `(${displayAmount(state.n, "mol").text})` : (() => { const f = formatScientific(moleculeCount(state.n), 2); return <>({f.mantissa} × 10<sup>{f.exponent}</sup> molecules)</>; })()}
        </span>
      )}
    </div>
  );
}

export default function ChamberPanel({ sim, state, unit, accent, playing, onTogglePlay, display, onDisplay, reducedMotion, dense }) {
  const callout = CALLOUT[state.mode];
  const label = `Gas cylinder with ${Math.round(sim.particles.length)} particles at ${state.T.toFixed(0)} kelvin, ${state.V.toFixed(1)} litres, ${state.P.toFixed(2)} atmospheres, ${state.n.toFixed(2)} moles`;
  // Debounced plain-language summary for screen readers.
  const [announce, setAnnounce] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(`Pressure ${state.P.toFixed(2)} atmospheres, volume ${state.V.toFixed(1)} litres, temperature ${state.T.toFixed(0)} kelvin, amount ${state.n.toFixed(2)} moles.`);
    }, 700);
    return () => clearTimeout(t);
  }, [state.P, state.V, state.T, state.n]);
  const chk = "h-4 w-4 shrink-0 accent-[#2F7BF5]";
  return (
    <div className={"flex min-h-0 min-w-0 flex-col " + (dense ? "h-full gap-1.5" : "gap-2")}>
      <section
        aria-label="Gas chamber"
        className={"relative min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_25%,#FFFFFF_0%,#F1F7FF_65%,#E8F0FB_100%)] " + (dense ? "flex-1" : "h-[400px] sm:h-[430px]")}
      >
        <Chamber sim={sim} reducedMotion={reducedMotion} label={label} />
        <div className="pointer-events-none absolute left-2 top-2 flex max-w-[44%] items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold leading-tight sm:max-w-[170px]" style={{ background: accent.soft, borderColor: accent.border, color: accent.text }} data-testid="piston-callout">
          {callout.icon === "lock" ? <Lock size={14} className="shrink-0" aria-hidden="true" /> : <ArrowUpDown size={14} className="shrink-0" aria-hidden="true" />}
          {callout.text}
        </div>
        <p className="pointer-events-none absolute bottom-1 left-2 right-2 text-[9.5px] leading-tight text-[#6B7A99]">
          Particles are a visual sample of the gas (1 particle ≈ 0.05 mol), not every molecule.
        </p>
      </section>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <button type="button" onClick={onTogglePlay} aria-label={playing ? "Pause simulation" : "Play simulation"} data-testid="play-pause"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F7BF5] px-3 py-1 text-[12.5px] font-semibold text-white shadow-sm hover:bg-[#2468DB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]">
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {playing ? "Pause" : "Play"}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[#14226B]">
          <input type="checkbox" className={chk} checked={display.trails} onChange={(e) => onDisplay({ trails: e.target.checked })} data-testid="toggle-trails" />
          Particle trails
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-[#14226B]">
          <input type="checkbox" className={chk} checked={display.collisions} onChange={(e) => onDisplay({ collisions: e.target.checked })} data-testid="toggle-collisions" />
          Collision flashes
        </label>
      </div>
      <section aria-label="Live values" className={"@container shrink-0 rounded-2xl border border-[#E3EAF6] bg-white/90 shadow-[0_2px_10px_rgba(60,90,150,0.07)] " + (dense ? "px-2.5 py-1.5" : "p-3")}>
        <h3 className={"font-bold text-[#14226B] " + (dense ? "text-[13px]" : "text-[15px]")}>Live values</h3>
        <dl className={"grid grid-cols-2 gap-1.5 @min-[430px]:grid-cols-4 " + (dense ? "mt-0.5" : "mt-1.5")}>
          {["P", "V", "T", "n"].map((k) => <LiveChip key={k} k={k} state={state} unit={unit} dense={dense} />)}
        </dl>
        <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      </section>
    </div>
  );
}
