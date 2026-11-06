import { useMs, useMsActions, useMsShallow } from "../state/MsContext.jsx";
import { ChipGroup } from "../components/ui.jsx";
import Key from "../components/Key.jsx";
import PathwayDetail from "../components/PathwayDetail.jsx";
import { buildExperiment, POPULATION_NOTE } from "../model/experiment.js";
import { shapePath } from "../components/shapes.js";

const Swatch = ({ ion }) => <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="ms-keysvg"><path d={shapePath(ion.shape, 9, 9, 7)} fill={`${ion.color}33`} stroke={ion.color} strokeWidth="2" /></svg>;
export const effectivePath = (exp, selPath, track) => {
  if (selPath && exp.sim.pathById[selPath]) return selPath;
  const m = track.id !== null ? exp.molecules[track.id] : null;
  if (m && m.outcome.chain.length) return m.outcome.chain[m.outcome.chain.length - 1];
  return exp.sim.pathways[0].id;
};
export function Strip() {
  const a = useMsActions(); const { molId, seed, n, selPath, track } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, selPath: s.selPath, track: s.track }));
  const exp = buildExperiment({ molId, seed, n }); const cur = effectivePath(exp, selPath, track);
  return (
    <div className="ss-controlrow" data-testid="stage3-strip">
      <span className="ss-stripnote">Pathway</span>
      <ChipGroup label="Fragmentation pathway" value={cur} onChange={a.selectPath} testId="path" small
        options={exp.sim.pathways.map((p) => ({ id: p.id, label: `m/z ${p.mz}  ${exp.cat[p.mz].label}`, sub: p.secondary ? `second step, from m/z ${exp.sim.pathById[p.from].mz}` : (p.kind ?? "bond cleavage"), title: p.eq }))} />
    </div>
  );
}
export function Panel() {
  const { molId, seed, n, selPath, track } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, selPath: s.selPath, track: s.track }));
  const exp = buildExperiment({ molId, seed, n }); const cur = effectivePath(exp, selPath, track); const path = exp.sim.pathById[cur];
  const tally = exp.outcomeTally; const M = exp.spec.byMz[exp.spec.mMz];
  const m = track.id !== null ? exp.molecules[track.id] : null;
  const mine = m ? (!m.ionised ? "was not ionized, so there is nothing to fragment" : m.outcome.type === "survive" ? "survives intact" : `breaks to give ${exp.cat[m.ionMz].label} (m/z ${m.ionMz})`) : null;
  return (
    <>
      <p data-testid="s3-text">The molecular ion carries extra internal energy, so some copies <b>break</b>, others <b>survive</b>. All the ions on the picture are copies of the <b>same</b> ion, {exp.sim.condensed}⁺•, yet they behave differently. A bond breaks and the ion splits into a <b>charged fragment</b> (detected) and a <b>neutral fragment</b> (not detected: no charge, so it is never accelerated, deflected or counted).</p>
      <ul className="ms-outcomes" data-testid="outcome-tally" aria-label="What happened to the molecules in this sample">
        <li data-kind="neutral"><b>{tally.neutral}</b> never ionized (neutral, pumped away)</li>
        <li data-kind="survive"><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="ms-keysvg"><circle cx="9" cy="9" r="7" fill="#fb923c33" stroke="#fb923c" strokeWidth="2" /></svg><b>{tally.survive}</b> molecular ion{tally.survive === 1 ? "" : "s"} survive{tally.survive === 1 ? "s" : ""} (m/z {exp.spec.mMz})</li>
        {Object.entries(tally.fragments).filter(([, c]) => c > 0).map(([mz, c]) => <li key={mz} data-kind="fragment" data-mz={mz}><Swatch ion={exp.cat[mz]} /><b>{c}</b> give {exp.cat[mz].label} (m/z {mz}){c > 1 ? ": the same fragment from different parents" : ""}</li>)}
      </ul>
      {mine && <p className="ss-prompt" data-testid="my-outcome">Tracked molecule {m.label}: {mine}.</p>}
      <p className="ss-note" data-testid="population-note">{POPULATION_NOTE}</p>
      <PathwayDetail exp={exp} mz={path.mz} title={`Pathway to m/z ${path.mz}: ${exp.cat[path.mz].label}`} />
      <p data-testid="s3-weak"><b>Why can the molecular ion be weak or missing?</b> A molecular ion that has a very easy way to break (a weak bond, or a very stable fragment such as CH₃CO⁺) fragments quickly, so few survive to be detected. Here M⁺• is {Math.round(M.rel)} % of the base peak; in some compounds, such as many alcohols and highly branched alkanes, it is tiny or absent.</p>
      <Key compact />
    </>
  );
}
export const TEACHER = (
  <>
    <p><b>Where do the proportions come from?</b> The ionized molecules are shared out in proportion to the intensities of the primary peaks of the representative spectrum (largest-remainder rounding). With only a handful of molecules the shares are rough; this does not reproduce experimental relative abundances. Peaks from a second step (for example m/z 27 from m/z 29) are shown by their pathway but are not counted as separate outcomes here.</p>
    <p><b>Which pathways are shown?</b> Only routes that are standard textbook processes for this molecule and whose products match the m/z of a peak in the spectrum; the scripts check the atom bookkeeping (charged mass + neutral mass = parent mass). α-cleavage is the usual route for ketones and alcohols; the charge ends up on whichever fragment can stabilise it better. Rearrangements (McLafferty) are not offered because they are not possible for these molecules.</p>
  </>
);
