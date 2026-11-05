import MsFrame from "./common.jsx";
import { Scene } from "../components/ui.jsx";
import MsSpectrum, { staggerHeights } from "../components/MsSpectrum.jsx";
import { Badge } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { SPECTRA, SPECTRA_NOTE } from "../data/spectra.js";

const SPEC = SPECTRA.methane;
/** Stage 9: the complete representative methane EI spectrum, with the three terms. Click a peak for m/z, formula and origin. */
export default function Stage9Spectrum() {
  const a = useMsActions(); const sel = useMs((s) => s.s9.sel);
  const p = useTransition({ id: "ms-s9", target: 1, seconds: 6, from: 0 });
  const pk = sel !== null ? SPEC.byMz[sel] : null;
  const viz = (
    <div className="ms-boxfill" data-testid="spectrum-view">
      <Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={SPEC.peaks} heights={staggerHeights(SPEC.peaks, p)} xRange={[10, 19]} labels="ion" marks baseMz={SPEC.baseMz} mMz={SPEC.mMz} selected={sel} onSelect={(mz) => a.patch("s9", { sel: mz })} ariaLabel="Representative mass spectrum of methane" testId="methane-spectrum" />}</Scene>
      <Badge tone="warn" className="ss-badge--tl" testId="spectrum-note">Representative / idealised, not experimental</Badge>
    </div>
  );
  return (
    <MsFrame stage={9} viz={viz} teacher={(
      <>
        <p>{SPECTRA_NOTE}</p>
        <p>The vertical axis is relative intensity: the tallest peak is set to 100 %. In methane the molecular ion (m/z 16) happens to be the tallest peak, but in most compounds the base peak is a fragment (try ethanol in stage 12). A molecular ion peak may also be very weak or absent. The m/z 17 peak is the M+1 satellite from ¹³C (and ²H).</p>
      </>
    )}>
      <dl className="ms-terms" data-testid="terms">
        <div><dt>Molecular ion peak</dt><dd>the intact ionised molecule, M⁺• (m/z {SPEC.mMz}), if present</dd></div>
        <div><dt>Base peak</dt><dd>the most intense peak, set to 100 % (m/z {SPEC.baseMz})</dd></div>
        <div><dt>Fragment ion peaks</dt><dd>smaller charged pieces (m/z 12 to 15)</dd></div>
      </dl>
      <div className="ms-peakinfo" data-testid="peak-info" aria-live="polite">
        {pk ? (
          <>
            <p><b>m/z {pk.mz}</b> · <span className="ms-ionname" data-testid="info-formula">{pk.label}</span> · {pk.rel.toFixed(pk.rel < 10 ? 1 : 0)} %</p>
            <p data-testid="info-origin">{pk.origin}</p>
          </>
        ) : <p className="ss-note">Click a peak to see its m/z, formula and origin.</p>}
      </div>
    </MsFrame>
  );
}
