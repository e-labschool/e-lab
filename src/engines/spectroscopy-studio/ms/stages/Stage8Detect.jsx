import { useMemo } from "react";
import { Zap } from "lucide-react";
import MsFrame from "./common.jsx";
import { Scene } from "../components/ui.jsx";
import DetectScene from "../components/DetectScene.jsx";
import MsSpectrum from "../components/MsSpectrum.jsx";
import { Readouts } from "../../components/ui.jsx";
import { useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { arrivalSequence, heightsAfter } from "../physics/detection.js";
import { SPECTRA, SPECTRA_NOTE } from "../data/spectra.js";

const SPEC = SPECTRA.methane;
/** Stage 8: each detected ion adds to its peak. Peak height follows the NUMBER of ions detected at that m/z, not their mass. */
export default function Stage8Detect() {
  const a = useMsActions(); const started = useMs((s) => s.s8.started);
  const seq = useMemo(() => arrivalSequence("methane", 11), []);
  const mzs = useMemo(() => SPEC.peaks.map((p) => p.mz), []);
  const progress = useTransition({ id: "ms-s8", target: started ? 1 : 0, seconds: 14, from: 0 });
  const pos = progress * seq.length; const k = Math.min(seq.length, Math.floor(pos + 1e-9)); const f = pos - Math.floor(pos);
  const heights = heightsAfter(seq, k, "methane");
  const counts = {}; for (let i = 0; i < k; i += 1) counts[seq[i]] = (counts[seq[i]] ?? 0) + 1;
  const last = k > 0 ? seq[k - 1] : null;
  const viz = (
    <div className="ms-split" data-testid="detect-view" data-started={started ? "1" : "0"} data-k={k} data-total={seq.length}>
      <div className="ms-split-a"><Scene>{({ w, h }) => <DetectScene w={w} h={h} seq={seq} k={k} f={started ? f : 0} mzs={mzs} />}</Scene></div>
      <div className="ms-split-b"><Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={SPEC.peaks} heights={heights} xRange={[10, 19]} labels="mz" compact ariaLabel="Mass spectrum building up from detected ions" testId="detect-spectrum" />}</Scene></div>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <button type="button" className="sim-btn sim-btn--primary ss-cta" onClick={() => a.patch("s8", { started: true })} data-testid="detect-ions"><Zap size={16} aria-hidden="true" /> {started ? "Detecting" : "Detect ions"}</button>
      <span className="ss-stripnote" data-testid="sync-line">Ion reaches detector → signal recorded → peak grows at its m/z</span>
    </div>
  );
  return (
    <MsFrame stage={8} viz={viz} strip={strip} teacher={(
      <>
        <p><b>Detector response.</b> In practice an electron multiplier (or similar) turns each arriving ion into a burst of electrons; the instrument counts or sums the signal for each m/z. Peak intensity follows how many ions are detected at that m/z (and the detector response), not the mass of one ion.</p>
        <p><b>Here</b> the ions are those of the representative methane spectrum: one ion per 1 % of the base peak, arriving in a random order, so the m/z {SPEC.baseMz} bar ends at 100 ions and the m/z 12 bar at 3. After the last ion the bars equal the spectrum of stage 9. Nothing is measured: this is an idealised illustration. {SPECTRA_NOTE}</p>
      </>
    )}>
      <p data-testid="s8-text">The detector records <b>each arriving ion as a small electrical signal</b>. Many ions at the same m/z add up to one <b>peak</b>. A bigger peak means <b>more ions</b>, not heavier ions.</p>
      <Readouts items={[
        { id: "n", label: "Ions detected", value: `${k} / ${seq.length}`, tone: "mag" },
        { id: "last", label: "Last ion at m/z", value: last === null ? "–" : String(last), tone: "b0" },
        { id: "tall", label: `Counts at m/z ${SPEC.baseMz}`, value: String(counts[SPEC.baseMz] ?? 0), tone: "rf" },
      ]} />
      <p className="ss-note" data-testid="s8-note">Heavy ions can give small peaks and light ions large ones: height shows abundance only. Representative methane ions, illustrative.</p>
    </MsFrame>
  );
}
