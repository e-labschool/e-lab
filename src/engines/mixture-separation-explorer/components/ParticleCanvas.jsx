// Draws a particle view (model/particleView.js) on a canvas and steps it from its own animation loop, so the particles
// never cost a React render. `getCtl()` returns the control values for the current moment (from the run model).
import { useEffect, useRef } from "react";
import { WORLD, SPECIES, radiusOf } from "../model/particleView.js";

const PX_PER_UNIT = 1; // canvas is sized from the container; world units are scaled to fit
const sp = (id) => SPECIES[id] ?? { colour: "#888" };

function drawFrame(ctx, w, h, view, dark) {
  ctx.clearRect(0, 0, w, h);
  const s = Math.min(w / WORLD.w, h / WORLD.h) * PX_PER_UNIT;
  const ox = (w - WORLD.w * s) / 2; const oy = (h - WORLD.h * s) / 2;
  // vessel background
  ctx.fillStyle = dark ? "#10203f" : "#f4f8ff";
  ctx.fillRect(ox, oy, WORLD.w * s, WORLD.h * s);
  ctx.strokeStyle = "#8aa0c4"; ctx.lineWidth = 2; ctx.strokeRect(ox + 1, oy + 1, WORLD.w * s - 2, WORLD.h * s - 2);
  if (view.kind === "sieve") { ctx.strokeStyle = "#8d856f"; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ox, oy + 0.55 * s); ctx.lineTo(ox + WORLD.w * s, oy + 0.55 * s); ctx.stroke(); ctx.setLineDash([]); }
  if (view.kind === "vapour") { ctx.fillStyle = "rgba(121,185,238,0.18)"; ctx.fillRect(ox, oy + 0.52 * s, WORLD.w * s, 0.48 * s); }
  if (view.kind === "chroma") {
    ctx.fillStyle = "#f8f5ec"; ctx.fillRect(ox + 0.35 * s, oy + 0.03 * s, 0.7 * s, 0.95 * s); ctx.strokeStyle = "#b9b29c"; ctx.strokeRect(ox + 0.35 * s, oy + 0.03 * s, 0.7 * s, 0.95 * s);
    const fy = oy + (0.96 - (view.ctl?.front ?? 0) * 0.9) * s; ctx.strokeStyle = "#2a5fa8"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(ox + 0.35 * s, fy); ctx.lineTo(ox + 1.05 * s, fy); ctx.stroke(); ctx.setLineDash([]);
  }
  if (view.kind === "layers") { ctx.fillStyle = "rgba(121,185,238,0.14)"; ctx.fillRect(ox, oy + 0.5 * s, WORLD.w * s, 0.5 * s); }
  const ps = view.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; const r = radiusOf(p) * s;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const x = ox + p.x * s; const y = oy + p.y * s;
    const colour = sp(p.type).colour;
    ctx.beginPath(); ctx.arc(x, y, Math.max(1.6, r), 0, Math.PI * 2);
    ctx.fillStyle = colour; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = "rgba(12,20,40,0.55)"; ctx.stroke();
    if (p.type === "ionPlus" || p.type === "ionMinus") { ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(7, r * 1.5)}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.type === "ionPlus" ? "+" : "−", x, y + 0.5); }
  }
}

export default function ParticleCanvas({ view, getCtl, paused = false, reduced = false, label, testId = "particle-canvas" }) {
  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: 300, h: 214, dpr: 1 });
  const pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !view) return undefined;
    const ctx = canvas.getContext("2d"); if (!ctx) return undefined;
    const resize = () => {
      const box = canvas.parentElement.getBoundingClientRect();
      const w = Math.max(80, Math.floor(box.width)); const h = Math.max(60, Math.floor(w * (WORLD.h / WORLD.w)));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sizeRef.current = { w, h, dpr };
    };
    resize();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null; ro?.observe(canvas.parentElement);
    let raf = 0; let last = null; let acc = 0;
    const loop = (now) => {
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      acc += dt;
      const interval = reduced ? 0.5 : 0; // reduced motion: a calm snapshot every half second instead of a continuous animation
      if (!pausedRef.current && acc >= interval) { const c = getCtl?.() ?? {}; view.ctl = c; view.step(reduced ? 0.12 : Math.max(dt, acc), c); acc = 0; }
      else if (pausedRef.current) acc = 0;
      drawFrame(ctx, sizeRef.current.w, sizeRef.current.h, view, false);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [view, getCtl, reduced]);

  return <canvas ref={canvasRef} className="ms-pcanvas" role="img" aria-label={label} data-testid={testId} />;
}

export function Legend({ view }) {
  if (!view?.legend?.length) return null;
  return (
    <ul className="ms-legend" aria-label="Particle key">
      {view.legend.map((l) => <li key={l.id}><span className="ms-dot" style={{ background: l.colour }} aria-hidden="true" />{l.name}</li>)}
    </ul>
  );
}
