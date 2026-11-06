import { useMemo, useState } from "react";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { useJourneyClock } from "../state/useJourneyClock.js";
import { buildExperiment, detectionPlan, detectionAt, finalHeights, totalIllustrativeIons, COUNT_NOTE, scanFocus } from "../model/experiment.js";
import { moleculeFrame, stageDuration, ionTokens } from "../model/journey.js";
import { makeWorld } from "../scene/world.js";
import JourneyScene, { regionLabel } from "../scene/JourneyScene.jsx";
import Overview from "./Overview.jsx";
import MsSpectrum from "./MsSpectrum.jsx";
import { Scene } from "./ui.jsx";
import { sectorWhere } from "../model/analyser.js";

const SPEC_PCT = { 1: 20, 2: 20, 3: 24, 4: 24, 5: 36, 6: 52 };
const PART_OF_REGION = { reservoir: "inlet", inlet: "inlet", "inlet-chamber": "ionisation", ionisation: "ionisation", fragmentation: "fragmentation", pump: "fragmentation", acceleration: "accelerator", analyser: "analyser", detector: "detector", spectrum: "spectrum" };

/** What the tracked particle is doing right now: { part, region, text } for the status line and the overview. */
export function trackInfo({ exp, world, stage, t, started, track, analyser, V, B, plan }) {
  if (track.id === null) return null; const m = exp.molecules[track.id]; if (!m) return null;
  const nm = m.label; const follow = track.follow;
  const ionNote = m.ionMz ? exp.cat[m.ionMz] : null;
  if (stage <= 3) {
    const f = moleculeFrame(exp, world, stage, t, m, { started, tracked: true });
    if (follow === "neutral" && stage === 3 && m.outcome.type === "fragment" && f.parts.some((p) => p.role === "neutral" && !p.stretching)) { const np = f.parts.find((p) => p.role === "neutral" && !p.stretching); return { part: "fragmentation", region: "being pumped away", text: `${nm}: neutral product ${np.label} (no charge) is not accelerated; it drifts to the vacuum pump` }; }
    const region = f.region; return { part: PART_OF_REGION[region] ?? "inlet", region: regionLabel(region), text: `${nm}: ${f.status}` };
  }
  if (!m.ionised) return { part: "fragmentation", region: "pumped away", text: `${nm}: this molecule was never ionised, so it stays neutral, is pumped away and is never accelerated, deflected or detected` };
  if (follow === "neutral" && m.outcome.type === "fragment") return { part: "fragmentation", region: "pumped away", text: `${nm}: the neutral product ${m.outcome.chain.length ? exp.sim.pathById[m.outcome.chain[0]].neutralLabel : ""} was pumped away in the fragmentation region: no charge, so it is not accelerated and never reaches the detector` };
  const what = m.outcome.type === "survive" ? `molecular ion M⁺• (m/z ${m.ionMz})` : `charged fragment ${ionNote.label} (m/z ${m.ionMz})`;
  if (stage === 4) {
    const tk = ionTokens(exp, world, V, B, analyser, t).find((q) => q.i === m.i);
    const map = { wait: ["fragmentation", "fragmentation region", "waiting to be extracted"], walk: ["accelerator", "ion extraction", "being drawn out through the slit"], accel: ["accelerator", "acceleration region", "accelerating through the potential difference V"], drift: ["analyser", "mass analyser entrance", "entering the analyser with speed set by m/z"], arc: ["analyser", "mass analyser", analyser === "tof" ? "flying along the tube" : "bent into a circular arc by the magnetic field"], flight: ["analyser", "flight tube", "drifting at constant speed"], end: tk?.outcome === "detector" ? ["detector", "detector", "reaches the detector: counted"] : ["analyser", "mass analyser", `${analyser === "sector" ? "does not reach the detector at this B (it is " + (tk?.outcome === "wall" ? "lost on the wall)" : "lost on the plate)") : ""}`] };
    const [part, region, txt] = map[tk?.phase] ?? map.wait; return { part, region, text: `${nm}: ${what}, ${txt}` };
  }
  if (stage === 5 && plan) {
    const mz = m.ionMz; const det = plan.ok.find((d) => d.mz === mz);
    if (!det) return { part: "analyser", region: "mass analyser", text: `${nm}: ${what} is outside the m/z range this magnet can focus at ${V} V: it is not detected` };
    if (analyser === "sector") { const a = ((mz - 0.5 - plan.lo) / plan.range) * plan.Ts; const w = plan.Ts / plan.range; const inWin = t >= a && t <= a + w; const done = t > a + w; return { part: inWin || done ? "detector" : "analyser", region: inWin || done ? "detector" : "mass analyser", text: `${nm}: ${what} ${inWin ? "is being transmitted and detected now" : done ? "was detected: it counts in the peak at this m/z" : "waits until the scanning magnet focuses its m/z on the detector"}` }; }
    return { part: "detector", region: "detector", text: `${nm}: ${what} arrives at the detector after its time of flight, lighter ions first` };
  }
  return { part: "spectrum", region: "mass spectrum", text: `${nm}: ${what} contributes to the peak at m/z ${m.ionMz}` };
}

/** The ONE persistent workspace: overview strip, tracking line, the instrument scene and the connected spectrum. Stages only change the camera, the emphasis and the clock. */
export default function Workspace() {
  const a = useMsActions();
  const st = useMs((s) => s);
  const { stage, molId, seed, n, started, fired, analyser, V, B, track, cmp, showCharges, showLabels, selPeak, selPath } = st;
  const exp = useMemo(() => buildExperiment({ molId, seed, n }), [molId, seed, n]);
  const [world, setWorld] = useState(() => makeWorld({ tall: false, analyser }));
  const w = world.analyser === analyser ? world : makeWorld({ tall: world.tall, analyser });
  const plan = useMemo(() => detectionPlan(exp, analyser, V), [exp, analyser, V]);
  const duration = stage <= 4 ? stageDuration(exp, stage, { analyser, V, B, world: w }) : stage === 5 ? plan.total : 0;
  const armed = stage === 1 ? started : stage === 2 ? fired : true;
  const t = useJourneyClock({ stage, duration, armed });
  const shownT = stage === 1 && !started ? 0 : stage === 2 && !fired ? 0 : t;
  const info = trackInfo({ exp, world: w, stage, t: shownT, started, track, analyser, V, B, plan });
  const det = stage === 5 ? detectionAt(exp, plan, V, Math.min(shownT, plan.total)) : null;
  const finalH = useMemo(() => finalHeights(exp, analyser, V), [exp, analyser, V]);
  const cat = exp.cat;
  const tallyMz = new Set([exp.spec.mMz, ...Object.keys(exp.outcomeTally.fragments).filter((k) => exp.outcomeTally.fragments[k] > 0).map(Number)]);
  const selPathMz = selPath ? exp.sim.pathById[selPath]?.mz : null;
  let heights; let selected = null;
  if (stage <= 4) { heights = Object.fromEntries(exp.spec.peaks.map((p) => [p.mz, (stage >= 3 && (tallyMz.has(p.mz) || p.mz === selPathMz)) ? (p.mz === selPathMz ? 16 : 7) : 0])); selected = selPathMz ?? null; }
  else if (stage === 5) { heights = det.heights; selected = selPeak; }
  else { heights = finalH; selected = selPeak; }
  const colors = Object.fromEntries(exp.spec.peaks.map((p) => [p.mz, cat[p.mz].color])); const shapes = Object.fromEntries(exp.spec.peaks.map((p) => [p.mz, cat[p.mz].shape]));
  const mzs = exp.spec.peaks.map((p) => p.mz);
  const onPeak = (mz) => { if (stage === 3) { const p = exp.sim.pathways.find((q) => q.mz === mz); a.selectPath(p ? p.id : null); } else if (stage >= 5) a.selectPeak(mz); };
  const clickable = stage === 3 || stage >= 5;
  const specNote = stage <= 2 ? "The spectrum is empty until ions reach the detector (stage 5)." : stage === 3 ? "Small marks show where this population's ions will appear. Peak heights come later." : stage === 4 ? "Heights are built up in stage 5." : stage === 5 ? "Illustrative counts are accumulating." : null;
  const focus = stage === 5 && analyser === "sector" ? scanFocus(plan, Math.min(shownT, plan.total)) : null;
  return (
    <div className="ms-journey" data-testid="journey-workspace" data-stage={stage} data-analyser={analyser} data-t={shownT.toFixed(2)} data-duration={duration.toFixed(2)}>
      <Overview stage={stage} analyser={analyser} trackPart={info?.part ?? null} />
      <TrackBar info={info} track={track} stage={stage} exp={exp} a={a} />
      <div className="ms-jmain">
        <JourneyScene exp={exp} stage={stage} t={shownT} started={started} fired={fired} analyser={analyser} V={V} B={B} plan={plan} showCharges={showCharges} showLabels={showLabels}
          track={track} cmp={cmp} selMz={stage >= 4 ? selPeak : null} onSelectMolecule={stage <= 3 ? a.trackMolecule : undefined} onWorld={setWorld} />
        {stage === 4 && analyser === "sector" && <div className="ss-badge ss-badge--tr ms-hud" data-testid="sector-hud">B = {B.toFixed(3)} T · V = {V} V · transmits m/z {focusMz(B, V).toFixed(1)}</div>}
        {stage === 5 && focus && <div className="ss-badge ss-badge--tr ms-hud" data-testid="scan-hud">sweep {focus.sweep + 1} of {plan.sweeps}: the magnet scans, one m/z reaches the detector at a time</div>}
      </div>
      <div className="ms-jspec" style={{ flexBasis: `max(96px, ${SPEC_PCT[stage]}%)` }} data-testid="spectrum-panel">
        <Scene testId="spectrum-scene">{({ w: sw, h: sh }) => <MsSpectrum width={sw} height={sh} peaks={exp.spec.peaks} heights={heights} xRange={[Math.max(0, Math.min(...mzs) - 3), Math.max(...mzs) + 3]} labels={stage >= 5 ? "ion" : "none"} colors={colors} shapes={shapes}
          marks={stage >= 5} baseMz={exp.spec.baseMz} mMz={exp.spec.mMz} selected={selected} onSelect={clickable ? onPeak : null} compact={sh < 150} colorBy="role" testId="ms-spectrum"
          ariaLabel={`Mass spectrum of ${exp.sim.name}: representative, built from illustrative ion counts`} />}</Scene>
        {specNote && <p className="ms-specnote" data-testid="spectrum-note">{specNote}</p>}
        {stage === 5 && det && <p className="ms-counter" data-testid="ion-counter" title={COUNT_NOTE}>Illustrative ions detected: <b>{Math.round(det.total).toLocaleString("en-US")}</b> of {totalIllustrativeIons(exp).toLocaleString("en-US")} <span>(teaching numbers, not measured)</span></p>}
      </div>
    </div>
  );
}
const focusMz = (B, V) => { const e = 1.602176634e-19; const u = 1.66053906892e-27; return (e * B * B * 0.1 * 0.1) / (2 * V) / u; };

function TrackBar({ info, track, stage, exp, a }) {
  const m = track.id !== null ? exp.molecules[track.id] : null;
  const canSplit = m && m.outcome.type === "fragment" && stage >= 3;
  return (
    <div className="ms-trackbar" data-testid="track-status" data-tracking={track.id !== null ? "1" : "0"} role="status" aria-live="polite">
      {info ? (
        <>
          <span className="ms-track-chip" aria-hidden="true">◉ Tracking {m.label}</span>
          <span className="ms-track-region" data-testid="track-region"><b>{info.region}</b></span>
          <span className="ms-track-text" data-testid="track-text">{info.text}</span>
          {canSplit && (
            <span className="ms-follow" role="radiogroup" aria-label="Follow">
              {[["parent", "Parent ion"], ["charged", "Charged fragment"], ["neutral", "Neutral product"]].map(([id, lab]) => (
                <button key={id} type="button" role="radio" aria-checked={track.follow === id} className="sim-btn ss-chipbtn ms-chip ms-chip--sm" onClick={() => a.setFollow(id)} data-testid={`follow-${id}`}>{lab}</button>
              ))}
            </span>
          )}
          <button type="button" className="sim-btn ss-chipbtn ms-chip ms-chip--sm" onClick={a.untrack} data-testid="untrack">Stop tracking</button>
        </>
      ) : (
        <span className="ms-track-text" data-testid="track-hint">{stage <= 3 ? "Track This Molecule: click any molecule in the picture to follow it through the whole instrument." : "No molecule is being tracked. Go back to a stage 1 to 3 and click a molecule to follow it to the detector."}</span>
      )}
    </div>
  );
}
export { sectorWhere };
