import { useEffect, useRef, useState } from "react";
import { PALETTE, STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";
import { createFrameClock } from "../../../lib/frameTime.js";
import { createParticleSet, layoutFor, newClock, advanceClock, particleSnapshot } from "../lib/particles.js";
import { useSize } from "../lib/useSize.js";

const COLORS = { solid: STATE_ACCENT.solid, liquid: STATE_ACCENT.liquid, gas: STATE_ACCENT.gas };

/** The particle container. A <canvas> sized by a ResizeObserver to whatever box the layout gives it; it draws
 * from `stateRef.current` (the curve state derived from the ONE progress value) every animation frame and
 * advances its own thermal-motion clocks with the clamped frame time (src/lib/frameTime.js).
 * The latest snapshot is also mirrored into data-* attributes for tests. */
export default function ParticleCanvas({ stateRef, reducedMotion = false }) {
  const [wrapRef, size] = useSize();
  const canvasRef = useRef(null);
  const [particleSet] = useState(() => createParticleSet());
  const sizeRef = useRef(size);
  useEffect(() => { sizeRef.current = size; }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext?.("2d");
    if (!ctx) return undefined;
    const frame = createFrameClock();
    const clock = newClock();
    let raf = 0;
    let layout = null;
    const draw = (now) => {
      const { width: w, height: h } = sizeRef.current;
      const st = stateRef.current;
      if (w > 4 && h > 4 && st) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const bw = Math.round(w * dpr);
        const bh = Math.round(h * dpr);
        if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; layout = null; }
        if (!layout || layout.w !== w || layout.h !== h) layout = layoutFor(w, h, particleSet);
        const dt = frame.tick(now);
        if (!reducedMotion) advanceClock(clock, dt, st.tempK);
        const snap = particleSnapshot(particleSet, layout, st, clock);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        // glass container
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#101726");
        g.addColorStop(1, "#0A0E17");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#3A4766";
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        for (let i = 0; i < snap.x.length; i += 1) {
          const c = COLORS[snap.phase[i]];
          ctx.beginPath();
          ctx.arc(snap.x[i], snap.y[i], snap.r, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(snap.x[i] - snap.r * 0.3, snap.y[i] - snap.r * 0.3, snap.r * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255,255,255,0.28)";
          ctx.fill();
        }
        const ds = canvas.dataset;
        ds.solid = String(snap.counts.solid);
        ds.liquid = String(snap.counts.liquid);
        ds.gas = String(snap.counts.gas);
        ds.radius = snap.r.toFixed(3);
        ds.amplitude = snap.amplitude.toFixed(3);
        ds.speed = snap.speed.toFixed(2);
        ds.progress = st.progress.toFixed(4);
        ds.w = String(w);
        ds.h = String(h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); frame.dispose(); };
  }, [stateRef, reducedMotion, particleSet]);

  return (
    <div ref={wrapRef} className="relative min-h-[260px] min-w-0 flex-1 overflow-hidden rounded-md" style={{ background: PALETTE.panel }} data-testid="hc-particle-wrap">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" style={{ width: "100%", height: "100%" }} data-testid="hc-particles" role="img" aria-label="Particles in a container: arrangement and motion follow the temperature curve" />
    </div>
  );
}
