// Per-method metadata: label, the physical property it exploits
// (stored explicitly so it can later feed exam-question generation, per
// the brief), and the four-tab info-panel content. Only "filtration" is
// populated in this reference-implementation phase; the remaining
// method ids referenced by MixtureSeparationExplorer.jsx's method
// selector are added here as each one is actually built, never as
// placeholder/fake entries a student could click.
export const METHODS = {
  filtration: {
    id: "filtration",
    label: "Filtration",
    principle: "Particle size / insolubility",
    info: {
      about: "Filtration is used to separate an insoluble solid from a liquid. The liquid passes through the filter paper while the insoluble solid remains behind.",
      keyIdea: "Filtration works because the insoluble solid particles are too large to pass through the pores of the filter paper, while the liquid can pass through.",
      result: [
        { label: "Residue", value: "sand" },
        { label: "Filtrate", value: "water" },
      ],
      examTip: "Students should know and correctly use the terms residue and filtrate.",
    },
  },
};
