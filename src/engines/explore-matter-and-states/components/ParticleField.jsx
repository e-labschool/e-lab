import { useEffect, useRef } from "react";
import { createParticleSystem } from "../../../lib/particles/particleCore.js";
import { useReducedMotion } from "../useReducedMotion.js";

// ONE shared particle core (src/lib/particles/particleCore.js, also used by the Particle Model Visualizer) drawn on a flat 2D canvas.
// What the picture now guarantees (GS-26..GS-30):
//  - solids and liquids are CLOSE-PACKED (touching hard spheres, solid = regular lattice, liquid = touching but irregular, pooled
//    on the floor); gas particles are far apart and collide with each other and with the walls
//  - the SAME number of particles is drawn whatever the temperature; temperature sets mean kinetic energy (speed ~ sqrt T) in
//    every state, so a hotter solid vibrates harder, it does not move
//  - the canvas is sized by its container (ResizeObserver) and drawn at the device pixel ratio, so it is crisp on every screen
//  - prefers-reduced-motion: the picture advances in discrete snapshots instead of continuously
// Model units are not nm: particle diameter = 1 in a 16 x 10 box. The picture is illustrative.

const BOX = { w: 16, h: 10, d: 1 };
const ASPECT = BOX.w / BOX.h;
const TIME_SCALE = 1.8;
const N_DEFAULT = 24; // the SAME number of particles in every state
const SHRINK_AMOUNT = { solid: 0.04, liquid: 0.08, gas: 0.5 };
const T_OF = (temperature) => 100 + 4 * Math.min(100, Math.max(0, temperature)); // slider 0-100 -> 100-500 K (50 -> 300 K)

function cssColor(canvas, varExpr, fallback) {
  const probe = document.createElement("span");
  probe.style.color = varExpr;
  canvas.parentElement?.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c || fallback;
}

const NAME = { solid: "solid", liquid: "liquid", gas: "gas" };
function describe(mode, n, temperature, twoSpecies, mixed, compressionFactor) {
  const arrangement = mode === "solid" ? "closely packed in a regular pattern, vibrating about fixed positions"
    : mode === "liquid" ? "closely packed but irregular, sliding past one another"
      : "far apart, moving freely and colliding with each other and the walls";
  const extra = twoSpecies ? ` Two kinds of particle, ${mixed ? "mixed" : "separated by a divider"}.` : "";
  const press = compressionFactor > 0 ? ` Compressed to ${Math.round((1 - SHRINK_AMOUNT[mode] * compressionFactor) * 100)} percent of the width.` : "";
  return `Particle picture of a ${NAME[mode]}: ${n} particles ${arrangement}. Temperature setting ${Math.round(temperature)} out of 100.${extra}${press}`;
}

export default function ParticleField({
  mode,
  paused = false,
  temperature = 50,
  particleCount,
  trackParticle = false,
  showTrail = false,
  autoTrack = false,
  highlightSpeedVariation = false,
  compressionFactor = 0,
  twoSpecies = false,
  mixed = true,
  dyeCount = 0,
  className = "",
  label,
}) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef(null);
  const ref = useRef({ sys: null, tracked: null, trail: [], width: BOX.w, species: [], dye: new Set(), snap: 0 });
  const propsRef = useRef({});
  propsRef.current = { paused, temperature, trackParticle, showTrail, highlightSpeedVariation, compressionFactor, twoSpecies, mixed, mode, reducedMotion };

  const count = particleCount ?? N_DEFAULT;

  // (Re)build the system whenever the arrangement itself changes. Same N in every state of a scene.
  useEffect(() => {
    const sys = createParticleSystem({ n: count, dim: 2, seed: 11 + count, box: { ...BOX }, state: mode, T: T_OF(temperature) });
    const r = ref.current;
    r.sys = sys; r.width = BOX.w; r.trail = []; r.snap = 0;
    r.species = sys.particles.map((p) => (twoSpecies ? (p.id < count / 2 ? 0 : 1) : 0));
    if (twoSpecies) { // species 0 starts in the left half, species 1 in the right half (gas)
      sys.particles.forEach((p, i) => { const left = r.species[i] === 0; p.x = left ? 0.5 + ((p.x / BOX.w) * (BOX.w / 2 - 1)) : BOX.w / 2 + 0.5 + ((p.x / BOX.w) * (BOX.w / 2 - 1)); });
      for (let k = 0; k < 20; k++) sys.step(0.02);
    }
    // dye: the particles nearest the middle of the liquid
    r.dye = new Set();
    if (dyeCount > 0) {
      const cx = BOX.w / 2; const cy = 3;
      [...sys.particles].sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)).slice(0, dyeCount).forEach((p) => r.dye.add(p.id));
    }
    r.tracked = autoTrack ? sys.particles[Math.floor(sys.particles.length / 2)].id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, count, twoSpecies, dyeCount, autoTrack]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let raf; let last = performance.now(); let frameNo = 0; let cssW = 0; let cssH = 0; let dpr = 1;
    let colors = {};
    const resolveColors = () => {
      colors = {
        solid: cssColor(canvas, "var(--color-indigo)", "#4a55c9"), liquid: cssColor(canvas, "var(--color-teal)", "#1c8f87"), gas: cssColor(canvas, "var(--color-block-f)", "#b75a2e"),
        amber: cssColor(canvas, "var(--color-amber)", "#b8760b"), line: cssColor(canvas, "var(--color-line)", "#999"), ink: cssColor(canvas, "var(--color-ink)", "#222"),
      };
    };
    resolveColors();
    const fit = () => {
      const w = Math.max(40, Math.round(canvas.clientWidth || canvas.parentElement?.clientWidth || 320));
      cssW = w; cssH = Math.round(w / ASPECT); dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
      canvas.style.height = `${cssH}px`;
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
    ro?.observe(canvas);

    function advance(dt) {
      const R = ref.current; const p = propsRef.current; const sys = R.sys;
      if (!sys) return;
      sys.setTemperature(T_OF(p.temperature));
      // compression: the right wall moves in (gas mainly), smoothly
      const target = BOX.w * (1 - SHRINK_AMOUNT[p.mode] * p.compressionFactor);
      R.width += (target - R.width) * Math.min(1, dt * 4);
      if (Math.abs(target - R.width) < 1e-3) R.width = target;
      sys.box.w = R.width;
      sys.step(dt * TIME_SCALE);
      if (p.twoSpecies && !p.mixed) { // divider in the middle keeps the two kinds apart
        const mid = R.width / 2;
        sys.particles.forEach((q, i) => {
          if (R.species[i] === 0 && q.x > mid - 0.5) { q.x = mid - 0.5; if (q.vx > 0) q.vx = -q.vx; }
          if (R.species[i] === 1 && q.x < mid + 0.5) { q.x = mid + 0.5; if (q.vx < 0) q.vx = -q.vx; }
        });
      }
    }

    function draw() {
      const R = ref.current; const p = propsRef.current; const sys = R.sys;
      if (!sys) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const s = cssW / BOX.w; // px per model unit
      const offX = ((BOX.w - R.width) / 2) * s;
      const toX = (x) => offX + x * s; const toY = (y) => cssH - y * s;
      // container
      ctx.strokeStyle = colors.line; ctx.lineWidth = 1.5;
      ctx.strokeRect(toX(0) + 0.75, 0.75, R.width * s - 1.5, cssH - 1.5);
      if (p.twoSpecies && !p.mixed) { ctx.beginPath(); ctx.setLineDash([5, 4]); ctx.moveTo(toX(R.width / 2), 2); ctx.lineTo(toX(R.width / 2), cssH - 2); ctx.stroke(); ctx.setLineDash([]); }
      const ps = sys.particles;
      let lowCut = 0; let highCut = 0;
      if (p.highlightSpeedVariation && p.mode === "gas") {
        const sp = ps.map((q) => Math.hypot(q.vx, q.vy)).sort((a, b) => a - b);
        lowCut = sp[Math.floor(sp.length / 3)]; highCut = sp[Math.floor((sp.length * 2) / 3)];
      }
      const rad = 0.5 * s;
      for (let i = 0; i < ps.length; i++) {
        const q = ps[i]; const x = toX(q.x); const y = toY(q.y);
        let fill = colors[p.mode];
        if (R.dye.has(q.id)) fill = colors.amber;
        else if (p.twoSpecies) fill = R.species[i] === 0 ? colors[p.mode] : colors.amber;
        else if (p.highlightSpeedVariation && p.mode === "gas") { const v = Math.hypot(q.vx, q.vy); fill = v <= lowCut ? colors.solid : v >= highCut ? colors.amber : colors.liquid; }
        if (p.trackParticle && R.tracked === q.id && p.showTrail) {
          R.trail.push({ x, y }); if (R.trail.length > 60) R.trail.shift();
          ctx.beginPath(); ctx.strokeStyle = colors.amber; ctx.lineWidth = 2;
          R.trail.forEach((pt, k) => { ctx.globalAlpha = (k + 1) / R.trail.length; if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
          ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(x, y, Math.max(2, rad - 0.4), 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.stroke();
        if (p.trackParticle && R.tracked === q.id) { ctx.beginPath(); ctx.arc(x, y, rad + 3, 0, Math.PI * 2); ctx.strokeStyle = colors.ink; ctx.lineWidth = 2; ctx.stroke(); }
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; frameNo += 1;
      const p = propsRef.current; const R = ref.current;
      if (frameNo % 45 === 0) resolveColors(); // follow light/dark theme changes
      if (!p.paused) {
        if (p.reducedMotion) { R.snap += dt; if (R.snap >= 0.6) { R.snap = 0; for (let k = 0; k < 6; k++) advance(0.1); } }
        else advance(dt);
      }
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, []);

  function handleClick(e) {
    if (!trackParticle || !ref.current.sys) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const R = ref.current; const s = rect.width / BOX.w;
    const offX = ((BOX.w - R.width) / 2) * s;
    const cx = e.clientX - rect.left; const cy = e.clientY - rect.top;
    let best = null; let bd = Infinity;
    for (const q of R.sys.particles) { const d = Math.hypot(offX + q.x * s - cx, rect.height - q.y * s - cy); if (d < bd) { bd = d; best = q.id; } }
    R.tracked = best; R.trail = [];
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`block w-full rounded-md ${trackParticle ? "cursor-pointer" : ""} ${className}`}
      style={{ aspectRatio: `${BOX.w}/${BOX.h}`, height: "auto" }}
      role="img"
      aria-label={label ?? describe(mode, count, temperature, twoSpecies, mixed, compressionFactor)}
      data-testid="particle-field"
      data-mode={mode}
      data-count={count}
    />
  );
}
