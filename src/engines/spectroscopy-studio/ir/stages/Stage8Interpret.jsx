import { useMemo } from "react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { COMPOUNDS, FINGERPRINT_NOTE, INTERPRET_SET, REPRESENTATIVE_NOTE, SOURCES } from "../data/compounds.js";
import { INTERPRET_BY_ID, groupsAt } from "../physics/functionalGroups.js";
import { ORGANICS, groupStretchMode } from "../data/organics.js";
import { FINGERPRINT_BELOW } from "../physics/spectrum.js";
import MolStage from "../components/MolStage.jsx";
import SpectrumPlot from "../components/SpectrumPlot.jsx";
import { ChipGroup, fmtWn } from "../components/ui.jsx";
import { IR_STAGES } from "./common.js";

const NONE = "none";

/** Stage 8: guided interpretation. Click a band, choose which group could cause it, compare with the structure. */
export default function Stage8Interpret() {
  const a = useIrActions(); const { compound, band, pick, fingerprint } = useIr((s) => s.s8);
  const comp = COMPOUNDS[compound]; const mol = ORGANICS[compound];
  const bands = comp.bands; const b = band !== null && bands[band] ? bands[band] : null;
  const truth = b ? (b.group ?? NONE) : null;
  const options = useMemo(() => (b ? [...groupsAt(b.nu).map((g) => g.id), NONE] : []), [b]);
  const answered = b && pick !== null;
  const correct = answered && pick === truth;
  const gm = useMemo(() => (answered && b?.group ? groupStretchMode(mol, b.group) : null), [answered, b, mol]);
  const viz = (
    <div className="ir-buildview ir-interpview" data-testid="interp-view" data-compound={compound} data-band={band ?? ""} data-answered={answered ? "1" : "0"} data-fingerprint={fingerprint ? "1" : "0"}>
      <div className="ir-buildmol">
        <MolStage molId={compound} vib={gm ? { disp: gm.disp, wn: b.nu, key: `s8-${compound}-${b.group}-${band}` } : null} highlight={gm?.moving ?? null} arrows={false} testId="mol-stage" label={`Structure of ${comp.name}`} />
        <Badge className="ss-badge--tl" testId="structure-caption"><b>{comp.name}</b> · {comp.condensed}<br /><span className="ss-subtitle">{answered && gm ? `${INTERPRET_BY_ID[b.group]?.vib ?? "vibration"} highlighted` : "structure"}</span></Badge>
      </div>
      <div className="ir-buildplot">
        <SpectrumPlot bands={bands} clickable selected={band} hot={band !== null ? [band] : []} labelAll={false} onBandClick={(i) => a.selectBand(i)} fingerprint={fingerprint} testId="ir-spectrum"
          ariaLabel={`Representative infrared spectrum of ${comp.name}: transmittance against wavenumber, 4000 to 400 reciprocal centimetres. Click a band to interpret it.`} curveColor="#7dd3fc" />
        <Badge className="ss-badge--tl ir-plotbadge" testId="interp-caption">Representative / idealised, not an experimental spectrum</Badge>
      </div>
    </div>
  );
  const strip = (
    <div className="ir-explstrip">
      <div className="ss-controlrow"><span className="ss-stripnote">Compound</span>
        <ChipGroup label="Compound" options={INTERPRET_SET.map((id) => ({ id, label: COMPOUNDS[id].name }))} value={compound} onChange={a.setS8Compound} testId="s8-compound" small /></div>
      <div className="ss-controlrow">
        <button type="button" className="sim-btn ss-chipbtn" aria-pressed={fingerprint} onClick={() => a.patch("s8", { fingerprint: !fingerprint })} data-testid="fingerprint-toggle">Fingerprint region (below {FINGERPRINT_BELOW.toLocaleString("en-US").replace(",", " ")} cm⁻¹): {fingerprint ? "shown" : "hidden"}</button>
        <span className="ss-stripnote">Click a band in the spectrum.</span>
      </div>
    </div>
  );
  const teacher = (
    <>
      <p><b>Fingerprint region.</b> {FINGERPRINT_NOTE} Two different compounds can share a functional-group band (both ethanal and propanone have C=O), so one band never identifies a compound on its own: use all the bands, and compare the fingerprint region with a reference spectrum.</p>
      <p><b>Ethanol shows an O–H band that overlaps the N–H range (3300–3500).</b> The shape tells them apart: hydrogen-bonded O–H is broad and strong, N–H is narrower and weaker. A propanone band at 1220 cm⁻¹ falls inside the C–O range but there is no C–O bond: it is a skeletal C–C(=O)–C vibration, another reason not to assign the fingerprint region band by band.</p>
      <p><b>Sources.</b> {REPRESENTATIVE_NOTE} Ranges: {SOURCES.IB}. Typical liquid-film band positions: {SOURCES.TXT}. Widths and intensities are chosen by the author for teaching.</p>
    </>
  );
  return (
    <StepFrame step={8} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--irbuild">
      {!b && <p data-testid="s8-text">Click any band of the <b>{comp.name}</b> spectrum. Which functional group could make it?</p>}
      {b && (
        <div data-testid="s8-band-info" aria-live="polite">
          <p data-testid="s8-text">Band at <b>{fmtWn(b.nu)} cm⁻¹</b>, {widthWord(b)}. Which group could cause it?</p>
          <div className="ir-picks" role="group" aria-label="Possible groups" data-testid="s8-picks">
            {options.map((id) => (
              <button key={id} type="button" className={`sim-btn ss-chipbtn ir-pick${pick === id ? " is-picked" : ""}`} aria-pressed={pick === id} onClick={() => a.patch("s8", { pick: id })} data-testid={`pick-${id}`}>
                {id === NONE ? "None of these (fingerprint)" : `${INTERPRET_BY_ID[id].label}  ${INTERPRET_BY_ID[id].range[0]}–${INTERPRET_BY_ID[id].range[1]}`}
              </button>
            ))}
          </div>
          {answered && (
            <div className={`ir-feedback ${correct ? "is-ok" : "is-no"}`} data-testid="s8-feedback" data-correct={correct ? "1" : "0"}>
              <p><b>{correct ? "Yes." : "Not quite."}</b> {explain(b, truth, pick, compound)}</p>
              <p className="ss-note">Assignment: {b.assign}. <span title={b.src.map((k) => SOURCES[k]).join("; ")}>Source: {b.src.map((k) => (k === "IB" ? "IB data booklet range" : "textbook value")).join(" + ")}.</span></p>
            </div>
          )}
        </div>
      )}
      <p className="ss-note" data-testid="s8-caveat">{fingerprint ? FINGERPRINT_NOTE : "No single band identifies a compound: combine the evidence from several bands."}</p>
    </StepFrame>
  );
}

function widthWord(b) { return b.fwhm >= 400 ? "very broad" : b.fwhm >= 150 ? "broad" : b.A >= 0.9 ? "strong and sharp" : b.A >= 0.4 ? "medium" : "weak"; }

function explain(b, truth, pick, compound) {
  const name = (id) => INTERPRET_BY_ID[id]?.label ?? id;
  if (truth === NONE) {
    if (pick === NONE) return `It is a ${b.fingerprint ? "fingerprint-region" : "non-characteristic"} band (${b.assign}); it is not used to find a functional group.`;
    return `${name(pick)} absorbs in this range in general, but ${COMPOUNDS[compound].name} has no such bond here: this band is ${b.assign}.`;
  }
  if (pick === truth) return `${name(truth)} (${b.assign}).`;
  if (pick === NONE) return `This band is characteristic: it is ${name(truth)} (${b.assign}).`;
  return `${name(pick)} also absorbs near here, but this band is ${name(truth)} (${b.assign}). Use the width and strength of the band, and the other bands, to decide.`;
}
