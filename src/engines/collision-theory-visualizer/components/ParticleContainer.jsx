import { useEffect, useRef, useState } from "react";
import { MoleculeA, MoleculeB } from "./Molecule.jsx";
import { createParticleField, stepParticles, findCloseEncounter } from "../lib/collisionPhysics.js";

const BOUNDS = { x: 10, y: 10, w: 460, h: 150 };
const PARTICLE_COUNT_PER_KIND = 7;

/** The live, continuously-moving A/B container. Runs its own
 * requestAnimationFrame loop (paused cleanly on unmount or when `active`
 * is false) -- deliberately isolated from React state updates on every
 * frame beyond the array itself, so this never drives unrelated
 * re-renders. `onCloseEncounter`, if provided, is polled once per frame
 * without being stored in component state -- Collision mode uses it to
 * find a real event without adding extra re-render churn. */
export default function ParticleContainer({ temperature, active = true, onCloseEncounter, height = 170 }) {
  const [particles, setParticles] = useState(() => createParticleField(PARTICLE_COUNT_PER_KIND, BOUNDS, temperature));
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const temperatureRef = useRef(temperature);
  temperatureRef.current = temperature;

  // Re-seed the field (new sampled energies) when temperature changes --
  // reflects the new distribution rather than silently keeping stale speeds.
  useEffect(() => {
    setParticles(createParticleField(PARTICLE_COUNT_PER_KIND, BOUNDS, temperature));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <svg viewBox={`0 0 480 ${height}`} className="w-full" role="img" aria-label="Container of moving A and B molecules at the current temperature">
      <rect x={BOUNDS.x} y={BOUNDS.y} width={BOUNDS.w} height={BOUNDS.h} rx="8" fill="var(--color-paper)" stroke="var(--color-line)" strokeWidth="1.5" />
      {particles.map((p) =>
        p.kind === "A" ? (
          <MoleculeA key={p.id} x={p.x} y={p.y} rotation={p.rotation} label={false} />
        ) : (
          <MoleculeB key={p.id} x={p.x} y={p.y} rotation={p.rotation} label={false} />
        )
      )}
    </svg>
  );
}
