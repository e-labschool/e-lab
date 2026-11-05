import { useMemo } from "react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { GROUP_BY_ID, SPEC_GROUPS } from "../physics/functionalGroups.js";
import { ORGANICS, groupStretchMode } from "../data/organics.js";
import MolStage from "../components/MolStage.jsx";
import SpectrumPlot from "../components/SpectrumPlot.jsx";
import { IR_STAGES } from "./common.js";

const EXAMPLE = {
  "oh-alc": "In alcohols the O–H bonds of neighbouring molecules hydrogen-bond, so the O–H stretch is broad and sits low (about 3200–3600).",
  "oh-acid": "Carboxylic acids form strongly hydrogen-bonded pairs, so their O–H band is extremely broad and runs into the C–H region.",
  nh: "A primary amine (–NH₂) shows two sharper bands, from in-phase and out-of-phase N–H stretching.",
  ch: "The sp³ C–H stretches of alkyl groups all fall just below 3000 cm⁻¹.",
  cn: "The C≡N triple bond is stiff, so it absorbs at high wavenumber in an otherwise empty region.",
  cdo: "The very polar C=O bond gives one of the strongest, most useful bands in IR spectra.",
  cdc: "The C=C stretch is weaker than C=O because the bond is much less polar.",
};
const POSITIONS = {
  "oh-alc": "Free O–H (no hydrogen bonding) is sharp, near 3600.", "oh-acid": "Centre near 2900 here; always overlaps the C–H bands.", nh: "Primary amines: two bands, near 3430 and 3350 here.",
  ch: "Alkenes and arenes: C–H just above 3000 (booklet: 2850–3090).", cn: "Nitriles; the booklet's 2100–2260 row is alkynes (C≡C).", cdo: "Ketone ≈ 1715, aldehyde ≈ 1730, ester ≈ 1740, conjugated ≈ 1680.", cdc: "Often several weak bands; conjugation lowers the wavenumber.",
};

/** Stage 7: characteristic absorption ranges. Clicking a row or a band highlights the bond in a demonstration molecule and animates its vibration. */
export default function Stage7Groups() {
  const a = useIrActions(); const sel = useIr((s) => s.s7.group); const g = GROUP_BY_ID[sel];
  const mol = ORGANICS[g.demo];
  const gm = useMemo(() => groupStretchMode(mol, g.id), [mol, g]);
  const wn = g.bands[0].nu;
  const curves = useMemo(() => SPEC_GROUPS.map((x) => ({ id: x.id, label: x.label, bands: x.bands.map((b) => ({ ...b, grow: 1 })), color: x.color, selected: x.id === sel })), [sel]);
  const viz = (
    <div className="ir-buildview ir-groupview" data-testid="groups-view" data-group={sel} data-molecule={g.demo}>
      <div className="ir-buildmol">
        <MolStage molId={g.demo} vib={gm ? { disp: gm.disp, wn, key: `s7-${g.demo}-${g.id}` } : null} highlight={gm?.moving ?? null} testId="mol-stage" arrows={false} label={`${mol.name}, ${g.vib} highlighted`} />
        <Badge className="ss-badge--tl" testId="group-caption"><b>{g.label}</b> · {g.vib} · ≈ {Math.round(wn).toLocaleString("en-US").replace(",", " ")} cm⁻¹<br /><span className="ss-subtitle">in {mol.name} ({mol.condensed})</span></Badge>
      </div>
      <div className="ir-buildplot">
        <SpectrumPlot curves={curves} onCurveClick={(id) => a.patch("s7", { group: id })} range={g.range} rangeLabel={`${g.range[0]}–${g.range[1]}`} testId="ir-spectrum" ariaLabel="Map of the characteristic infrared absorption bands of seven bonds or groups, wavenumber 4000 to 400, transmittance 100 percent at the top" />
        <Badge className="ss-badge--tl ir-plotbadge" testId="map-caption">Representative bands of 7 groups, not one molecule's spectrum</Badge>
      </div>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <span className="ss-stripnote" data-testid="s7-hint">Click a row of the table or a band in the spectrum.</span>
      <span className="ss-stripnote">Simplified localised-group vibration shown (centre of mass fixed, no net rotation).</span>
    </div>
  );
  const teacher = (
    <>
      <p><b>Why these ranges?</b> A bond's stretching wavenumber rises with its stiffness and falls with the masses involved: O–H, N–H and C–H involve light H atoms (high wavenumber); triple bonds are stiffer than double bonds, which are stiffer than single bonds (C≡N &gt; C=O ≈ C=C &gt; C–O).</p>
      <p><b>Environment matters.</b> Hydrogen bonding broadens and lowers O–H; conjugation lowers C=O by 20–40 cm⁻¹; ring strain raises it. Treat each range as a guide: positions depend on the molecular structure and environment. The ranges are the representative values of the specification; the IB data booklet gives close but slightly different ranges (e.g. C=O 1700–1750, acid O–H 2500–3000).</p>
      <p>The animation shows a simplified localised stretch: the atoms of the group move along the bond with mass-weighted amplitudes and the rest of the molecule stays at rest, with centre of mass fixed and no rotation. The real normal modes of a larger molecule mix several motions.</p>
    </>
  );
  return (
    <StepFrame step={7} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--irbuild">
      <div className="ir-tablewrap">
        <table className="ir-table" data-testid="group-table">
          <caption className="ss-sr">Characteristic infrared absorption ranges (representative)</caption>
          <thead className="ss-sr"><tr><th scope="col">Bond or group</th><th scope="col">Range (cm⁻¹)</th></tr></thead>
          <tbody>
            {SPEC_GROUPS.map((x) => (
              <tr key={x.id} className={x.id === sel ? "is-sel" : ""}>
                <th scope="row"><button type="button" className="sim-btn ir-rowbtn" aria-pressed={x.id === sel} onClick={() => a.patch("s7", { group: x.id })} data-testid={`row-${x.id}`}><span className="ir-swatch" style={{ background: x.color }} aria-hidden="true" />{x.label}</button></th>
                <td data-testid={`range-${x.id}`}>{x.range[0]}–{x.range[1]}{x.id === "oh-alc" ? ", broad" : x.id === "oh-acid" ? ", very broad" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ir-groupinfo" data-testid="group-info" aria-live="polite">
        <p><b>{g.label}: {g.vib}</b>, about <b>{wn.toLocaleString("en-US").replace(",", " ")} cm⁻¹</b> in {mol.name}. <span className="ss-subtitle">({g.note})</span></p>
        <p>{EXAMPLE[g.id]} <span className="ss-note">{POSITIONS[g.id]}</span></p>
        <p className="ss-note" data-testid="range-caveat">Representative values. Exact positions depend on molecular structure and environment.</p>
      </div>
    </StepFrame>
  );
}
