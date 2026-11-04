import SimulationDashboard, { DashPanel, ExplainLine, LiveStrip, ToolButton } from "../../../components/simulation/SimulationDashboard.jsx";

/** One tool button of the bottom controls (shared look with the other e-Lab dashboards). */
export function Tool({ icon, label, title, primary, disabled, onClick, testId, pressed }) {
  return <ToolButton icon={icon} label={label} title={title ?? label} primary={primary} disabled={disabled} onClick={onClick} testId={testId} pressed={pressed} />;
}

export function Toolbar({ children, label = "Bonding controls" }) {
  return <div className="bv-toolbar" role="toolbar" aria-label={label} data-testid="bv-toolbar">{children}</div>;
}

/**
 * The common frame of every bonding mode: shared header (title, mode tabs, Reset, New Tab / Full Screen),
 * element library at the left, a large white canvas with the mode controls at the bottom, a live-value strip and
 * ONE explanation line. Layout comes from the shared Simulation Dashboard Layout.
 */
export default function ModeShell({ mode, tabs, onReset, library, options, canvas, toolbar, live, explain, details, state }) {
  return (
    <SimulationDashboard
      title="Bonding Visualizer"
      subtitle="How electrons bond atoms"
      role="region"
      ariaLabel="Bonding visualizer"
      testId="bonding-workspace"
      tabs={tabs}
      onReset={onReset}
      controls={library}
      chamber={(
        <DashPanel grow noBody ariaLabel="Bonding canvas" className="bv-panel" testId="bv-panel">
          <div className="bv-chamber" data-mode={mode} data-state={state}>
            {options}
            {canvas}
            {toolbar}
          </div>
        </DashPanel>
      )}
      live={<LiveStrip items={live} ariaLabel="Bonding facts" />}
      explain={<ExplainLine text={explain} details={details} testId="bv-explain" />}
    />
  );
}
