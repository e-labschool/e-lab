import { useState, useRef, useEffect } from "react";
import { SPEED_OF_LIGHT } from "./waveMath.js";

// The real frequency for visible-light wavelengths spans only a ~1.75x
// range (400-700nm), but real values (~10^14 Hz) are far too fast to
// animate literally. VISUAL_BASE_HZ sets a comfortable on-screen speed
// at a reference wavelength, and every other wavelength's visual speed
// scales PROPORTIONALLY to its real frequency relative to that
// reference -- verified to stay within a 1.45s-2.55s cycle period
// across the full 400-700nm range, comfortable throughout, while still
// preserving the correct qualitative relationship (shorter wavelength
// -> visibly faster pulsing).
const REFERENCE_NM = 550;
const VISUAL_BASE_HZ = 0.5;
const REFERENCE_FREQUENCY = SPEED_OF_LIGHT / (REFERENCE_NM / 1e9);

function visualCyclesPerSecond(wavelengthNm) {
  const realFrequency = SPEED_OF_LIGHT / (wavelengthNm / 1e9);
  return VISUAL_BASE_HZ * (realFrequency / REFERENCE_FREQUENCY);
}

/** Drives the wave's animation phase via requestAnimationFrame (needed
 * for precise cycle-crossing detection at the observation point -- a
 * plain CSS animation loop can't easily report "a full cycle just
 * passed"). Returns the current phase (radians, unbounded/increasing)
 * and a `cycleCount` that increments exactly once per full cycle
 * completed at the observation point, for triggering a pulse. Paused
 * under reduced motion (a fixed frame is shown; the calling component
 * is responsible for rendering that frame meaningfully rather than
 * simply freezing mid-animation). */
export function useWavePhase({ wavelengthNm, paused }) {
  const [phase, setPhase] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const phaseAccumRef = useRef(0);
  const lastCycleRef = useRef(0);

  useEffect(() => {
    if (paused) {
      lastTimeRef.current = null;
      return undefined;
    }
    function tick(time) {
      if (lastTimeRef.current !== null) {
        const dtSeconds = (time - lastTimeRef.current) / 1000;
        const cyclesPerSecond = visualCyclesPerSecond(wavelengthNm);
        phaseAccumRef.current += dtSeconds * cyclesPerSecond * 2 * Math.PI;
        setPhase(phaseAccumRef.current);
        const wholecycles = Math.floor(phaseAccumRef.current / (2 * Math.PI));
        if (wholecycles > lastCycleRef.current) {
          lastCycleRef.current = wholecycles;
          setCycleCount((c) => c + 1);
        }
      }
      lastTimeRef.current = time;
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [wavelengthNm, paused]);

  return { phase, cycleCount };
}
