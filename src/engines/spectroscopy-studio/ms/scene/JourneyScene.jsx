import { useEffect, useMemo, useRef, useState } from "react";
import { makeWorld, cameraRect, fitCamera } from "./world.js";
import Instrument from "./Instrument.jsx";
import MolGlyph, { GlyphGradients } from "../components/MolGlyph.jsx";
import { shapePath } from "../components/shapes.js";
import { moleculeFrame, ionTokens, crossTime, homePoint } from "../model/journey.js";
import { scanFocus, PULSES, TOF_DISPLAY_SEC_PER_US } from "../model/experiment.js";
import { tofTime, fieldFor } from "../model/analyser.js";
import { sectorPoint, SECTOR } from "../physics/sector.js";
import { useBox } from "../components/ui.jsx";
import { useReducedMotion } from "../../state/StudioContext.jsx";

/** Smoothly move the camera (viewBox) when the stage changes: contextual zoom, not a different picture. Camera movement is navigation, so it also runs while the experiment is paused. */
function useCamera(target, reduced) {
  const [cam, setCam] = useState(target); const ref = useRef({ cur: target });
  const key = `${target.x.toFixed(1)}|${target.y.toFixed(1)}|${target.w.toFixed(1)}|${target.h.toFixed(1)}`;
  useEffect(() => {
    const st = ref.current; if (reduced || typeof requestAnimationFrame === "undefined") { st.cur = target; setCam(target); return undefined; }
    const from = st.cur; const t0 = performance.now(); let raf = 0; let alive = true;
    const tick = (now) => {
      if (!alive) return; const f = Math.min(1, (now - t0) / 900); const e = f * f * (3 - 2 * f);
      const c = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e, k: from.k + (target.k - from.k) * e };
      st.cur = c; setCam(c); if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick); return () => { alive = false; cancelAnimationFrame(raf); };
  }, [key, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return cam;
}

const REGION_LABEL = { reservoir: "sample reservoir", inlet: "sample inlet", "inlet-chamber": "ion source, before the electron beam", ionisation: "ionization region", fragmentation: "fragmentation region", pump: "being pumped away", acceleration: "acceleration region", analyser: "mass analyser", detector: "detector" };
export const regionLabel = (r) => REGION_LABEL[r] ?? r;

/** The ONE persistent simulation workspace: the whole instrument is always in the picture, the camera and the emphasis follow the stage. */
export default function JourneyScene({ exp, stage, t, started, fired = true, analyser, V, B, plan, showCharges, showLabels, track, cmp, selMz, onSelectMolecule, onWorld }) {
  const [ref, size] = useBox({ w: 800, h: 360 });
  const reduced = useReducedMotion();
  const tall = size.w / size.h < 1.18 && size.w < 760;
  const world = useMemo(() => makeWorld({ tall, analyser }), [tall, analyser]);
  useEffect(() => { onWorld?.(world); }, [world]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => fitCamera(cameraRect(world, stage), size.w, size.h), [world, stage, size.w, size.h]);
  const cam = useCamera(target, reduced); const k = cam.k || target.k;
  const gid = "jr";
  const cat = exp.cat; const geo = exp.sim.geo;
  const stageT = t;
  // stage 5 sector: the scanning magnet changes B continuously
  const focus = stage >= 5 && plan && analyser === "sector" ? scanFocus(plan, Math.min(stageT, plan.total)) : null;
  const Bnow = focus ? fieldFor(Math.max(6, focus.mz), V) : B;
  const frames = stage <= 3 ? exp.molecules.map((m) => moleculeFrame(exp, world, stage, stageT, m, { started, tracked: track.id === m.i })) : [];
  const fs = (px) => px / k;
  return (
    <div ref={ref} className="ms-scene ms-jscene" data-testid="journey-scene">
      <svg width={size.w} height={size.h} viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`} className="ms-journey-svg" role="group" data-testid="journey-svg" data-stage={stage} data-analyser={analyser} data-mode={tall ? "tall" : "wide"} data-t={stageT.toFixed(2)}
        aria-label={`Mass spectrometer, ${analyser === "tof" ? "time-of-flight analyser" : "magnetic-sector analyser"}. Stage ${stage} of 6. Illustrative, not to scale.`}>
        <GlyphGradients id={gid} />
        <Instrument world={world} stage={stage} k={k} V={V} B={Bnow} exp={exp} cat={cat} analyser={analyser} showLabels={showLabels} arcs={stage >= 4 && analyser === "sector"} selMz={selMz} />
        {stage === 2 && fired && <Electrons exp={exp} world={world} t={stageT} k={k} />}
        {/* stage 1-3 population */}
        <g data-testid="population">
          {frames.map((f) => {
            if (f.opacity < 0.02) return null; const m = exp.molecules[f.i];
            const isT = track.id === f.i; let mark = null;
            if (isT) { mark = 0; if (track.follow === "neutral") { const ni = f.parts.findIndex((p) => p.role === "neutral" && !p.stretching); if (ni > 0) mark = ni; } }
            return <MolGlyph key={f.i} gid={gid} geo={geo} frame={f} cat={cat} scale={1} k={k} showCharges={showCharges} showLabels={showLabels && stage >= 2} mark={mark} onSelect={onSelectMolecule}
              testId={`mol-${f.i}`} ariaLabel={`Molecule ${m.label}: ${f.status}${isT ? " (tracked)" : ""}`} labelPx={10.5} />;
          })}
        </g>
        {stage === 4 && <IonTokens exp={exp} world={world} t={stageT} k={k} V={V} B={B} analyser={analyser} cmp={cmp} track={track} showCharges={showCharges} showLabels={showLabels} selMz={selMz} />}
        {stage >= 5 && plan && analyser === "sector" && <ScanBeam exp={exp} world={world} plan={plan} t={Math.min(stageT, plan.total)} k={k} V={V} cat={cat} focus={focus} showLabels={showLabels} track={track} />}
        {stage >= 5 && plan && analyser === "tof" && <TofPulses exp={exp} world={world} plan={plan} t={Math.min(stageT, plan.total)} k={k} V={V} cat={cat} showCharges={showCharges} showLabels={showLabels} track={track} selMz={selMz} />}
        <text x={cam.x + cam.w - fs(8)} y={cam.y + cam.h - fs(6)} textAnchor="end" fontSize={fs(10.5)} className="ms-scenelabel is-sm" aria-hidden="true">illustrative, not to scale</text>
      </svg>
    </div>
  );
}

function Electrons({ exp, world, t, k }) {
  const span = world.filamentY - world.trapY; const dots = [];
  for (let j = 0; j < 9; j += 1) { const y = world.filamentY - ((t * 120 + (j * span) / 9) % span); dots.push({ x: world.beamX + 2.5 * Math.sin(t * 7 + j), y, key: `b${j}` }); }
  for (const m of exp.ionised) {
    const tc = crossTime(exp, world, m); const s = t - tc; if (s < 0 || s > 1.1) continue; const home = homePoint(exp, world, m);
    for (const sgn of [-1, 1]) dots.push({ x: world.beamX + sgn * 70 * s * (1 + 0.2 * sgn), y: home.y - 26 * s - 30 * s * s, key: `e${m.i}${sgn}`, op: 1 - s / 1.1 });
  }
  const r = 3.4;
  return (
    <g data-testid="electrons" aria-hidden="true">
      {dots.map((d) => (
        <g key={d.key} opacity={d.op ?? 0.95}><circle cx={d.x} cy={d.y} r={r} fill="#38bdf8" stroke="#0c4a6e" strokeWidth={0.8 / k} /><text x={d.x} y={d.y} textAnchor="middle" dy="0.34em" fontSize={r * 1.7} fontWeight="900" fill="#082f49">−</text></g>
      ))}
      <text x={world.beamX - 12} y={world.H / 2 - 6} textAnchor="end" fontSize={11 / k} className="ms-scenelabel is-ebeam">electron beam</text>
      <text x={world.beamX - 12} y={world.H / 2 + 8} textAnchor="end" fontSize={11 / k} className="ms-scenelabel is-ebeam">M + e⁻ → M⁺• + 2e⁻</text>
    </g>
  );
}

function IonToken({ x, y, ion, z = 1, k, showCharges, showLabels, dashed, label, tracked, dim = 1, flash = 0, r = 8 }) {
  const col = ion?.color ?? "#fb923c"; const shape = ion?.shape ?? "circle";
  return (
    <g opacity={dim} data-mz={ion?.mz} data-shape={shape}>
      {flash > 0 && <circle cx={x} cy={y} r={r + 14 * (1 - flash)} fill="none" stroke="#86efac" strokeWidth={2.4 / k} opacity={flash} />}
      {tracked && <circle cx={x} cy={y} r={r + 7} fill="none" stroke="#fff" strokeWidth={2.6 / k} strokeDasharray={`${8 / k} ${5 / k}`} className="ms-track-ring" />}
      <path d={shapePath(shape, x, y, r)} fill={`${col}99`} stroke={col} strokeWidth={2.4 / k} strokeDasharray={dashed ? `${4 / k} ${3 / k}` : undefined} />
      {showCharges && <text x={x} y={y} textAnchor="middle" dy="0.35em" fontSize={r * 1.25} fontWeight="900" fill="#0a1330">{z > 1 ? `${z}+` : "+"}</text>}
      {showLabels && <text x={x} y={y + r + 11 / k} textAnchor="middle" fontSize={10.5 / k} className="ms-mol-label" fill={col}>{label ?? ion?.mz}</text>}
    </g>
  );
}

function IonTokens({ exp, world, t, k, V, B, analyser, cmp, track, showCharges, showLabels, selMz }) {
  const cmpIons = cmp?.on && cmp.mz ? [{ mz: cmp.mz, z: 1, label: `1+  m/z ${cmp.mz}`, ion: exp.cat[cmp.mz] }, { mz: cmp.mz / 2, z: 2, label: `2+  m/z ${cmp.mz / 2}`, ion: exp.cat[cmp.mz] }] : [];
  const toks = ionTokens(exp, world, V, B, analyser, t, { cmp: cmpIons });
  return (
    <g data-testid="ion-tokens">
      {toks.map((tk) => {
        const ion = tk.cmp ? cmpIons[Number(tk.id.slice(1))].ion : exp.cat[tk.mz]; const end = tk.model.end; const after = t - end;
        const lost = tk.phase === "end" && tk.outcome !== "detector";
        const detected = tk.phase === "end" && tk.outcome === "detector";
        return (
          <g key={tk.id} data-testid={`token-${tk.id}`} data-phase={tk.phase} data-outcome={tk.outcome ?? ""} data-mz={tk.mz}>
            <IonToken x={tk.x} y={tk.y} ion={ion} z={tk.z} k={k} showCharges={showCharges} showLabels={showLabels && (tk.cmp || tk.phase !== "wait")} dashed={tk.cmp && tk.z === 2} label={tk.cmp ? tk.label : String(tk.mz)}
              tracked={!tk.cmp && track.id === tk.i && track.id !== null} dim={detected ? Math.max(0.0, 1 - Math.max(0, after - 0.8) / 1.2) : lost ? 0.6 : 1} flash={detected && after < 0.9 ? 1 - after / 0.9 : 0} />
            {lost && <text x={tk.x + 10} y={tk.y - 8} fontSize={13 / k} fontWeight="900" fill="#fca5a5" aria-hidden="true">✕</text>}
          </g>
        );
      })}
      {void selMz}
    </g>
  );
}

function ScanBeam({ exp, world, plan, t, k, V, cat, focus, showLabels, track }) {
  const xy = world.sectorXY; const sx = world.sector; const R = SECTOR.R_DET;
  const inWin = plan.ok.find((d) => Math.abs(d.mz - focus.mz) <= 0.5);
  const beads = []; if (inWin) { const ion = cat[inWin.mz]; for (let j = 0; j < 6; j += 1) { const u = (t * 1.8 + j / 6) % 1; const p = sectorPoint(R, Math.PI * u); const q = xy(p.x, p.y); beads.push({ ...q, key: j, ion }); } }
  const end = xy(2 * R, 0);
  const flashPhase = inWin ? (t * 3) % 1 : 0;
  const trackedMz = track.id !== null ? exp.molecules[track.id]?.ionMz : null;
  return (
    <g data-testid="scan-beam" data-focus={focus.mz.toFixed(2)} data-sweep={focus.sweep + 1} data-hit={inWin ? inWin.mz : ""}>
      <path d={`M${world.plateX} ${world.yc} A${R * sx.s} ${R * sx.s} 0 0 1 ${end.x} ${end.y}`} fill="none" className="ms-focusarc is-on" strokeWidth={2.4 / k} />
      {beads.map((b) => <IonToken key={b.key} x={b.x} y={b.y} ion={b.ion} k={k} showCharges={false} showLabels={false} r={5.5} tracked={trackedMz === inWin.mz && b.key === 0} />)}
      {inWin && <circle cx={end.x - 4} cy={end.y} r={6 + 12 * flashPhase} fill="none" stroke="#86efac" strokeWidth={2.4 / k} opacity={1 - flashPhase} />}
      <text x={world.plateX + sx.boxW - 6 / k} y={world.yc + sx.boxH * 0.8} textAnchor="end" fontSize={12 / k} className="ms-scenelabel is-volt" data-testid="scan-readout">sweep {focus.sweep + 1} of {plan.sweeps} · focused m/z {focus.mz.toFixed(1)}</text>
      {showLabels && <text x={world.plateX + sx.boxW - 6 / k} y={world.yc + sx.boxH * 0.8 + 16 / k} textAnchor="end" fontSize={11 / k} className="ms-scenelabel is-sm">B = {fieldFor(Math.max(6, focus.mz), V).toFixed(3)} T</text>}
    </g>
  );
}

function TofPulses({ exp, world, plan, t, k, V, cat, showCharges, showLabels, track, selMz }) {
  const T = world.tof; const out = []; const lanes = [...new Set(exp.detector.map((d) => d.mz))].sort((a, b) => a - b);
  const trackedMz = track.id !== null ? exp.molecules[track.id]?.ionMz : null;
  for (let p = 0; p < plan.pulses; p += 1) {
    const ts = p * plan.period + 0.3; if (t < ts) continue;
    for (const d of plan.ok) {
      const tf = tofTime(d.mz, V) * 1e6 * TOF_DISPLAY_SEC_PER_US; const tau = t - ts; const f = tau / tf; const lane = lanes.length > 1 ? (lanes.indexOf(d.mz) / (lanes.length - 1) - 0.5) * 2 * T.h * 0.42 : 0;
      if (f > 1 + 0.35) continue;
      const x = world.plateX + Math.min(1, f) * T.L; out.push({ key: `${p}-${d.mz}`, x, y: world.yc + lane * Math.min(1, f * 6), ion: cat[d.mz], arrived: f >= 1, fade: f >= 1 ? 1 - (f - 1) / 0.35 : 1, mz: d.mz, pulse: p });
    }
  }
  const pulseNow = Math.min(PULSES, Math.floor(t / plan.period) + 1);
  return (
    <g data-testid="tof-pulses" data-pulse={pulseNow}>
      {out.map((o) => <IonToken key={o.key} x={o.x} y={o.y} ion={o.ion} k={k} showCharges={false} showLabels={showLabels && o.pulse === pulseNow - 1 && !o.arrived} r={6.5} dim={o.fade} flash={o.arrived ? o.fade : 0} tracked={trackedMz === o.mz && o.pulse === 0} />)}
      <text x={world.plateX + T.L / 2} y={world.yc + T.h / 2 + 22 / k} textAnchor="middle" fontSize={12 / k} className="ms-scenelabel is-volt" data-testid="tof-readout">pulse {pulseNow} of {plan.pulses} · lighter ions arrive first</text>
      {void showCharges}{void selMz}
    </g>
  );
}
