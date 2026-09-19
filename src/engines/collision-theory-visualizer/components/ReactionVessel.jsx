import { useEffect, useRef, useState } from "react";
import { Molecule } from "./Molecule.jsx";
import { createParticleField, stepParticles, findCloseEncounter, findNearestParticle } from "../lib/collisionPhysics.js";

// A COMPACT vessel (the left 25-30% panel) -- smaller and with more
// noticeably active motion than a large container would need. Runs its
// own requestAnimationFrame loop (paused cleanly on unmount or when
// `active` is false), isolated from unrelated React re-renders.
const BOUNDS = { x: 6, y: 6, w: 148, h: 190 };
const PARTICLES_PER_KIND = 8; // 16 total, within the requested 12-18 range

export default function ReactionVessel({ temperature, active = true, onCloseEncounter, onInspect }) {
  const [particles, setParticles] = useState(() => createParticleField(PARTICLES_PER_KIND, BOUNDS, temperature));
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    setParticles(createParticleField(PARTICLES_PER_KIND, BOUNDS, temperature));
  }, [temperature]);

  useEffect(() => {
    if (!active) return undefined;
    function tick(now) {
      const dt = lastTimeRef.current == null ? 0 : Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      setParticles((prev) => {
        const stepped = stepParticles(prev, BOUNDS, dt);
        if (onCloseEncounter) {
          const found = findCloseEncounter(stepped);
          if (found) onCloseEncounter(found);
        }
        return stepped;
      });
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function handleClick(e) {
    if (!onInspect) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = 160 / rect.width;
    const scaleY = 202 / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const clicked = findNearestParticle(particles, x, y);
    if (!clicked) return;
    const opposite = particles.filter((p) => p.kind !== clicked.kind);
    const nearestOpposite = findNearestParticle(opposite, clicked.x, clicked.y, 999);
    if (nearestOpposite) onInspect({ a: clicked.kind === "A" ? clicked : nearestOpposite, b: clicked.kind === "B" ? clicked : nearestOpposite });
  }

  return (
    <svg
      viewBox="0 0 160 202"
      className={`w-full ${onInspect ? "cursor-pointer" : ""}`}
      onClick={handleClick}
      role="img"
      aria-label="Small reaction vessel with moving A and B molecules at the current temperature. Click a molecule to inspect it in the magnified view."
    >
      <rect x={BOUNDS.x} y={BOUNDS.y} width={BOUNDS.w} height={BOUNDS.h} rx="8" fill="var(--color-paper)" stroke="var(--color-line)" strokeWidth="1.5" />
      {particles.map((p) => (
        <Molecule key={p.id} species={p.kind} x={p.x} y={p.y} rotation={p.rotation} size={0.75} label={false} />
      ))}
    </svg>
  );
}
