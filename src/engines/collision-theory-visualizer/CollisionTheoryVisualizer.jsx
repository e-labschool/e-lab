import { useState, useCallback } from "react";
import { Search } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ReactionVessel from "./components/ReactionVessel.jsx";
import MagnifiedView from "./components/MagnifiedView.jsx";
import MagnifierLiveView from "./components/MagnifierLiveView.jsx";
import MaxwellBoltzmannGraph from "./components/MaxwellBoltzmannGraph.jsx";
import { Molecule } from "./components/Molecule.jsx";
import { DEFAULT_TEMPERATURE, DEFAULT_EA, TEMPERATURE_OPTIONS, DEFAULT_TEMPERATURES } from "./lib/maxwellBoltzmann.js";

const MODES = [
  { id: "collision", label: "Collision" },
  { id: "activation", label: "Activation Energy" },
  { id: "orientation", label: "Orientation" },
  { id: "maxwell", label: "Maxwell\u2013Boltzmann" },
];

// Illustrative collision energies for the two Activation Energy demo
// cases, on the SAME 0-100 scale as the Ea slider -- "sufficient" is
// derived LIVE by comparing against the current `ea` state.
const CASE_A_COLLISION_ENERGY = 25;
const CASE_B_COLLISION_ENERGY = 65;

/** Converts a captured {a, b} pair of raw vessel particles (as returned
 * by findCloseEncounter/findNearestParticle -- full physics state:
 * id/kind/x/y/vx/vy/rotation/spinRate) into the {aPos,bPos,aVel,bVel,
 * aRot,bRot,aSpin,bSpin} shape buildEventGeometry() expects. This is
 * the ONLY place real vessel state is translated for the magnified
 * view -- everything downstream (approach extrapolation, contact,
 * deflection) is derived from these real captured values. */
function toEncounterShape(found) {
  return {
    aPos: { x: found.a.x, y: found.a.y },
    bPos: { x: found.b.x, y: found.b.y },
    aVel: { x: found.a.vx, y: found.a.vy },
    bVel: { x: found.b.vx, y: found.b.vy },
    aRot: found.a.rotation,
    bRot: found.b.rotation,
    aSpin: found.a.spinRate,
    bSpin: found.b.spinRate,
  };
}

export default function CollisionTheoryVisualizer({ compact = false }) {
  const [modeId, setModeId] = useState("collision");
  const [temperature] = useState(DEFAULT_TEMPERATURE);
  const [ea, setEa] = useState(DEFAULT_EA);
  const [speed, setSpeed] = useState(0.5);

  // Magnifier tool -- shared across the first three tabs. When on, the
  // vessel reports whichever real particles are currently under the
  // lens, every frame; the magnified panel becomes a direct live mirror
  // of that data (see MagnifierLiveView.jsx) rather than a scripted
  // replay, so moving the lens never causes a reset/flash.
  const [magnifierOn, setMagnifierOn] = useState(false);
  const [magnifierData, setMagnifierData] = useState({ particles: [], center: null });
  const handleMagnifierUpdate = useCallback((data) => setMagnifierData(data), []);
  function handleToggleMagnifier() {
    setMagnifierOn((v) => {
      const next = !v;
      // Turning the magnifier off (or back on) should never leave a
      // stale "viewing a replay from magnifier mode" state behind --
      // otherwise re-enabling it later could incorrectly force-show an
      // old captured replay instead of the live mirror.
      if (!next) {
        setViewingReplay(false);
        setPendingEncounter(null);
        setEncounter(null);
      }
      return next;
    });
  }

  // Collision tab -- real captured/inspected encounters from the vessel,
  // converted from the vessel's raw particle state into the shape
  // buildEventGeometry() expects.
  //
  // Outside magnifier mode: auto-captures and immediately shows the
  // replay, as before.
  // Inside magnifier mode: a detected encounter is held as a PENDING
  // prompt ("Collision detected") rather than auto-switching away from
  // the live magnifier view -- the student explicitly chooses
  // [View Collision], then [Return to Live View] to go back, per the
  // LIVE BEAKER -> MAGNIFY -> CAPTURE -> REPLAY -> RETURN workflow.
  const [encounter, setEncounter] = useState(null);
  const [encounterSeq, setEncounterSeq] = useState(0);
  const [pendingEncounter, setPendingEncounter] = useState(null);
  const [viewingReplay, setViewingReplay] = useState(false);
  const handleCloseEncounter = useCallback(
    (found) => {
      if (magnifierOn) {
        setPendingEncounter((prev) => prev ?? toEncounterShape(found));
        return;
      }
      setEncounter((prev) => {
        if (prev) return prev;
        setEncounterSeq((n) => n + 1);
        return toEncounterShape(found);
      });
    },
    [magnifierOn]
  );
  const handleInspect = useCallback((found) => {
    setEncounter(toEncounterShape(found));
    setEncounterSeq((n) => n + 1);
  }, []);
  function handleViewPendingCollision() {
    if (!pendingEncounter) return;
    setEncounter(pendingEncounter);
    setEncounterSeq((n) => n + 1);
    setViewingReplay(true);
  }
  function handleReturnToLiveView() {
    setViewingReplay(false);
    setPendingEncounter(null);
    setEncounter(null);
  }

  // Activation Energy tab -- two curated cases.
  const [eaCase, setEaCase] = useState("insufficient");
  const [eaReplayKey, setEaReplayKey] = useState(0);

  // Orientation tab -- two curated cases, both with sufficient energy.
  const [orientationCase, setOrientationCase] = useState("incorrect");
  const [orientationReplayKey, setOrientationReplayKey] = useState(0);

  // Maxwell-Boltzmann tab.
  const [temperatures, setTemperatures] = useState(DEFAULT_TEMPERATURES);
  const [visibleCurves, setVisibleCurves] = useState({ T1: true, T2: true, T3: true });
  const [mbEa, setMbEa] = useState(DEFAULT_EA);
  const [particleView, setParticleView] = useState("T1");

  return (
    <InteractiveFrame title="Collision Theory Visualizer" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1060 }}>
        <div className="flex flex-wrap justify-center gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeId(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                modeId === m.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {modeId !== "maxwell" && (
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={handleToggleMagnifier}
              aria-pressed={magnifierOn}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                magnifierOn ? "bg-[var(--color-teal)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
              }`}
            >
              <Search size={13} /> {magnifierOn ? "Magnifier On" : "Use Magnifier"}
            </button>
          </div>
        )}

        {modeId === "collision" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} onCloseEncounter={handleCloseEncounter} onInspect={handleInspect} magnifierOn={magnifierOn} onMagnifierUpdate={handleMagnifierUpdate} />}
            magnifierOn={magnifierOn}
            magnifierData={magnifierData}
            forceMain={viewingReplay}
            main={
              encounter ? (
                <div>
                  <MagnifiedView mode="collision" encounter={encounter} encounterId={encounterSeq} calloutLine="Particles must collide for a reaction to occur." speed={speed} onSpeedChange={setSpeed} replayKey={encounterSeq} />
                  {magnifierOn && (
                    <div className="mt-2 text-center">
                      <button type="button" onClick={handleReturnToLiveView} className="text-xs font-medium text-[var(--color-indigo)] hover:underline">
                        {"\u2190"} Return to Live View
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyMagnifiedView text="Watching the vessel for an A\u2013B encounter\u2026" />
              )
            }
            belowMain={
              magnifierOn && pendingEncounter && !viewingReplay ? (
                <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-teal)]/40 bg-[var(--color-teal-soft)] px-3 py-2 text-xs">
                  <span className="font-medium text-[var(--color-teal)]">Collision detected in the magnified region</span>
                  <button type="button" onClick={handleViewPendingCollision} className="rounded-md bg-[var(--color-teal)] px-2.5 py-1 font-semibold text-white">
                    View Collision
                  </button>
                </div>
              ) : null
            }
          />
        )}

        {modeId === "activation" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} magnifierOn={magnifierOn} onMagnifierUpdate={handleMagnifierUpdate} />}
            magnifierOn={magnifierOn}
            magnifierData={magnifierData}
            main={
              <ActivationEnergyPanel
                ea={ea}
                setEa={setEa}
                eaCase={eaCase}
                setEaCase={setEaCase}
                replayKey={eaReplayKey}
                bumpReplay={() => setEaReplayKey((k) => k + 1)}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            }
          />
        )}

        {modeId === "orientation" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} magnifierOn={magnifierOn} onMagnifierUpdate={handleMagnifierUpdate} />}
            magnifierOn={magnifierOn}
            magnifierData={magnifierData}
            main={
              <OrientationPanel
                orientationCase={orientationCase}
                setOrientationCase={setOrientationCase}
                replayKey={orientationReplayKey}
                bumpReplay={() => setOrientationReplayKey((k) => k + 1)}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            }
          />
        )}

        {modeId === "maxwell" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperatures[particleView]} active={true} />}
            main={<MaxwellBoltzmannGraph temperatures={temperatures} visible={visibleCurves} ea={mbEa} />}
            belowVessel={
              <div className="mt-2">
                <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Particle motion</p>
                <div className="flex justify-center gap-1">
                  {["T1", "T2", "T3"].map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setParticleView(key)}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${particleView === key ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            }
            belowMain={
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                {["T1", "T2", "T3"].map((key) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={visibleCurves[key]}
                        onChange={(e) => setVisibleCurves((prev) => ({ ...prev, [key]: e.target.checked }))}
                        aria-label={`Show ${key} curve`}
                      />
                      {key}
                    </label>
                    <select
                      value={temperatures[key]}
                      onChange={(e) => setTemperatures((prev) => clampOrdered({ ...prev, [key]: Number(e.target.value) }, key))}
                      aria-label={`${key} temperature in kelvin`}
                      className="rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1.5 py-0.5 text-[var(--color-ink)]"
                    >
                      {TEMPERATURE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t} K</option>
                      ))}
                    </select>
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                  Ea
                  <input type="range" min={10} max={80} value={mbEa} onChange={(e) => setMbEa(Number(e.target.value))} aria-label="Activation energy" />
                </label>
              </div>
            }
          />
        )}

        <MoleculeKey />
      </div>
    </InteractiveFrame>
  );
}

// Keeps T1 < T2 < T3 whenever one is changed. The changed value is
// first clamped into a range that leaves enough room for the other two
// (this is what prevents an unsatisfiable boundary case -- e.g. setting
// T3 to 260 would otherwise try to push T1/T2 below the 250 K floor),
// then the other two are cascaded away from it in both directions.
// Verified against boundary cases (T1 at the max, T3 at the min) before
// being wired in.
function clampOrdered(temps, changedKey) {
  const MIN = 250, MAX = 700, STEP = 50;
  const next = { ...temps };
  if (changedKey === "T1") next.T1 = Math.min(next.T1, MAX - 2 * STEP);
  if (changedKey === "T2") next.T2 = Math.max(MIN + STEP, Math.min(next.T2, MAX - STEP));
  if (changedKey === "T3") next.T3 = Math.max(MIN + 2 * STEP, next.T3);

  const order = ["T1", "T2", "T3"];
  const changedIdx = order.indexOf(changedKey);
  for (let i = changedIdx + 1; i < order.length; i++) {
    if (next[order[i]] <= next[order[i - 1]]) next[order[i]] = Math.min(MAX, next[order[i - 1]] + STEP);
  }
  for (let i = changedIdx - 1; i >= 0; i--) {
    if (next[order[i]] >= next[order[i + 1]]) next[order[i]] = Math.max(MIN, next[order[i + 1]] - STEP);
  }
  return next;
}

/** The shared LEFT-vessel / RIGHT-main layout used by all four tabs --
 * one layout component, not four independently-built screens. When the
 * magnifier is on, it overrides `main` with the live magnifier mirror
 * (only for the first three tabs, which pass magnifierOn/magnifierData
 * through). */
function ObservationLayout({ vessel, main, belowVessel, belowMain, magnifierOn, magnifierData, forceMain = false }) {
  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
      <div className="sm:w-[28%]">
        <div className="rounded-lg border border-[var(--color-line)] p-1.5">{vessel}</div>
        {belowVessel}
      </div>
      <div className="sm:w-[72%]">
        {magnifierOn && !forceMain ? <MagnifierLiveView particles={magnifierData.particles} center={magnifierData.center} /> : main}
        {belowMain}
      </div>
    </div>
  );
}

function EmptyMagnifiedView({ text }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <p className="text-center text-sm text-[var(--color-ink-faint)]">{text}</p>
    </div>
  );
}

function ActivationEnergyPanel({ ea, setEa, eaCase, setEaCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const collisionEnergy = eaCase === "insufficient" ? CASE_A_COLLISION_ENERGY : CASE_B_COLLISION_ENERGY;
  const sufficient = collisionEnergy >= ea;
  return (
    <div>
      <MagnifiedView
        mode="activation"
        energySufficient={sufficient}
        calloutLine="Particles must collide with sufficient energy."
        resultLine={sufficient ? "Reaction possible" : "Insufficient energy \u2014 particles separate"}
        speed={speed}
        onSpeedChange={onSpeedChange}
        replayKey={`${replayKey}-${sufficient}`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          Ea
          <input type="range" min={10} max={80} value={ea} onChange={(e) => setEa(Number(e.target.value))} aria-label="Activation energy" />
        </label>
        <div className="flex gap-1.5">
          <TabButton active={eaCase === "insufficient"} onClick={() => { setEaCase("insufficient"); bumpReplay(); }}>Case 1</TabButton>
          <TabButton active={eaCase === "sufficient"} onClick={() => { setEaCase("sufficient"); bumpReplay(); }}>Case 2</TabButton>
        </div>
      </div>
    </div>
  );
}

function OrientationPanel({ orientationCase, setOrientationCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const correct = orientationCase === "correct";
  return (
    <div>
      <MagnifiedView
        mode="orientation"
        energySufficient={true}
        orientationCorrect={correct}
        calloutLine="Sufficient energy alone may still not be enough."
        resultLine={correct ? "Successful collision \u2014 products form" : "Particles separate"}
        speed={speed}
        onSpeedChange={onSpeedChange}
        replayKey={replayKey}
      />
      <div className="mt-2 flex justify-center gap-1.5">
        <TabButton active={!correct} onClick={() => { setOrientationCase("incorrect"); bumpReplay(); }}>Incorrect Orientation</TabButton>
        <TabButton active={correct} onClick={() => { setOrientationCase("correct"); bumpReplay(); }}>Correct Orientation</TabButton>
      </div>
    </div>
  );
}

function MoleculeKey() {
  return (
    <div className="mt-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
        {["A", "B", "C", "D"].map((species) => (
          <div key={species} className="flex flex-col items-center gap-1">
            {/* Centered on the molecule's own local origin with generous
                margin (the shape spans roughly -18 to +14.5 horizontally
                around its centre) -- this is what the previous version
                got wrong: it drew the molecule off-centre inside a
                viewBox too narrow to contain it, clipping the large atom. */}
            <svg viewBox="-20 -14 40 28" width="44" height="30" className="overflow-visible">
              <Molecule species={species} x={0} y={0} size={1} label={false} />
            </svg>
            <span className="text-[11px] font-semibold text-[var(--color-ink)]">{species}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-center text-[11px] text-[var(--color-ink-faint)]">A + B {"\u2192"} C + D</p>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? "bg-[var(--color-teal)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"}`}
    >
      {children}
    </button>
  );
}
