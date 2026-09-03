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
