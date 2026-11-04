
// Small legend shared by both tabs: the two shades of an orbital colour are the two signs of the WAVEFUNCTION phase (not electric charges).
// The chip toggles tiny "+" / "-" markers on the lobes of the 3D view.
export default function PhaseLegend({ showPhase, onToggle }) {
  return (
    <div className="hy-legend" data-testid="phase-legend">
      <button type="button" className="hy-legend-btn" aria-pressed={showPhase} onClick={() => onToggle(!showPhase)} title="Mark the + and − wavefunction phase on each lobe" data-testid="opt-phase">
        <i className="pos" aria-hidden="true" /><i className="neg" aria-hidden="true" />
        <span>{"+/−"} wavefunction phase</span>
      </button>
      <span className="hy-legend-long" aria-hidden="true"><i className="sg" />{"σ"} overlap</span>
      <span className="hy-legend-long" aria-hidden="true"><i className="pi" />{"π"} overlap</span>
      <span className="hy-legend-long" aria-hidden="true">Educational shapes (angular part only)</span>
    </div>
  );
}
