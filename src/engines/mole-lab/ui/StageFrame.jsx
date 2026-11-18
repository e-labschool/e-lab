/** Shared stage layout: one compact control row, the large experiment (flex-grows), one concise caption.  Nothing else. */
export default function StageFrame({ stage, title, controls, children, caption, aside, side, sideBelow }) {
  return (
    <section className={"ml-stage-frame" + (side ? " has-side" : "") + (side && sideBelow ? " side-below" : "")} data-testid={`ml-stage-${stage}`} aria-label={title}>
      <h3 className="ml-sr">{title}</h3>
      <div className="ml-controls" data-testid={`ml-controls-${stage}`}>{controls}</div>
      <div className="ml-experiment" data-testid="ml-experiment">{children}{aside}{side && !sideBelow && <aside className="ml-side" data-testid="ml-side" aria-label="Worked calculation">{side}</aside>}</div>
      {side && sideBelow && <aside className="ml-side is-below" data-testid="ml-side" aria-label="Worked calculation">{side}</aside>}
      {caption}
    </section>
  );
}
