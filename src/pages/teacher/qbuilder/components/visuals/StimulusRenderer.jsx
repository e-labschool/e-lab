import NuclideNotation from "./NuclideNotation.jsx";
import MassSpectrumChart from "./MassSpectrumChart.jsx";
import BarChart from "./BarChart.jsx";
import AtomDiagram from "./AtomDiagram.jsx";
import StimulusTable from "./StimulusTable.jsx";
import EmissionSpectrum from "./EmissionSpectrum.jsx";
import EnergyLevelDiagram from "./EnergyLevelDiagram.jsx";
import OrbitalShapeDiagram from "./OrbitalShapeDiagram.jsx";
import OrbitalBoxDiagram from "./OrbitalBoxDiagram.jsx";
import IonizationEnergyGraph from "./IonizationEnergyGraph.jsx";
import ProportionalityGraph from "./ProportionalityGraph.jsx";
import GasParticleDiagram from "./GasParticleDiagram.jsx";
import ApparatusDiagram from "./ApparatusDiagram.jsx";
import LewisStructure from "./LewisStructure.jsx";
import VSEPRDiagram from "./VSEPRDiagram.jsx";
import DipoleDiagram from "./DipoleDiagram.jsx";
import IonGridDiagram from "./IonGridDiagram.jsx";
import ElectronTransferDiagram from "./ElectronTransferDiagram.jsx";
import BondingTriangle from "./BondingTriangle.jsx";
import PolymerDiagram from "./PolymerDiagram.jsx";
import SigmaPiDiagram from "./SigmaPiDiagram.jsx";
import Chromatogram from "./Chromatogram.jsx";
import PeriodicTableHighlight from "./PeriodicTableHighlight.jsx";
import ColourWheel from "./ColourWheel.jsx";
import OrganicStructure from "./OrganicStructure.jsx";
import EnantiomerPair from "./EnantiomerPair.jsx";
import IRSpectrumChart from "./IRSpectrumChart.jsx";
import NMRSpectrumChart from "./NMRSpectrumChart.jsx";
import EnergyProfile from "./EnergyProfile.jsx";
import CalorimeterDiagram from "./CalorimeterDiagram.jsx";
import HessCycle from "./HessCycle.jsx";
import BornHaberCycle from "./BornHaberCycle.jsx";
import CarbonCycleDiagram from "./CarbonCycleDiagram.jsx";
import ElectrochemicalCellDiagram from "./ElectrochemicalCellDiagram.jsx";
import MaxwellBoltzmannDistribution from "./MaxwellBoltzmannDistribution.jsx";
import MultistepEnergyProfile from "./MultistepEnergyProfile.jsx";
import BondPolarityDiagram from "./BondPolarityDiagram.jsx";
import LineGraph from "./LineGraph.jsx";
import BondComparison from "./BondComparison.jsx";
import DipoleComparison from "./DipoleComparison.jsx";
import HydrogenBond from "./HydrogenBond.jsx";
import { validateStimulus } from "../../../../../lib/stimulusSchema.js";
import { normalizeStimulus } from "../../../../../lib/normalizeStimulus.js";

// The one place that turns a `stimulus` data object into a rendered
// visual — used identically by the Preview modal, the printed Paper
// Preview, and the Markscheme Preview, so a question's visual is defined
// once and rendered consistently everywhere it appears. Normalization
// happens here, once, at the single entry point every rendering path
// goes through — not scattered across the various places that fetch and
// map a question's visual_data.
export default function StimulusRenderer({ stimulus: rawStimulus, questionId }) {
  const stimulus = normalizeStimulus(rawStimulus);
  if (!stimulus) return null;

  return (
    <div className="flex flex-col gap-2">
      {stimulus.intro && <p className="text-sm text-[var(--color-ink-soft)]">{stimulus.intro}</p>}
      <StimulusBody stimulus={stimulus} questionId={questionId} rawType={typeof rawStimulus === "string" ? "(was a JSON string)" : rawStimulus?.type} />
    </div>
  );
}

function VisualUnavailable() {
  return (
    <p className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-faint)]">
      Visual unavailable
    </p>
  );
}

function StimulusBody({ stimulus, questionId, rawType }) {
  // Central guard — see stimulusSchema.js. Runs before any sub-renderer
  // is reached, for every case in this switch.
  const { valid, missingField } = validateStimulus(stimulus);
  if (!valid) {
    if (import.meta.env.DEV) {
      console.warn(
        `[StimulusRenderer]\nQuestion: ${questionId ?? "unknown"}\nRaw type: ${rawType ?? stimulus.type}\nNormalized type: ${stimulus.type}\nValidation failure — missing/invalid required field: ${missingField}`,
        stimulus
      );
    }
    return <VisualUnavailable />;
  }

  switch (stimulus.type) {
    case "text":
      return null; // intro already rendered above; no separate visual
    case "table":
      return <StimulusTable table={stimulus.table} />;
    case "nuclide":
      return <NuclideNotation nuclides={stimulus.nuclides} />;
    case "mass-spectrum":
      return <MassSpectrumChart xLabel={stimulus.xLabel} yLabel={stimulus.yLabel} peaks={stimulus.peaks} />;
    case "bar-chart":
      return <BarChart xLabel={stimulus.xLabel} yLabel={stimulus.yLabel} bars={stimulus.bars} />;
    case "atom-diagram":
      return <AtomDiagram />;
    case "emission-spectrum":
      return (
        <div className="flex flex-wrap gap-6">
          <EmissionSpectrum lines={stimulus.lines} continuous={stimulus.continuous} label={stimulus.label} />
        </div>
      );
    case "energy-level-diagram":
      return <EnergyLevelDiagram levels={stimulus.levels} transitions={stimulus.transitions} converge={stimulus.converge} />;
    case "orbital-shape":
      return <OrbitalShapeDiagram shapes={stimulus.shapes} />;
    case "orbital-box":
      return <OrbitalBoxDiagram subshells={stimulus.subshells} />;
    case "ionization-graph":
      return <IonizationEnergyGraph points={stimulus.points} xLabel={stimulus.xLabel} yLabel={stimulus.yLabel} logScale={stimulus.logScale} />;
    case "proportionality-graph":
      return <ProportionalityGraph points={stimulus.points} xLabel={stimulus.xLabel} yLabel={stimulus.yLabel} relationship={stimulus.relationship} highlightPoint={stimulus.highlightPoint} />;
    case "gas-particle-diagram":
      return <GasParticleDiagram containers={stimulus.containers} />;
    case "apparatus-diagram":
      return <ApparatusDiagram items={stimulus.items} />;
    case "lewis-structure":
      return <LewisStructure atoms={stimulus.atoms} bonds={stimulus.bonds} overallCharge={stimulus.overallCharge} label={stimulus.label} />;
    case "resonance":
      return (
        <div className="flex flex-wrap items-center gap-3">
          {stimulus.structures.map((s, i) =>
            Array.isArray(s?.atoms) && Array.isArray(s?.bonds) ? (
              <div key={i} className="flex items-center gap-3">
                <LewisStructure atoms={s.atoms} bonds={s.bonds} overallCharge={s.overallCharge} label={s.label} />
                {i < stimulus.structures.length - 1 && <span className="text-lg text-[var(--color-ink-faint)]">&harr;</span>}
              </div>
            ) : null
          )}
        </div>
      );
    case "vsepr":
      return <VSEPRDiagram geometry={stimulus.geometry} centralLabel={stimulus.centralLabel} domains={stimulus.domains} />;
    case "dipole":
      // Two proven modes in the live data — branch on which fields are
      // actually present, per the validated union in stimulusSchema.js.
      // Never mixed: a record either has geometry (molecular mode) or
      // bond + partialCharges (bond-polarity mode).
      return stimulus.geometry != null ? (
        <DipoleDiagram geometry={stimulus.geometry} centralLabel={stimulus.centralLabel} bondLabels={stimulus.bondLabels} netDipole={stimulus.netDipole} />
      ) : (
        <BondPolarityDiagram bond={stimulus.bond} partialCharges={stimulus.partialCharges} />
      );
    case "line-graph":
      return <LineGraph trend={stimulus.trend} xLabel={stimulus.xLabel} yLabel={stimulus.yLabel} context={stimulus.context} extrapolation={stimulus.extrapolation} />;
    case "bond-comparison":
      return <BondComparison bonds={stimulus.bonds} />;
    case "dipole-comparison":
      return <DipoleComparison bonds={stimulus.bonds} />;
    case "hydrogen-bond":
      return <HydrogenBond molecules={stimulus.molecules} showIntermolecular={stimulus.showIntermolecular} showIntramolecular={stimulus.showIntramolecular} />;
    case "ion-grid":
      return <IonGridDiagram mode={stimulus.mode} rows={stimulus.rows} cols={stimulus.cols} variant={stimulus.variant} />;
    case "electron-transfer":
      return <ElectronTransferDiagram from={stimulus.from} to={stimulus.to} />;
    case "bonding-triangle":
      return <BondingTriangle markers={stimulus.markers} />;
    case "polymer":
      return <PolymerDiagram mode={stimulus.mode} monomerText={stimulus.monomerText} repeatingUnitText={stimulus.repeatingUnitText} byproductText={stimulus.byproductText} />;
    case "sigma-pi":
      return <SigmaPiDiagram />;
    case "chromatogram":
      return <Chromatogram baselineToFront={stimulus.baselineToFront} spots={stimulus.spots} />;
    case "periodic-table-highlight":
      return <PeriodicTableHighlight highlights={stimulus.highlights} />;
    case "colour-wheel":
      return <ColourWheel absorbed={stimulus.absorbed} observed={stimulus.observed} />;
    case "organic-structure":
      return <OrganicStructure atoms={stimulus.atoms} bonds={stimulus.bonds} label={stimulus.label} />;
    case "enantiomer-pair":
      return <EnantiomerPair left={stimulus.left} right={stimulus.right} />;
    case "ir-spectrum":
      return <IRSpectrumChart bands={stimulus.bands} />;
    case "nmr-spectrum":
      return <NMRSpectrumChart signals={stimulus.signals} />;
    case "energy-profile":
      return <EnergyProfile reactantsEnergy={stimulus.reactantsEnergy} productsEnergy={stimulus.productsEnergy} hasHump={stimulus.hasHump} humpEnergy={stimulus.humpEnergy} catalysedHumpEnergy={stimulus.catalysedHumpEnergy} label={stimulus.label} />;
    case "calorimeter-diagram":
      return <CalorimeterDiagram labels={stimulus.labels} />;
    case "hess-cycle":
      return <HessCycle nodes={stimulus.nodes} arrows={stimulus.arrows} />;
    case "born-haber-cycle":
      return <BornHaberCycle steps={stimulus.steps} />;
    case "carbon-cycle-diagram":
      return <CarbonCycleDiagram stages={stimulus.stages} />;
    case "electrochemical-cell":
      return <ElectrochemicalCellDiagram mode={stimulus.mode} leftLabel={stimulus.leftLabel} rightLabel={stimulus.rightLabel} leftElectrode={stimulus.leftElectrode} rightElectrode={stimulus.rightElectrode} anodeSide={stimulus.anodeSide} />;
    case "maxwell-boltzmann":
      return <MaxwellBoltzmannDistribution temps={stimulus.temps} ea={stimulus.ea} labels={stimulus.labels} />;
    case "multistep-energy-profile":
      return <MultistepEnergyProfile points={stimulus.points} />;
    case "integrated":
      return (
        <div className="flex flex-col gap-4">
          {stimulus.blocks.map((block, i) => (
            <StimulusBody key={i} stimulus={block} questionId={questionId} />
          ))}
        </div>
      );
    default:
      return null;
  }
}
