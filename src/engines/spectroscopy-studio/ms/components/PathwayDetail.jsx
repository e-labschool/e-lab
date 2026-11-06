import { useEffect, useRef, useState } from "react";
import { createFrameClock } from "../../../../lib/frameTime.js";
import { useReducedMotion, useStudio } from "../../state/StudioContext.jsx";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import MolGlyph, { GlyphGradients } from "./MolGlyph.jsx";
import { demoFrame, chainDuration } from "../model/journey.js";
import { chainTo } from "../data/molecules.js";
import { candidateIons } from "../model/ions.js";

/**
 * One molecular ion (a copy of the SAME ion as in the population) breaking along ONE verified pathway: bonds highlighted, bond stretches and breaks, the neutral product
 * separates (dashed ring, "0"), the charged fragment keeps its coloured ring, charge and m/z. A pathway with a second step (a fragment losing H₂ in turn) plays both steps.
 * Slow-motion replay runs at a quarter of the speed. The clock is local, honours Pause and the speed setting, and ends on the finished picture.
 */
export default function PathwayDetail({ exp, mz, title = "Pathway", testId = "pathway-detail", compact = false }) {
  const a = useMsActions(); const token = useMs((s) => s.detail.token); const slow = useMs((s) => s.detail.slow);
  const paused = useStudio((s) => s.paused); const speed = useStudio((s) => s.speed); const reduced = useReducedMotion();
  const sim = exp.sim; const chainIds = mz ? chainTo(sim.id, mz) : null; const chain = chainIds ? chainIds.map((id) => sim.pathById[id]) : [];
  const last = chain[chain.length - 1] ?? null; const dur = chainDuration(chain);
  const [tt, setTt] = useState(reduced ? dur : -0.7); const ref = useRef(tt);
  useEffect(() => { ref.current = reduced ? dur : -0.7; setTt(ref.current); }, [token, mz, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (paused || reduced || typeof requestAnimationFrame === "undefined") return undefined;
    const clock = createFrameClock(); let raf = 0; let alive = true;
    const tick = (now) => { if (!alive) return; const dt = clock.tick(now); if (ref.current < dur) { ref.current = Math.min(dur, ref.current + dt * speed * (slow ? 0.25 : 1)); setTt(ref.current); } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => { alive = false; cancelAnimationFrame(raf); clock.dispose(); };
  }, [paused, reduced, speed, slow, dur, token, mz]);
  const frame = demoFrame(sim, chain, tt);
  const ion = mz ? exp.cat[mz] : exp.cat[exp.spec.mMz];
  const hi = last ? { charged: new Set(last.charged), neutral: new Set(last.neutral), breaks: tt < 1.5 ? last.breaks : [], color: ion.color } : null;
  const isIso = ion?.role === "isotope"; const cands = mz && !isIso ? candidateIons(exp.spec.comp, mz) : [];
  const scale = sim.id === "methane" ? 3.0 : 2.1; const done = tt >= dur - 0.05;
  return (
    <figure className="ms-pathdetail" data-testid={testId} data-mz={mz ?? ""} data-done={done ? "1" : "0"} data-slow={slow ? "1" : "0"}>
      <figcaption className="ms-pd-title">{title}{slow && <span className="ms-pd-slow"> · slow motion</span>}</figcaption>
      <div className="ms-pd-svgwrap">
        <svg viewBox="-150 -88 300 176" className="ms-pd-svg" role="img" aria-label={last ? `Animation: ${last.eq}` : `Structure of ${ion?.label ?? "the molecular ion"}`} data-testid={`${testId}-svg`} data-t={tt.toFixed(2)}>
          <GlyphGradients id="pd" />
          <MolGlyph gid="pd" geo={sim.geo} frame={frame} cat={exp.cat} scale={scale} k={1.15} showCharges showLabels labelPx={11} hi={tt < 2.2 ? hi : null} testId={`${testId}-mol`} ariaLabel="Molecular ion and its fragments" />
        </svg>
      </div>
      {last ? (
        <div className="ms-pd-text">
          <p className="ms-pd-eq" data-testid={`${testId}-eq`}>{chain.map((c) => c.eq).join("  then  ")}</p>
          <ul className="ms-pd-list">
            <li data-testid={`${testId}-charged`}><span className="ms-swatch" style={{ "--c": ion.color }} data-shape={ion.shape} aria-hidden="true" /> <b>Charged fragment:</b> {ion.label} · charge 1+ · m/z {mz} <i>(detected)</i></li>
            <li data-testid={`${testId}-neutral`}><span className="ms-swatch is-neutral" aria-hidden="true" /> <b>Neutral product{chain.length > 1 ? "s" : ""}:</b> {chain.map((c) => c.neutralLabel).join(" and ")} · no charge <i>(not accelerated, not detected)</i></li>
            <li data-testid={`${testId}-pos`}><b>Position on the spectrum:</b> the peak at m/z {mz}.</li>
          </ul>
          {!compact && <p className="ms-pd-why">{chain[chain.length - 1].text}</p>}
        </div>
      ) : (
        <div className="ms-pd-text">
          <p className="ms-pd-eq">{isIso ? ion.label : `${exp.sim.condensed}⁺•  (molecular ion, m/z ${exp.spec.mMz})`}</p>
          <p className="ms-pd-why">{isIso ? "The same structure as the molecular ion, but with one heavier isotope (¹³C, or ²H). No bond breaks: it is a separate, small peak one mass unit higher." : "The intact ionised molecule: no bond has broken, and nothing is lost. It gives the molecular-ion peak."}</p>
        </div>
      )}
      {cands.length > 0 && (
        <p className="ms-pd-cands" data-testid={`${testId}-cands`}>
          Formulas that fit this nominal m/z and the molecular formula: {cands.map((c) => <b key={c.formula} className={c.plain === (ion?.comp ?? "") ? "is-shown" : ""}>{c.label}</b>).reduce((acc, x, i) => (i ? [...acc, ", ", x] : [x]), [])}.
          {cands.length > 1 ? " The m/z alone cannot tell them apart; the pathway shown is the one this simulation animates." : " Even one formula can belong to several structures, so a single peak does not prove a structure by itself."}
        </p>
      )}
      <div className="ms-pd-btns">
        <button type="button" className="sim-btn ss-chipbtn" onClick={() => a.replayDetail(false)} data-testid={`${testId}-replay`}>Replay</button>
        <button type="button" className="sim-btn ss-chipbtn" onClick={() => a.replayDetail(true)} data-testid={`${testId}-slow`} disabled={!last}>Slow-motion replay</button>
      </div>
    </figure>
  );
}
