import { useEffect, useState } from "react";
import Particle from "./Particle.jsx";

// A brief travelling-particle animation, absolutely positioned within
// the simulation's own container (percentage coordinates, so it works
// regardless of actual rendered size). Approximates "from the Build
// panel toward the atom" without needing exact DOM measurement/refs --
// left-edge start points for adding, and the reverse direction for
// removing, landing on/leaving from roughly where the nucleus or
// electron ring actually is.
const START_BY_TYPE = { proton: { x: 6, y: 30 }, neutron: { x: 6, y: 50 }, electron: { x: 6, y: 70 } };
const TARGET_BY_TYPE = { proton: { x: 50, y: 46 }, neutron: { x: 50, y: 46 }, electron: { x: 50, y: 20 } };
const DURATION_MS = 550;

export default function FlyingParticle({ flight, onComplete }) {
  const [arrived, setArrived] = useState(false);

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

  const start = START_BY_TYPE[flight.type];
  const target = TARGET_BY_TYPE[flight.type];
  const from = flight.direction === "add" ? start : target;
  const to = flight.direction === "add" ? target : start;
  const pos = arrived ? to : from;

  return (
    <div
      style={{
        position: "absolute",
        left: `${pos.x}%`,
        top: `${pos.y}%`,
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
