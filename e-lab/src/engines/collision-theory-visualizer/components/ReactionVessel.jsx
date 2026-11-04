import { useEffect, useRef, useState, useCallback } from "react";
import { Molecule } from "./Molecule.jsx";
import Beaker from "./Beaker.jsx";
import { createParticleField, stepParticles, findCloseEncounter, findNearestParticle } from "../lib/collisionPhysics.js";

// A compact glass beaker (the left 25-30% panel). Runs its own
// requestAnimationFrame loop (paused cleanly on unmount or when `active`
// is false), isolated from unrelated React re-renders. High-frequency
// particle positions live in this component's own state array, updated
// via the animation loop only -- never touched by parent re-renders for
// unrelated UI (tab switches, checkboxes, etc), which is what keeps the
// motion itself smooth regardless of what else is happening on screen.
const VIEW_W = 160, VIEW_H = 202;
const BOUNDS = { x: 6, y: 6, w: 148, h: 190 };
const PARTICLES_PER_KIND = 8; // 16 total, within the requested 12-18 range
const MAGNIFIER_LENS_RADIUS = 32;

export default function ReactionVessel({ temperature, active = true, onCloseEncounter, onInspect, magnifierOn = false, onMagnifierUpdate }) {
  const [particles, setParticles] = useState(() => createParticleField(PARTICLES_PER_KIND, BOUNDS, temperature));
  const [lensPos, setLensPos] = useState(null);
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

  // While the magnifier is on and the pointer is over the vessel, report
  // the nearby particles EVERY FRAME (via the animation loop above, not
  // a separate timer) so the magnified panel tracks smoothly -- this is
  // a direct live mirror of actual simulation state, not a scripted
  // replay, so there is nothing to "reset" as the lens moves.
  useEffect(() => {
    if (!magnifierOn || !lensPos || !onMagnifierUpdate) return;
    const nearby = particles.filter((p) => Math.hypot(p.x - lensPos.x, p.y - lensPos.y) < MAGNIFIER_LENS_RADIUS);
    onMagnifierUpdate({ particles: nearby, center: lensPos });
  }, [particles, magnifierOn, lensPos, onMagnifierUpdate]);

  function toViewCoords(e, svg) {
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (VIEW_W / rect.width),
      y: (e.clientY - rect.top) * (VIEW_H / rect.height),
    };
  }

  const handleMouseMove = useCallback(
    (e) => {
      if (!magnifierOn) return;
      setLensPos(toViewCoords(e, e.currentTarget));
    },
    [magnifierOn]
  );
  const handleMouseLeave = useCallback(() => {
    setLensPos(null);
    if (onMagnifierUpdate) onMagnifierUpdate({ particles: [], center: null });
  }, [onMagnifierUpdate]);

  function handleClick(e) {
    if (magnifierOn || !onInspect) return;
    const { x, y } = toViewCoords(e, e.currentTarget);
    const clicked = findNearestParticle(particles, x, y);
    if (!clicked) return;
    const opposite = particles.filter((p) => p.kind !== clicked.kind);
    const nearestOpposite = findNearestParticle(opposite, clicked.x, clicked.y, 999);
    if (nearestOpposite) onInspect({ a: clicked.kind === "A" ? clicked : nearestOpposite, b: clicked.kind === "B" ? clicked : nearestOpposite });
  }

  return (
    <div
      className={magnifierOn ? "cursor-none" : onInspect ? "cursor-pointer" : ""}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="img"
      aria-label="Small glass reaction vessel with moving A and B molecules at the current temperature."
    >
      <Beaker width={VIEW_W} height={VIEW_H}>
        {particles.map((p) => (
          <Molecule key={p.id} species={p.kind} x={p.x} y={p.y} rotation={p.rotation} size={0.7} label={false} />
        ))}
        {magnifierOn && lensPos && (
          <circle cx={lensPos.x} cy={lensPos.y} r={MAGNIFIER_LENS_RADIUS} fill="rgba(108,134,238,0.08)" stroke="var(--color-indigo)" strokeWidth="1.5" strokeDasharray="3 2" />
        )}
      </Beaker>
    </div>
  );
}
