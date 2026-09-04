import { useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import MoleculeViewer3D from "../../components/3d/MoleculeViewer3D.jsx";
import { GEOMETRY_LIBRARY } from "../../lib/vsepr-3d-geometries.js";

// Real chemistry examples for each geometry — central atom label + the
// labels shown on each bonded domain (lone-pair domains render as the
// conventional two-dot marker automatically, never as a fake atom).
const EXAMPLES = {
  linear: { centralLabel: "C", bondLabels: ["O", "O"], formula: "CO₂" },
  bent: { centralLabel: "O", bondLabels: ["H", "H"], formula: "H₂O" },
  "trigonal-planar": { centralLabel: "B", bondLabels: ["F", "F", "F"], formula: "BF₃" },
  "trigonal-pyramidal": { centralLabel: "N", bondLabels: ["H", "H", "H"], formula: "NH₃" },
  tetrahedral: { centralLabel: "C", bondLabels: ["H", "H", "H", "H"], formula: "CH₄" },
  "trigonal-bipyramidal": { centralLabel: "P", bondLabels: ["Cl", "Cl", "Cl", "Cl", "Cl"], formula: "PCl₅" },
  octahedral: { centralLabel: "S", bondLabels: ["F", "F", "F", "F", "F", "F"], formula: "SF₆" },
};

const GEOMETRY_IDS = Object.keys(GEOMETRY_LIBRARY);

// The mode-agnostic orchestrator, reachable from /interactives directly and
// from any concept page that links vsepr-theory / molecular-geometry via
// the resource registry — same pattern as every other e-Lab engine.
export default function VSEPRExplorer3D({ compact = false }) {
  const [geometry, setGeometry] = useState("tetrahedral");
  const example = EXAMPLES[geometry];

  const body = (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {GEOMETRY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setGeometry(id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              geometry === id
                ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            }`}
          >
            {GEOMETRY_LIBRARY[id].label}
          </button>
        ))}
      </div>

      <MoleculeViewer3D geometry={geometry} centralLabel={example.centralLabel} bondLabels={example.bondLabels} height={compact ? 300 : 400} />

      <p className="text-sm text-[var(--color-ink-soft)]">
        Example: <strong className="text-[var(--color-ink)]">{example.formula}</strong> — {GEOMETRY_LIBRARY[geometry].label.toLowerCase()} geometry.
        {GEOMETRY_LIBRARY[geometry].domainCount > GEOMETRY_LIBRARY[geometry].bondDomains && (
          <> Amber dot pairs mark lone-pair domains, which occupy electron-domain positions but aren't bonded atoms.</>
        )}
      </p>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame title="VSEPR Explorer (3D)" subtitle="Rotate real molecular geometries and see how electron domains — bonds and lone pairs — determine shape.">
      {body}
    </InteractiveFrame>
  );
}
