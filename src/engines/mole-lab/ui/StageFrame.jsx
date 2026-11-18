/** Shared stage layout: one compact control row, the large experiment (flex-grows), one concise caption.  Nothing else. */
export default function StageFrame({ stage, title, controls, children, caption, aside }) {
  return (
    <section className="ml-stage-frame" data-testid={`ml-stage-${stage}`} aria-label={title}>
      <h3 className="ml-sr">{title}</h3>
      <div className="ml-controls" data-testid={`ml-controls-${stage}`}>{controls}</div>
      <div className="ml-experiment" data-testid="ml-experiment">{children}{aside}</div>
      {caption}
    </section>
  );
}
