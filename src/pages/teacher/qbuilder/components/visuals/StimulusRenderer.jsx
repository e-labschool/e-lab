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

// The one place that turns a `stimulus` data object into a rendered
// visual — used identically by the Preview modal, the printed Paper
// Preview, and the Markscheme Preview, so a question's visual is defined
// once and rendered consistently everywhere it appears.
export default function StimulusRenderer({ stimulus }) {
  if (!stimulus) return null;

  return (
    <div className="flex flex-col gap-2">
      {stimulus.intro && <p className="text-sm text-[var(--color-ink-soft)]">{stimulus.intro}</p>}
      <StimulusBody stimulus={stimulus} />
    </div>
  );
}

function StimulusBody({ stimulus }) {
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
          {stimulus.structures.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <LewisStructure atoms={s.atoms} bonds={s.bonds} overallCharge={s.overallCharge} label={s.label} />
              {i < stimulus.structures.length - 1 && <span className="text-lg text-[var(--color-ink-faint)]">&harr;</span>}
            </div>
          ))}
        </div>
      );
    case "vsepr":
      return <VSEPRDiagram geometry={stimulus.geometry} centralLabel={stimulus.centralLabel} domains={stimulus.domains} />;
    case "dipole":
      return <DipoleDiagram geometry={stimulus.geometry} centralLabel={stimulus.centralLabel} bondLabels={stimulus.bondLabels} netDipole={stimulus.netDipole} />;
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
    case "integrated":
      return (
        <div className="flex flex-col gap-4">
          {stimulus.blocks.map((block, i) => (
            <StimulusBody key={i} stimulus={block} />
          ))}
        </div>
      );
    default:
      return null;
  }
}
