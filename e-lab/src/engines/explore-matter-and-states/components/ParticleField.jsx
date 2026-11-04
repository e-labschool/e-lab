import { useEffect, useRef } from "react";

// A single reusable canvas particle simulation, parameterized by state
// (solid/liquid/gas) and a handful of teaching-scenario flags. Reused across
// every particle scene in this engine (solid/liquid/gas particle views,
// Compare, Compressibility, Temperature, Diffusion, Macro<->Micro) rather
// than writing a bespoke animation per scene. Physics here is illustrative,
// built for teaching clarity, not a literal molecular-dynamics engine.
//
// Internal simulation space is always a fixed 480x300 logical box; the
// canvas element scales responsively via CSS while the physics stays simple.

const W = 480;
const H = 300;
const COLORS = { solid: "var(--color-indigo)", liquid: "var(--color-teal)", gas: "var(--color-block-f)" };
const TRACK_COLOR = "var(--color-amber)";
const SHRINK_AMOUNT = { solid: 0.04, liquid: 0.08, gas: 0.55 };

function resolveCssColor(canvas, varExpr) {
  const probe = document.createElement("span");
  probe.style.color = varExpr;
  canvas.parentElement?.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved || "#888";
}

function initParticles(mode, count, twoSpecies, dyeCount) {
  const particles = [];
  if (mode === "solid") {
    const cols = Math.ceil(Math.sqrt(count * (W / H)));
    const rows = Math.ceil(count / cols);
    const marginX = 0.18, marginY = 0.18;
    let i = 0;
    for (let r = 0; r < rows && i < count; r += 1) {
      for (let c = 0; c < cols && i < count; c += 1) {
        const xFrac = marginX + (c / Math.max(cols - 1, 1)) * (1 - 2 * marginX);
        const yFrac = marginY + (r / Math.max(rows - 1, 1)) * (1 - 2 * marginY);
        particles.push({ xFrac, yFrac, phase: Math.random() * Math.PI * 2, phase2: Math.random() * Math.PI * 2, species: 0 });
        i += 1;
      }
    }
    return particles;
  }

  if (mode === "liquid") {
    const cols = Math.ceil(Math.sqrt(count * (W / H)));
    const rows = Math.ceil(count / cols);
    const marginX = 0.16, marginY = 0.16;
    let i = 0;
    for (let r = 0; r < rows && i < count; r += 1) {
      for (let c = 0; c < cols && i < count; c += 1) {
        const isDye = i < dyeCount;
        const xFrac = isDye ? 0.5 + (Math.random() - 0.5) * 0.06 : marginX + (c / Math.max(cols - 1, 1)) * (1 - 2 * marginX) + (Math.random() - 0.5) * 0.03;
        const yFrac = isDye ? 0.5 + (Math.random() - 0.5) * 0.06 : marginY + (r / Math.max(rows - 1, 1)) * (1 - 2 * marginY) + (Math.random() - 0.5) * 0.03;
        particles.push({ xFrac, yFrac, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, isDye, species: 0 });
        i += 1;
      }
    }
    return particles;
  }

  // gas
  for (let i = 0; i < count; i += 1) {
    const species = twoSpecies ? (i < count / 2 ? 0 : 1) : 0;
    const xFrac = twoSpecies ? (species === 0 ? Math.random() * 0.42 + 0.04 : Math.random() * 0.42 + 0.54) : Math.random() * 0.9 + 0.05;
    const angle = Math.random() * Math.PI * 2;
    particles.push({ xFrac, yFrac: Math.random() * 0.9 + 0.05, vx: Math.cos(angle) * 1.4, vy: Math.sin(angle) * 1.4, species });
  }
  return particles;
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
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ particles: [], t: 0, tracked: null, trail: [] });
  const propsRef = useRef({});
  propsRef.current = { paused, temperature, trackParticle, showTrail, highlightSpeedVariation, compressionFactor, twoSpecies, mixed, mode };

  const count = particleCount ?? (mode === "solid" ? 24 : mode === "liquid" ? 26 : 16);

  // Re-seed particles whenever the fundamental shape of the simulation changes.
  useEffect(() => {
    stateRef.current.particles = initParticles(mode, count, twoSpecies, dyeCount);
    stateRef.current.tracked = autoTrack ? 0 : null;
    stateRef.current.trail = [];
  }, [mode, count, twoSpecies, dyeCount, autoTrack]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const baseColor = resolveCssColor(canvas, COLORS[mode]);
    const speciesColor = resolveCssColor(canvas, "var(--color-amber)");
    const slowColor = resolveCssColor(canvas, "var(--color-indigo)");
    const medColor = resolveCssColor(canvas, "var(--color-teal)");
    const fastColor = resolveCssColor(canvas, "var(--color-amber)");
    const trackColor = resolveCssColor(canvas, TRACK_COLOR);
    const dyeColor = resolveCssColor(canvas, "var(--color-amber)");
    const boundsColor = resolveCssColor(canvas, "var(--color-line)");

    let raf;

    function frame() {
      const p = propsRef.current;
      const state = stateRef.current;
      const speedScale = 0.4 + (p.temperature / 100) * 1.6;

      const shrink = SHRINK_AMOUNT[p.mode] * p.compressionFactor;
      const boundsW = W * (1 - shrink);
      const offsetX = (W - boundsW) / 2;
      const boundsH = H * 0.92;
      const offsetY = H * 0.04;

      if (!p.paused) {
        state.t += 1;

        if (p.mode === "solid") {
          // pure vibration about a fixed lattice point — no translation.
        } else if (p.mode === "liquid") {
          for (const particle of state.particles) {
            let ax = (Math.random() - 0.5) * 0.06;
            let ay = (Math.random() - 0.5) * 0.06;
            // very mild cohesion toward centroid of nearby particles keeps the cluster tight.
            let nx = 0, ny = 0, n = 0;
            for (const other of state.particles) {
              if (other === particle) continue;
              const dx = other.xFrac - particle.xFrac;
              const dy = other.yFrac - particle.yFrac;
              const d2 = dx * dx + dy * dy;
              if (d2 < 0.02) { nx += dx; ny += dy; n += 1; }
            }
            if (n > 0) { ax += (nx / n) * 0.02; ay += (ny / n) * 0.02; }
            particle.vx = (particle.vx + ax) * 0.94;
            particle.vy = (particle.vy + ay) * 0.94;
            particle.xFrac += particle.vx * 0.0016 * speedScale;
            particle.yFrac += particle.vy * 0.0016 * speedScale;
            particle.xFrac = Math.min(0.96, Math.max(0.04, particle.xFrac));
            particle.yFrac = Math.min(0.96, Math.max(0.04, particle.yFrac));
          }
        } else {
          // gas
          for (const particle of state.particles) {
            particle.xFrac += particle.vx * 0.0011 * speedScale;
            particle.yFrac += particle.vy * 0.0011 * speedScale;
            const minX = p.twoSpecies && !p.mixed ? (particle.species === 0 ? 0.03 : 0.53) : 0.03;
            const maxX = p.twoSpecies && !p.mixed ? (particle.species === 0 ? 0.47 : 0.97) : 0.97;
            if (particle.xFrac < minX) { particle.xFrac = minX; particle.vx *= -1; }
            if (particle.xFrac > maxX) { particle.xFrac = maxX; particle.vx *= -1; }
            if (particle.yFrac < 0.03) { particle.yFrac = 0.03; particle.vy *= -1; }
            if (particle.yFrac > 0.97) { particle.yFrac = 0.97; particle.vy *= -1; }
          }
          // cheap pairwise elastic-ish collision
          for (let i = 0; i < state.particles.length; i += 1) {
            for (let j = i + 1; j < state.particles.length; j += 1) {
              const a = state.particles[i], b = state.particles[j];
              const dx = (b.xFrac - a.xFrac) * boundsW;
              const dy = (b.yFrac - a.yFrac) * boundsH;
              const dist = Math.hypot(dx, dy);
              if (dist < 14 && dist > 0) {
                const nxv = dx / dist, nyv = dy / dist;
                const rel = (a.vx - b.vx) * nxv + (a.vy - b.vy) * nyv;
                if (rel > 0) {
                  a.vx -= rel * nxv; a.vy -= rel * nyv;
                  b.vx += rel * nxv; b.vy += rel * nyv;
                }
              }
            }
          }
        }
      }

      // -- draw --
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = boundsColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(offsetX, offsetY, boundsW, boundsH);

      const speeds = p.mode === "gas" ? state.particles.map((pt) => Math.hypot(pt.vx, pt.vy)) : [];
      const sorted = [...speeds].sort((a, b) => a - b);
      const lowCut = sorted[Math.floor(sorted.length / 3)] ?? 0;
      const highCut = sorted[Math.floor((sorted.length * 2) / 3)] ?? 0;

      state.particles.forEach((particle, idx) => {
        let x, y;
        if (p.mode === "solid") {
          const homeX = offsetX + particle.xFrac * boundsW;
          const homeY = offsetY + particle.yFrac * boundsH;
          const amp = 2.2 * speedScale;
          x = homeX + Math.sin(state.t * 0.15 + particle.phase) * amp;
          y = homeY + Math.cos(state.t * 0.17 + particle.phase2) * amp;
        } else {
          x = offsetX + particle.xFrac * boundsW;
          y = offsetY + particle.yFrac * boundsH;
        }

        let fill = baseColor;
        if (particle.isDye) fill = dyeColor;
        else if (p.twoSpecies) fill = particle.species === 0 ? baseColor : speciesColor;
        else if (p.mode === "gas" && p.highlightSpeedVariation) {
          const speed = Math.hypot(particle.vx, particle.vy);
          fill = speed <= lowCut ? slowColor : speed >= highCut ? fastColor : medColor;
        }

        const isTracked = p.trackParticle && state.tracked === idx;
        if (isTracked && p.showTrail) {
          state.trail.push({ x, y });
          if (state.trail.length > 50) state.trail.shift();
          ctx.beginPath();
          state.trail.forEach((pt, i) => {
            ctx.globalAlpha = i / state.trail.length;
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          });
          ctx.strokeStyle = trackColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(x, y, particle.isDye ? 3.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (isTracked) {
          ctx.beginPath();
          ctx.arc(x, y, 7.5, 0, Math.PI * 2);
          ctx.strokeStyle = trackColor;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function handleClick(e) {
    if (!trackParticle) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * W;
    const clickY = ((e.clientY - rect.top) / rect.height) * H;
    const state = stateRef.current;
    let nearest = null, bestDist = Infinity;
    state.particles.forEach((particle, idx) => {
      const x = particle.xFrac * W, y = particle.yFrac * H;
      const d = Math.hypot(x - clickX, y - clickY);
      if (d < bestDist) { bestDist = d; nearest = idx; }
    });
    state.tracked = nearest;
    state.trail = [];
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`w-full rounded-md ${trackParticle ? "cursor-pointer" : ""} ${className}`}
      style={{ aspectRatio: `${W}/${H}`, height: "auto" }}
      role="img"
      aria-label={`${mode} particle simulation`}
    />
  );
}
