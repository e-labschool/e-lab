import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import StageFrame from "../StageFrame.jsx";
import { Choice, Pick, Caption, Fallback2D } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import Packet from "../../scene/Packet.jsx";
import { Beaker, Flask, BEAKER, levelY } from "../../scene/Equipment.jsx";
import { IonCloud, PourStream } from "../../scene/Fx.jsx";
import { BAG } from "../../engine/packetModel.js";
import { STAGE3_SOLUTES, STAGE3_MASSES, STAGE3_VOLUMES, stage3Info, soluteLabel, labelOf, formulaOf, amountText } from "../../engine/labConfig.js";
import { getSolute } from "../../engine/concLab.js";
import { fmtMol, fmtFixed } from "../../engine/numeric.js";

const ease = (t) => t * t * (3 - 2 * t); const clamp01 = (x) => Math.min(1, Math.max(0, x));
const POUR_S = 3.4; const TILT = -2.0;

/** One beaker + its ions.  `reveal` (0..1 ref) scales the ions in; the ion COUNT depends on n only, never on the volume. */
function Solution({ x, n, volumeMl, revealRef, levelRef, anion, shell, label, tint }) {
  const perSpecies = Math.round(n * 400);
  return (
    <group>
      <Beaker position={[x, 0, 0]} volumeMl={volumeMl} liquidRef={levelRef} dark={shell.dark} tint={tint} label={label} />
      <group position={[x, 0, 0]}><IonCloud perSpecies={perSpecies} R={BEAKER.R} y0={BEAKER.floor} heightRef={levelRef} revealRef={revealRef} anion={anion} reduced={shell.reduced} dark={shell.dark} /></group>
    </group>
  );
}

/** The single-beaker lab: the packet can be dragged over the beaker or poured with the button; the pour is a timed, controlled animation. */
function SingleScene({ solute, info, phase, setPhase, shell, startKey, drain, setDrain }) {
  const bx = 1.6; const home = useMemo(() => [-3.5, 0, 0.5], []); const pose = useMemo(() => [bx - 3.1, 4.9, 0.5], []);
  const grp = useRef(); const t0 = useRef(0); const prog = useRef(0); const reveal = useRef(phase === "done" ? 1 : 0); const level = useRef(levelY(info.volumeMl * (phase === "done" ? 1 : 0.8)));
  const src = useRef([0, 0, 0]); const dst = useRef([bx, BEAKER.H * 0.6, 0.5]); const streak = useRef(0);
  const drag = useRef({ on: false }); const { gl, camera, controls } = useThree();
  const draining = useRef(false);
  useEffect(() => { // restart of the pour (button or drop) -> timeline from 0
    if (startKey > 0) { t0.current = performance.now(); draining.current = false; }
  }, [startKey]);
  useEffect(() => { if (phase === "ready") { reveal.current = 0; prog.current = 0; streak.current = 0; level.current = levelY(info.volumeMl * 0.8); } }, [phase, info.volumeMl]);
  useEffect(() => { if (phase === "done") level.current = levelY(info.volumeMl); }, [info.volumeMl, phase]);
  // pointer drag over the canvas
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.5), []); const ray = useMemo(() => new THREE.Raycaster(), []); const hit = useMemo(() => new THREE.Vector3(), []);
  const onDown = useCallback((e) => { if (phase !== "ready") return; e.stopPropagation(); drag.current.on = true; drag.current.moved = false; if (controls) controls.enabled = false; }, [phase, controls]);
  useEffect(() => {
    const el = gl.domElement;
    const move = (ev) => { if (!drag.current.on || !grp.current) return; const r = el.getBoundingClientRect(); ray.setFromCamera({ x: ((ev.clientX - r.left) / r.width) * 2 - 1, y: -((ev.clientY - r.top) / r.height) * 2 + 1 }, camera); if (ray.ray.intersectPlane(plane, hit)) { grp.current.position.set(hit.x, Math.max(0.0, hit.y - 1.5), 0.5); drag.current.moved = true; } };
    const up = () => { if (!drag.current.on) return; drag.current.on = false; if (controls) controls.enabled = true; const g = grp.current; if (g && drag.current.moved && Math.abs(g.position.x - bx) < 3.6 && g.position.y > 1.2) setPhase("pouring"); else if (g) { g.position.set(...home); } };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [gl, camera, controls, plane, ray, hit, home, setPhase]);
  useFrame(() => {
    const g = grp.current; if (!g) return;
    if (phase === "pouring") {
      const D = shell.reduced ? 0.01 : POUR_S; const p = clamp01((performance.now() - t0.current) / 1000 / D); prog.current = p;
      const go = ease(clamp01(p / 0.22)); const back = ease(clamp01((p - 0.82) / 0.15)); const k = go * (1 - back);
      const sx = g.position.x; // start from wherever it was dropped
      void sx;
      g.position.set(home[0] + (pose[0] - home[0]) * k, home[1] + (pose[1] - home[1]) * k, 0.5); g.rotation.z = TILT * k * (1 + 0.06 * clamp01((p - 0.3) / 0.4));
      const a = g.rotation.z; src.current = [g.position.x - Math.sin(a) * 3.0, g.position.y + Math.cos(a) * 3.0, 0.5]; dst.current = [bx - 0.1, level.current + 0.1, 0.5];
      streak.current = clamp01((p - 0.3) / 0.45); if (p > 0.3 && !draining.current) { draining.current = true; setDrain(true); }
      reveal.current = ease(clamp01((p - 0.5) / 0.4)); level.current = levelY(info.volumeMl * (p > 0.72 ? 1 : 0.8));
      if (p >= 1) { g.position.set(...home); g.rotation.z = 0; reveal.current = 1; setPhase("done"); }
    } else if (phase === "done") { reveal.current = 1; }
  });
  const f = info.packets.packets[0] ?? 0;
  return (
    <group>
      <Packet groupRef={grp} substanceId={solute} fraction={drain ? 0 : f} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} position={home} onPointerDown={onDown}
        amountText={`${formulaOf(solute)} — ${amountText(info.n)}`} amountSub={`${fmtFixed(info.massG, 0)} g`} />
      <Solution x={bx} n={info.n} volumeMl={info.volumeMl} revealRef={reveal} levelRef={level} anion={solute === "NaCl" ? "Cl" : "OH"} shell={shell} label={`${info.volumeMl} mL`} />
      <PourStream srcRef={src} dstRef={dst} progressRef={streak} colour="#f4f6fb" />
      <Flask position={[4.9, 0, -0.2]} dark={shell.dark} />
    </group>
  );
}

/** Two beakers with the SAME final volume: the one with twice the solute has twice the ion density. */
function CompareScene({ solute, a, b, shell }) {
  const one = useRef(1); const la = useRef(levelY(a.volumeMl)); const lb = useRef(levelY(b.volumeMl));
  la.current = levelY(a.volumeMl); lb.current = levelY(b.volumeMl);
  const anion = solute === "NaCl" ? "Cl" : "OH";
  return (
    <group>
      <Packet substanceId={solute} fraction={a.packets.packets[0] ?? 0} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} position={[-5.9, 0, 0.3]} amountText={`${formulaOf(solute)} — ${amountText(a.n)}`} amountSub={`${fmtFixed(a.massG, 0)} g`} />
      <Solution x={-2.5} n={a.n} volumeMl={a.volumeMl} revealRef={one} levelRef={la} anion={anion} shell={shell} label={`A: ${fmtFixed(a.c, 2)} mol dm⁻³`} />
      <Solution x={2.5} n={b.n} volumeMl={b.volumeMl} revealRef={one} levelRef={lb} anion={anion} shell={shell} label={`B: ${b.ok ? fmtFixed(b.c, 2) : "–"} mol dm⁻³`} />
      <Packet substanceId={solute} fraction={b.packets.packets[0] ?? 0} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} position={[5.9, 0, 0.3]} amountText={`${formulaOf(solute)} — ${amountText(b.n)}`} amountSub={`${fmtFixed(b.massG, 0)} g`} />
    </group>
  );
}

export default function Stage3({ shell }) {
  const [solute, setSolute] = useState("NaOH"); const [massG, setMassG] = useState(10); const [vol, setVol] = useState(100); const [compare, setCompare] = useState(false);
  const [phase, setPhase] = useState("ready"); const [drain, setDrain] = useState(false); const [startKey, setStartKey] = useState(0);
  const info = useMemo(() => stage3Info(solute, massG, vol), [solute, massG, vol]);
  const infoB = useMemo(() => stage3Info(solute, massG * 2, vol), [solute, massG, vol]);
  const sol = getSolute(solute);
  const restart = useCallback(() => { setPhase("ready"); setDrain(false); setStartKey(0); }, []);
  useEffect(() => { restart(); }, [solute, massG, restart]);
  const pour = useCallback(() => { if (phase !== "ready") return; setStartKey((k) => k + 1); setPhase("pouring"); }, [phase]);
  // a drop on the beaker (drag) switches the phase from the scene; start the timeline when the phase becomes "pouring"
  const setPhaseFromScene = useCallback((p) => { if (p === "pouring") { setStartKey((k) => k + 1); } setPhase(p); }, []);
  const dissolved = compare || phase === "done";
  const err = compare ? (info.error || infoB.error) : info.error;
  const line = compare ? `A: ${info.line.split(";")[0]} → ${fmtFixed(info.c, 2)} mol dm⁻³   |   B: ${fmtFixed(massG * 2, 0)} g = ${fmtMol(infoB.n)} mol → ${fmtFixed(infoB.c, 2)} mol dm⁻³ (same final volume ${vol} mL)`
    : dissolved ? info.line : `${fmtFixed(massG, 0)} g ${formulaOf(solute)} = ${fmtMol(info.n)} mol. Pour the packet into the water (drag it over the beaker or press Pour).`;
  const bounds = compare ? { w: 14.2, h: 5.0, cx: 0, cy: 1.6, depth: 1 } : { w: 11.6, h: 5.2, cx: 0.9, cy: 1.8, depth: 1 };
  const fb = [{ substanceId: solute, fraction: info.packets.packets[0] ?? 0, formula: labelOf(solute), text: `${amountText(info.n)}, ${massG} g` }];
  const msg = err ? `${err}` : "";
  return (
    <StageFrame stage={3} title="Concentration"
      controls={<>
        <Pick label="Solute" value={solute} options={STAGE3_SOLUTES.map((v) => ({ value: v, label: soluteLabel(v) }))} onChange={setSolute} testId="ml-substance" />
        <Choice label="Mass" value={massG} options={STAGE3_MASSES.filter((m) => !compare || m <= 20)} onChange={setMassG} format={(v) => `${v} g`} testId="ml-mass" />
        <Choice label="Final volume" value={vol} options={STAGE3_VOLUMES} onChange={setVol} format={(v) => `${v} mL`} testId="ml-volume" />
        <button type="button" className={"ml-pill" + (compare ? " is-on" : "")} aria-pressed={compare} onClick={() => { setCompare((c) => !c); if (!compare && massG > 20) setMassG(20); }} data-testid="ml-compare">Compare two beakers</button>
        {!compare && <button type="button" className="ml-btn is-primary" onClick={phase === "done" ? restart : pour} disabled={phase === "pouring" || !info.ok} data-testid="ml-pour">{phase === "done" ? "Start again" : "Pour packet into water"}</button>}
        {msg && <span className="ml-note is-warn" role="alert" data-testid="ml-warn">{msg}</span>}
      </>}
      caption={<Caption line={line} testId="ml-line" more={<><p>{sol.equation}: in solution the solid is present as hydrated ions, not as NaOH molecules (Na⁺ and OH⁻ shown).</p><p>Concentration uses the <b>final volume of solution</b> (made up in a volumetric flask), not the volume of water you started with: c = n ÷ V.</p><p>Same n in a larger volume gives a lower concentration (dilution); the ion count in the picture stays the same.</p></>} />}
      aside={dissolved ? <div className="ml-legend" data-testid="ml-legend"><span><i className="ml-dot" style={{ background: "#8e5bd9" }} />Na⁺</span><span><i className="ml-dot" style={{ background: solute === "NaCl" ? "#2fb35e" : "#e3182d" }} />{solute === "NaCl" ? "Cl⁻" : "OH⁻"}</span></div> : null}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${line}. Beaker with dissolved ions.`}
        fallback="WebGL is not available, so a 2D picture of the packet is shown." noGL={<Fallback2D items={fb} title={line} note={`Concentration ${fmtFixed(info.c, 2)} mol dm⁻³ at ${vol} mL.`} />}>
        {compare ? <CompareScene solute={solute} a={info} b={infoB} shell={shell} />
          : <SingleScene key={`${solute}-${massG}`} solute={solute} info={info} phase={phase} setPhase={setPhaseFromScene} shell={shell} startKey={startKey} drain={drain} setDrain={setDrain} />}
      </LabCanvas>
    </StageFrame>
  );
}
export { BAG };
