import StepFrame from "../../components/StepFrame.jsx";
import { Badge, Readouts } from "../../components/ui.jsx";
import { useTransition, ease } from "../../components/useAnim.js";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { getModeCatalog } from "../physics/modeCatalog.js";
import { buildOrder, bandFor } from "../physics/gasSpectrum.js";
import MolStage from "../components/MolStage.jsx";
import SpectrumPlot from "../components/SpectrumPlot.jsx";
import { ActivityPill, ChipGroup, fmtWn } from "../components/ui.jsx";
import { IR_STAGES, molOptions, vibOf } from "./common.js";

const SECONDS_PER_MODE = 2.8;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Stage 6: build an IR spectrum. One molecule, one vibration at a time: the vibration, the absorbed radiation and the band that appears are shown together. */
export default function Stage6Build() {
  const a = useIrActions(); const { mol, sel } = useIr((s) => s.s6);
  const cat = getModeCatalog(mol); const seq = buildOrder(cat.modes); const n = seq.length;
  const p = useTransition({ id: `build-${mol}`, target: 1, seconds: n * SECONDS_PER_MODE, from: 0 });
  const finished = p >= 0.999; const idx = finished ? n - 1 : Math.min(n - 1, Math.floor(p * n)); const tau = finished ? 1 : p * n - idx;
  const selMode = sel ? seq.find((m) => m.id === sel) : null;
  const playing = selMode ? null : seq[idx];
  const mode = selMode ?? playing;
  const bandModes = seq.filter((m) => m.active);
  const bands = bandModes.map((m) => { const k = seq.indexOf(m); const grow = finished || k < idx ? 1 : k === idx ? ease(clamp01((tau - 0.3) / 0.5)) : 0; return { ...bandFor(m), grow }; });
  const absorbing = !selMode && !finished && mode.active && tau > 0.08 && tau < 0.95;
  const bump = absorbing ? Math.sin(Math.PI * clamp01((tau - 0.08) / 0.87)) : 0;
  const bandIndex = bandModes.findIndex((m) => m.id === mode.id);
  const lit = { vib: true, abs: mode.active && (selMode || finished ? true : tau > 0.12), band: mode.active && (finished || selMode ? true : tau > 0.45) };
  const viz = (
    <div className="ir-buildview" data-testid="build-view" data-mol={mol} data-progress={p.toFixed(3)} data-mode={mode.id} data-finished={finished ? "1" : "0"} data-bands={bands.filter((b) => b.grow > 0.02).length}>
      <div className="ir-buildmol">
        <MolStage molId={mol} vib={vibOf(mode, `s6-${mol}-${mode.id}`)} gain={1 + 0.9 * bump} glow={bump} testId="mol-stage" arrows />
        <ol className="ir-sync" aria-label="Three linked events" data-testid="sync-trail">
          <li className={lit.vib ? "is-on" : ""} data-testid="sync-vib"><b>1</b> Vibration<span>{mode.label}</span></li>
          <li className={lit.abs ? "is-on" : ""} data-testid="sync-abs"><b>2</b> IR absorbed<span>{mode.active ? `${fmtWn(mode.wn)} cm⁻¹` : "none (IR inactive)"}</span></li>
          <li className={lit.band ? "is-on" : ""} data-testid="sync-band"><b>3</b> Spectrum<span>{mode.active ? "band appears" : "no band"}</span></li>
        </ol>
      </div>
      <div className="ir-buildplot">
        <SpectrumPlot bands={bands} clickable={finished || !!selMode} selected={bandIndex >= 0 ? bandIndex : null} onBandClick={(i) => a.patch("s6", { sel: bandModes[i].id })} hot={bandIndex >= 0 ? [bandIndex] : []} labelAll={finished}
          marker={mode.active ? { nu: mode.wn, color: "#fb923c" } : null} testId="ir-spectrum" ariaLabel={`Schematic infrared spectrum of ${cat.def.name}: transmittance against wavenumber, 4000 to 400 reciprocal centimetres`} curveColor="#7dd3fc" />
        <Badge className="ss-badge--tl ir-plotbadge" testId="build-caption"><b>{cat.def.formula}</b> · schematic gas-phase spectrum</Badge>
      </div>
    </div>
  );
  const strip = (
    <div className="ir-explstrip">
      <div className="ss-controlrow"><span className="ss-stripnote">Molecule</span><ChipGroup label="Molecule" options={molOptions(["h2o", "co2", "hcl", "ch4"])} value={mol} onChange={a.setS6Mol} testId="s6-mol" /></div>
      <div className="ss-controlrow"><span className="ss-stripnote">Vibration</span><ChipGroup label="Vibration" options={seq.map((m) => ({ id: m.id, label: m.label.replace(" (degenerate pair)", ""), sub: `${fmtWn(m.wn)} cm⁻¹`, active: m.active }))} value={mode.id} onChange={(id) => a.patch("s6", { sel: id })} testId="s6-mode" small /></div>
    </div>
  );
  const teacher = (
    <>
      <p><b>One band per IR-active vibration.</b> Each band sits at the vibration's wavenumber; its depth depends on how much the dipole changes (qualitative here); IR-inactive vibrations ({cat.modes.filter((m) => !m.active).map((m) => m.label).join(", ") || "none for this molecule"}) give no band.</p>
      <p><b>Transmittance.</b> T = I/I₀ × 100 %. Where the sample absorbs, less radiation reaches the detector, so T falls and the band points down. The curve is T = 100 × 10<sup>−A</sup>, where the absorbance A of each band is Lorentzian-dominated here; overlapping bands add in absorbance.</p>
      <p><b>Simplifications.</b> Gas-phase bands are really a forest of narrow rotational lines (the rotation of the molecule), not drawn; band depths and widths are illustrative, not from experiment. Degenerate vibrations (CO₂ bend, CH₄ T₂) give one band for the whole set.</p>
    </>
  );
  return (
    <StepFrame step={6} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--irbuild">
      <p data-testid="s6-text" aria-live="polite">
        {mode.active
          ? <>The molecule vibrates as <b>{mode.label.toLowerCase()}</b>. This vibration changes the dipole, so it absorbs IR at <b>{fmtWn(mode.wn)} cm⁻¹</b>: the transmittance dips and a <b>band</b> appears at that wavenumber.</>
          : <>The molecule vibrates as <b>{mode.label.toLowerCase()}</b> at {fmtWn(mode.wn)} cm⁻¹, but the dipole does not change. <b>No IR is absorbed</b>, so no band appears.</>}
      </p>
      <p><ActivityPill active={mode.active} size="sm" testId="s6-activity" /></p>
      <Readouts items={[{ id: "bands", label: "Bands so far", value: `${bands.filter((b) => b.grow > 0.98).length} of ${bands.length}`, tone: "mag" }, { id: "wn", label: "This vibration", value: `${fmtWn(mode.wn)} cm⁻¹`, tone: "b0" }]} />
      <p className="ss-prompt">{finished ? "Click a band (or a vibration) to see it vibrate." : "Watch the three linked steps for each vibration."}</p>
    </StepFrame>
  );
}
