import ActivityFrame from "../components/ActivityFrame.jsx";
import { Equation, Scene, sup } from "../components/ui.jsx";
import IsotopeScene, { COL35, COL37 } from "../components/IsotopeScene.jsx";
import MsSpectrum from "../components/MsSpectrum.jsx";
import { BigSlider, Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { chlorineSample } from "../physics/isotopes.js";
import { ISOTOPE_SOURCE, TERMS_NOTE, TEACHING_NOTE } from "../data/isotopes.js";

const f2 = (x) => x.toFixed(2);
/** Optional revision activity (was stage 10): chlorine isotopes, abundance slider, spectrum of Cl+ at m/z 35 and 37, live relative atomic mass. */
export default function IsotopeActivity() {
  const a = useMsActions(); const p35v = useMs((s) => s.s10.p35);
  const grow = useTransition({ id: "ms-s10", target: 1, seconds: 3, from: 0 });
  const s = chlorineSample(p35v);
  const peaks = [];
  if (s.p35 > 0) peaks.push({ mz: 35, rel: s.p35, label: "³⁵Cl⁺", role: "fragment" });
  if (s.p37 > 0) peaks.push({ mz: 37, rel: s.p37, label: "³⁷Cl⁺", role: "fragment" });
  const heights = Object.fromEntries(peaks.map((p) => [p.mz, p.rel * grow]));
  const viz = (
    <div className="ms-split" data-testid="isotope-view" data-p35={p35v} data-ar={s.arMassNumbers.toFixed(3)}>
      <div className="ms-split-a"><Scene>{({ w, h }) => <IsotopeScene w={w} h={h} p35={p35v} />}</Scene></div>
      <div className="ms-split-b"><Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={peaks.length ? peaks : [{ mz: 35, rel: 0, label: "", role: "fragment" }]} heights={heights} xRange={[33, 39]} labels="ion" colors={{ 35: COL35, 37: COL37 }} colorBy="plain" compact yLabel="Abundance (%)" ariaLabel="Mass spectrum of Cl+ ions of a chlorine sample" testId="isotope-spectrum" />}</Scene></div>
    </div>
  );
  const strip = (
    <div className="ss-controlrow ms-s10strip">
      <BigSlider id="ms-p35" label={`Abundance of ${sup(35)}Cl`} symbol="%" value={p35v} min={0} max={100} step={0.5} onChange={(v) => a.patch("s10", { p35: v })} badge={`${f2(s.p35).replace(/\.00$/, "")} % ³⁵Cl : ${f2(s.p37).replace(/\.00$/, "")} % ³⁷Cl`} color={COL35} testId="abundance-slider" />
      <div className="ms-presets" role="group" aria-label="Abundance presets">
        <button type="button" className="sim-btn ss-chipbtn" onClick={() => a.patch("s10", { p35: 75 })} data-testid="preset-teaching" aria-pressed={p35v === 75}>75 : 25 (teaching)</button>
        <button type="button" className="sim-btn ss-chipbtn" onClick={() => a.patch("s10", { p35: 75.76 })} data-testid="preset-natural" aria-pressed={p35v === 75.76}>75.76 : 24.24 (natural)</button>
      </div>
    </div>
  );
  return (
    <ActivityFrame id="isotopes" title="Isotopes and relative atomic mass" viz={viz} strip={strip} teacher={(
      <>
        <p><b>Terms.</b> {TERMS_NOTE}</p>
        <p><b>Ar from exact masses.</b> Using 34.9689 u and 36.9659 u with these abundances gives {s.arExact.toFixed(3)} (the accepted value for natural chlorine is about 35.45). The school calculation with mass numbers gives {s.arMassNumbers.toFixed(3)}; they differ because isotopic masses are not whole numbers. {TEACHING_NOTE}</p>
        <p className="ss-note">{ISOTOPE_SOURCE}</p>
      </>
    )}>
      <p data-testid="s10-text">Both isotopes have <b>17 protons</b> but a different number of <b>neutrons</b>, so different mass numbers (35, 37). In the spectrum the Cl⁺ ions appear at <b>m/z 35 and 37</b> and the peak heights show the abundances.</p>
      <Equation testId="ar-equation" className="ms-eq--block" parts={[{ t: `Aᵣ ≈ (35 × ${f2(s.p35).replace(/\.00$/, "")} + 37 × ${f2(s.p37).replace(/\.00$/, "")}) / 100 = ${s.arMassNumbers.toFixed(2)}` }]} ariaLabel={`Relative atomic mass approximately ${s.arMassNumbers.toFixed(2)}`} />
      <Readouts items={[
        { id: "ar", label: "Aᵣ from mass numbers", value: s.arMassNumbers.toFixed(2), tone: "mag" },
        { id: "ar-exact", label: "Aᵣ from isotopic masses", value: s.arExact.toFixed(2), tone: "b0" },
      ]} />
      <p className="ss-note" data-testid="s10-note">35 and 37 are <b>mass numbers</b>, used here as approximations. Precise Aᵣ uses the actual isotopic masses.</p>
    </ActivityFrame>
  );
}
