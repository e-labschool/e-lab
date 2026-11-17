import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Particle from "./Particle.jsx";
import { flightEndpoints } from "../lib/flightPath.js";

// A brief travelling-particle animation inside the atom stage.  BA-12: it now starts at the real +/- control row of its
// particle type and ends at the nucleus (protons, neutrons) or the outer electron ring (electrons), measured from the DOM;
// the fixed percentages below are only the fallback when those elements cannot be found.
const START_BY_TYPE = { proton: { x: 6, y: 30 }, neutron: { x: 6, y: 50 }, electron: { x: 6, y: 70 } };
const TARGET_BY_TYPE = { proton: { x: 50, y: 46 }, neutron: { x: 50, y: 46 }, electron: { x: 50, y: 20 } };
const DURATION_MS = 550;
const rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };

export default function FlyingParticle({ flight, onComplete }) {
  const [arrived, setArrived] = useState(false);
  const [geom, setGeom] = useState(null); // { start, target } in px, or null -> percentage fallback
  const ref = useRef(null);

  useLayoutEffect(() => {
    const stageEl = ref.current?.parentElement;
    if (!stageEl) return;
    const rings = stageEl.querySelectorAll('[data-testid="atom-svg"] circle[stroke-dasharray]');
    setGeom(flightEndpoints(flight.type, {
      stage: rectOf(stageEl),
      row: rectOf(document.querySelector(`[data-testid="atom-row-${flight.type}"]`)),
      nucleus: null, // the nucleus is drawn at the centre of the stage's svg
      ring: rings.length ? rectOf(rings[rings.length - 1]) : null,
    }));
  }, [flight.id, flight.type]);

  useEffect(() => {
    setArrived(false);
    const raf = requestAnimationFrame(() => setArrived(true));
    const timeout = setTimeout(onComplete, DURATION_MS + 30);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id]);

  const start = geom?.start ?? START_BY_TYPE[flight.type];
  const target = geom?.target ?? TARGET_BY_TYPE[flight.type];
  const unit = geom ? "px" : "%";
  const from = flight.direction === "add" ? start : target;
  const to = flight.direction === "add" ? target : start;
  const pos = arrived ? to : from;

  return (
    <div
      ref={ref}
      data-testid="atom-flight"
      data-geometry={geom ? "measured" : "fallback"}
      style={{
        position: "absolute",
        left: `${pos.x}${unit}`,
        top: `${pos.y}${unit}`,
        transform: "translate(-50%, -50%)",
        transition: `left ${DURATION_MS}ms ease-in-out, top ${DURATION_MS}ms ease-in-out, opacity ${DURATION_MS}ms ease-in-out`,
        opacity: arrived && flight.direction === "remove" ? 0 : 1,
        zIndex: 40,
        pointerEvents: "none",
      }}
    >
      <Particle type={flight.type} size={24} />
    </div>
  );
}
