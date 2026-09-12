import { useState, useRef, useEffect, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { createIon, stepParticles, createWaterMolecule } from "./lib/physics.js";
import BeakerShape from "./components/BeakerShape.jsx";
import IonDot from "./components/IonDot.jsx";
import WaterMolecule from "./components/WaterMolecule.jsx";

const STAGE = { SEPARATE: "separate", POURING: "pouring", MIXING: "mixing", DONE: "done" };
const N_PER_SPECIES = 4; // equal H+/OH- so every pair can react; "several" ions per the brief without crowding a compact beaker

// A single shared viewBox coordinate space for the whole scene.
const VIEW_W = 900, VIEW_H = 460;
const LEFT_BEAKER = { x: 70, y: 130, w: 320, h: 260 };
const RIGHT_BEAKER = { x: 510, y: 130, w: 320, h: 260 };
const CENTRAL_BEAKER = { x: 210, y: 70, w: 480, h: 340 };

// Physics bounds are the visual beaker rect shrunk by a bottom margin —
// every ion's label renders BELOW the particle, so without this a
// particle bouncing at the very bottom wall would have its label poke
// out past the drawn glass edge. Checked numerically: the largest
// label offset (radius + 12px text gap) is ~21px, so a 24px margin
// keeps every label comfortably inside the beaker outline.
const LABEL_CLEARANCE = 24;
function physicsBounds(visualBounds) {
  return { ...visualBounds, h: visualBounds.h - LABEL_CLEARANCE };
}
const LEFT_PHYSICS = physicsBounds(LEFT_BEAKER);
const RIGHT_PHYSICS = physicsBounds(RIGHT_BEAKER);
const CENTRAL_PHYSICS = physicsBounds(CENTRAL_BEAKER);

function buildSeparateParticles() {
  let id = 0;
  const list = [];
  for (let i = 0; i < N_PER_SPECIES; i++) list.push(createIon("H", `h${id++}`, LEFT_PHYSICS));
  for (let i = 0; i < N_PER_SPECIES; i++) list.push(createIon("CL", `cl${id++}`, LEFT_PHYSICS));
  for (let i = 0; i < N_PER_SPECIES; i++) list.push(createIon("NA", `na${id++}`, RIGHT_PHYSICS));
  for (let i = 0; i < N_PER_SPECIES; i++) list.push(createIon("OH", `oh${id++}`, RIGHT_PHYSICS));
  return list;
}

export default function NeutralizationParticleVisualizer({ compact = false }) {
  const [stage, setStage] = useState(STAGE.SEPARATE);
  const [particles, setParticles] = useState(buildSeparateParticles);

  const stageRef = useRef(stage);
  const mixElapsedRef = useRef(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const pourTimeoutRef = useRef(null);

  useEffect(() => { stageRef.current = stage; }, [stage]);

  // The single animation loop for the component's whole lifetime — reads
  // the CURRENT stage via a ref (not a dependency) so it never tears
  // down and restarts every frame; only the physics BEHAVIOUR (which
  // bounds, whether reactions are active) changes with the stage.
  useEffect(() => {
    function tick(now) {
      const dt = lastTimeRef.current == null ? 0 : Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      const currentStage = stageRef.current;

      if (currentStage === STAGE.SEPARATE) {
        setParticles((prev) => {
          const leftIons = prev.filter((p) => p.type === "H" || p.type === "CL");
          const rightIons = prev.filter((p) => p.type === "NA" || p.type === "OH");
          return [...stepParticles(leftIons, LEFT_PHYSICS, dt, {}), ...stepParticles(rightIons, RIGHT_PHYSICS, dt, {})];
        });
      } else {
        const reactionsEnabled = currentStage === STAGE.MIXING;
        if (reactionsEnabled) mixElapsedRef.current += dt;
        setParticles((prev) => {
          const newWaters = [];
          const stepped = stepParticles(prev, CENTRAL_PHYSICS, dt, {
            reactionsEnabled,
            mixElapsed: mixElapsedRef.current,
            onWaterFormed: (x, y) => newWaters.push(createWaterMolecule(`w${Date.now()}-${Math.random().toFixed(4)}`, x, y)),
          });
          const all = [...stepped, ...newWaters];
          if (reactionsEnabled) {
            const stillReacting = all.some((p) => p.kind === "ion" && (p.type === "H" || p.type === "OH") && p.status !== "consumed");
            if (!stillReacting) queueMicrotask(() => setStage((s) => (s === STAGE.MIXING ? STAGE.DONE : s)));
          }
          return all;
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTimeRef.current = null; };
  }, []);

  const handleMix = useCallback(() => {
    if (stage !== STAGE.SEPARATE) return;
    // Remap every particle's position proportionally from its current
    // (left or right) beaker into the new central beaker's coordinate
    // space immediately — without this, any particle sitting in the
    // ~44% of the left beaker's width that falls outside the central
    // beaker's bounds would be instantly wall-clamped there on the next
    // physics tick, looking like a teleport rather than a pour. The
    // brief opacity fade already in place then carries the rest of the
    // "pouring" impression.
    setParticles((prev) =>
      prev.map((p) => {
        const from = p.type === "H" || p.type === "CL" ? LEFT_PHYSICS : RIGHT_PHYSICS;
        const fx = (p.x - from.x) / from.w;
        const fy = (p.y - from.y) / from.h;
        return { ...p, x: CENTRAL_PHYSICS.x + fx * CENTRAL_PHYSICS.w, y: CENTRAL_PHYSICS.y + fy * CENTRAL_PHYSICS.h };
      })
    );
    setStage(STAGE.POURING);
    pourTimeoutRef.current = setTimeout(() => {
      mixElapsedRef.current = 0;
      setStage(STAGE.MIXING);
    }, 700); // brief, visible "pouring" beat before reactions begin
  }, [stage]);

  const handleReplay = useCallback(() => {
    if (pourTimeoutRef.current) clearTimeout(pourTimeoutRef.current);
    mixElapsedRef.current = 0;
    setParticles(buildSeparateParticles());
    setStage(STAGE.SEPARATE);
  }, []);

  useEffect(() => () => { if (pourTimeoutRef.current) clearTimeout(pourTimeoutRef.current); }, []);

  const showTwoBeakers = stage === STAGE.SEPARATE || stage === STAGE.POURING;
  const showCentralBeaker = stage === STAGE.POURING || stage === STAGE.MIXING || stage === STAGE.DONE;

  return (
    <InteractiveFrame title="Neutralization Particle Visualizer" subtitle="What happens when HCl and NaOH solutions mix?" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 900 }}>
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full" style={{ height: "auto", maxHeight: 480 }} role="img" aria-label="Particle-level animation of HCl and NaOH solutions mixing and neutralizing">
          {showTwoBeakers && (
            <g style={{ opacity: stage === STAGE.POURING ? 0 : 1, transition: "opacity 0.5s ease" }}>
              <BeakerShape bounds={LEFT_BEAKER} label="HCl(aq)" />
              <BeakerShape bounds={RIGHT_BEAKER} label="NaOH(aq)" />
            </g>
          )}
          {showCentralBeaker && (
            <g style={{ opacity: stage === STAGE.POURING ? 0.4 : 1, transition: "opacity 0.5s ease" }}>
              <BeakerShape bounds={CENTRAL_BEAKER} label={stage === STAGE.DONE ? "Neutralized solution" : "Mixed solution"} />
            </g>
          )}

          {particles.map((p) =>
            p.kind === "water" ? (
              <WaterMolecule key={p.id} x={p.x} y={p.y} glowing={p.glowT > 0} />
            ) : (
              <IonDot key={p.id} x={p.x} y={p.y} type={p.type} fading={p.status === "reacting"} />
            )
          )}
        </svg>

        {stage === STAGE.DONE && (
          <p className="mx-auto mt-1 max-w-md text-center text-sm font-medium text-[var(--color-ink)]">
            {"H\u207A(aq) + OH\u207B(aq) \u2192 H\u2082O(l)"}
          </p>
        )}

        <div className="mt-3 flex justify-center gap-2">
          {stage === STAGE.SEPARATE && (
            <button type="button" onClick={handleMix} className="rounded-md bg-[var(--color-indigo)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              Mix
            </button>
          )}
          {stage !== STAGE.SEPARATE && (
            <button type="button" onClick={handleReplay} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
              Replay
            </button>
          )}
        </div>
      </div>
    </InteractiveFrame>
  );
}
