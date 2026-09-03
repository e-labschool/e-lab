import NuclideNotation from "./NuclideNotation.jsx";
import MassSpectrumChart from "./MassSpectrumChart.jsx";
import BarChart from "./BarChart.jsx";
import AtomDiagram from "./AtomDiagram.jsx";
import StimulusTable from "./StimulusTable.jsx";

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
