import BuilderFlow from "./BuilderFlow.jsx";

// Remounted by the parent (key = species) whenever the element or charge changes, so builder state starts fresh.
export default function StudentFlow({ config }) {
  return <BuilderFlow z={config.element.atomicNumber} charge={config.charge} config={config} />;
}
