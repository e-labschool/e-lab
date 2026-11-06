import { useMemo } from "react";
import ActivityFrame from "../components/ActivityFrame.jsx";
import { ChipGroup, Scene, sup } from "../components/ui.jsx";
import MsSpectrum, { staggerHeights } from "../components/MsSpectrum.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { PATTERN_COMPOUNDS } from "../state/msState.js";
import { isotopePattern, isotopologues, parseFormula, simpleRatio } from "../physics/isotopes.js";

export const PATTERN_INFO = {
  cl2: { f: "Cl2", name: "Cl₂", full: "chlorine" }, ch3cl: { f: "CH3Cl", name: "CH₃Cl", full: "chloromethane" }, ch2cl2: { f: "CH2Cl2", name: "CH₂Cl₂", full: "dichloromethane" },
  chcl3: { f: "CHCl3", name: "CHCl₃", full: "trichloromethane" }, ch3br: { f: "CH3Br", name: "CH₃Br", full: "bromomethane" }, br2: { f: "Br2", name: "Br₂", full: "bromine" },
};
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const sub = (n) => String(n).replace(/\d/g, (d) => SUBS[d]);
/** "³⁵Cl–³⁷Cl", "³⁵Cl₂³⁷Cl" ... label of one isotopic combination. */
export function comboLabel(el, c) {
  const one = (A) => `${sup(A)}${el}`;
  const part = (A, k) => (k === 0 ? null : `${sup(A)}${el}${k > 1 ? sub(k) : ""}`);
  if (c.nLight + c.nHeavy === 1) return one(c.nLight ? c.light : c.heavy);
  if (c.nLight + c.nHeavy === 2) { const l = [...Array(c.nLight).fill(c.light), ...Array(c.nHeavy).fill(c.heavy)]; return l.map(one).join("–"); }
  return [part(c.light, c.nLight), part(c.heavy, c.nHeavy)].filter(Boolean).join("");
}
/** Activity reachable from interpretation (was stage 11): halogen isotope clusters from the polynomial (binomial) expansion, teaching or natural abundances. */
export default function PatternActivity() {
  const a = useMsActions(); const { compound, model, sel } = useMs((s) => s.s11);
  const info = PATTERN_INFO[compound]; const comp = useMemo(() => parseFormula(info.f), [info.f]);
  const el = comp.Cl ? "Cl" : "Br"; const n = comp[el];
  const pat = useMemo(() => isotopePattern(comp, { mode: model, only: [el] }), [comp, model, el]);
  const combos = useMemo(() => isotopologues(el, n, model), [el, n, model]);
  const peaks = pat.peaks.map((p, i) => ({ mz: p.nominal, rel: p.rel, label: comboLabel(el, combos[i]), role: i === 0 ? "M" : "M+2" }));
  const ints = model === "teaching" ? simpleRatio(pat.peaks.map((p) => p.rel)) : null;
  const ratioText = ints ? ints.join(" : ") : pat.peaks.map((p) => p.rel.toFixed(1)).join(" : ");
  const p = useTransition({ id: `ms-s11-${compound}-${model}`, target: 1, seconds: 3.4, from: 0 });
  const rows = pat.peaks.map((pk, i) => ({ ...pk, combo: combos[i], int: ints ? ints[i] : null }));
  const selRow = rows.find((r) => r.nominal === sel);
  const lo = Math.min(...peaks.map((q) => q.mz)) - 3; const hi = Math.max(...peaks.map((q) => q.mz)) + 3;
  const viz = (
    <div className="ms-boxfill" data-testid="pattern-view" data-compound={compound} data-model={model} data-ratio={ratioText.replace(/ /g, "")}>
      <Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={peaks} heights={staggerHeights(peaks, p)} xRange={[lo, hi]} labels="ion" selected={sel} onSelect={(mz) => a.patch("s11", { sel: mz })} ariaLabel={`Molecular ion cluster of ${info.name}`} testId="pattern-spectrum" colorBy="role" />}</Scene>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <ChipGroup label="Compound" options={PATTERN_COMPOUNDS.map((id) => ({ id, label: PATTERN_INFO[id].name, title: PATTERN_INFO[id].full }))} value={compound} onChange={(id) => a.patch("s11", { compound: id, sel: null })} testId="compound" small />
      <ChipGroup label="Abundance model" options={[{ id: "teaching", label: "Teaching", title: "Cl 75 : 25, Br 1 : 1" }, { id: "natural", label: "Natural", title: "Cl 75.76 : 24.24, Br 50.69 : 49.31" }]} value={model} onChange={(id) => a.patch("s11", { model: id })} testId="model" small />
    </div>
  );
  return (
    <ActivityFrame id="patterns" title="Molecular isotope patterns" viz={viz} strip={strip} teacher={(
      <>
        <p><b>Method.</b> For n atoms of an element with two isotopes the probability of k heavy atoms is C(n,k)·p<sup>n−k</sup>·q<sup>k</sup> (the polynomial (p·x<sup>a</sup> + q·x<sup>b</sup>)<sup>n</sup>). For Cl₂ with p = 3/4, q = 1/4: 9/16, 6/16, 1/16, that is 9 : 6 : 1. For one bromine atom (about 1 : 1) the pattern is M : M+2 = 1 : 1.</p>
        <p><b>Simplifications.</b> Only the halogen isotopes are expanded and the pattern is given at nominal mass. Fragmentation, ¹³C (M+1) and other isotopes (and the natural 75.76 : 24.24 ratio) change the real peaks a little; the natural model is shown on request. Bromine-79 and bromine-81 are nearly equal in abundance; chlorine is close to 3 : 1.</p>
      </>
    )}>
      <p data-testid="s11-text">One molecule has <b>one</b> combination of isotopes. The sample contains all combinations, so the molecular ion shows a <b>cluster</b> of peaks.</p>
      <table className="ms-table" data-testid="pattern-table">
        <thead><tr><th scope="col">Combination</th><th scope="col">m/z</th><th scope="col">{ints ? "Ratio (whole numbers)" : "Relative intensity (%)"}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nominal} className={r.nominal === sel ? "is-sel" : ""} data-testid={`pattern-row-${r.nominal}`}>
              <td>{comboLabel(el, r.combo)}{r.combo.count > 1 ? ` ×${r.combo.count}` : ""}</td><td>{r.nominal}</td><td>{ints ? r.int : r.rel.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ms-ratio" data-testid="pattern-ratio">Pattern: <b>{ratioText}</b>{selRow ? ` · m/z ${selRow.nominal}: ${comboLabel(el, selRow.combo)}` : ""}</p>
      {ints && <p className="ss-note" data-testid="s11-scale">The graph scales the tallest peak to 100 %, so a {ints.join(" : ")} ratio is drawn as bars of {pat.peaks.map((q) => Math.round(q.rel)).join(", ")} %. The ratio, not the bar height in %, is the abundance ratio.</p>}
      <p className="ss-note" data-testid="s11-note">Simplified nominal-mass patterns: fragmentation and other isotopes (¹³C) add extra small peaks. {el === "Br" ? "One Br gives M : M+2 ≈ 1 : 1." : n === 1 ? "One Cl gives M : M+2 ≈ 3 : 1." : "Compare with the one-chlorine pattern of CH₃Cl (3 : 1)."}</p>
    </ActivityFrame>
  );
}
