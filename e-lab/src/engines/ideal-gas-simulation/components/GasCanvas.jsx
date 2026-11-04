import { useEffect, useRef } from "react";
import { createRenderer } from "../render.js";

// The animated chamber. Owns ONLY the rAF loop + canvas sizing; all physics
// lives in the model (`sim`) and all drawing in render.js. The loop and the
// ResizeObserver are torn down on unmount.
export default function GasCanvas({ sim, reducedMotion, label }) {
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
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [sim, reducedMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas ref={canvasRef} role="img" aria-label={label} className="block" data-testid="gas-canvas" />
    </div>
  );
}
