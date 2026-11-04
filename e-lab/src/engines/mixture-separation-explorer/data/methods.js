// Per-method metadata: label, the physical property it exploits
// (stored explicitly so it can later feed exam-question generation),
// and the four-tab info-panel content. Only methods with a real
// simulation component in simulationRegistry.js are ever selectable --
// see MethodSelector.jsx.
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
  sedimentationDecantation: {
    id: "sedimentationDecantation",
    label: "Sedimentation & Decantation",
    principle: "Density / settling behaviour",
    info: {
      about: "A suspension is left to stand so the denser suspended particles settle to the bottom under gravity, then the clearer liquid above is carefully poured off.",
      keyIdea: "Suspended particles are denser than the liquid, so they settle out over time under gravity; the clear liquid above (the supernatant) can then be decanted.",
      result: [
        { label: "Sediment", value: "settled solid" },
        { label: "Supernatant", value: "clearer liquid" },
      ],
      examTip: "Ordinary filtration can also retain these relatively large suspended particles \u2014 sedimentation and decantation is a simpler alternative when a fine filter isn't needed.",
    },
  },
  separatingFunnel: {
    id: "separatingFunnel",
    label: "Separating Funnel",
    principle: "Immiscibility + difference in density",
    info: {
      about: "A separating funnel is used to separate two immiscible liquids that form distinct layers. The denser liquid is drained from the bottom via a stopcock.",
      keyIdea: "The two liquids do not mix (immiscible) and have different densities, so they settle into two distinct layers that can be drained one at a time.",
      result: [
        { label: "Lower layer", value: "water (denser)" },
        { label: "Upper layer", value: "oil (less dense)" },
      ],
      examTip: "The stopcock is closed the moment the interface between the two layers reaches it \u2014 stopping too late lets some of the upper layer through too.",
    },
  },
  magneticSeparation: {
    id: "magneticSeparation",
    label: "Magnetic Separation",
    principle: "Magnetic properties",
    info: {
      about: "A magnet is used to separate a magnetic solid from a mixture of solids. The magnetic component is attracted to the magnet; the rest is left behind.",
      keyIdea: "Only materials with magnetic properties (such as iron) are attracted to the magnet \u2014 this has nothing to do with particle size or density.",
      result: [
        { label: "Attracted", value: "iron filings" },
        { label: "Left behind", value: "sand" },
      ],
      examTip: "Magnetic separation only works when exactly one component of the mixture is magnetic.",
    },
  },
  sieving: {
    id: "sieving",
    label: "Sieving",
    principle: "Particle size",
    info: {
      about: "Sieving separates solids of different particle sizes using a mesh with holes of a particular size. Smaller particles pass through; larger particles are retained.",
      keyIdea: "The mesh holes are larger than the small particles but smaller than the large particles, so only the small particles can pass through.",
      result: [
        { label: "Passes through", value: "smaller particles" },
        { label: "Retained", value: "larger particles" },
      ],
      examTip: "Sieving separates by size alone \u2014 it does not depend on solubility, density, or magnetic properties.",
    },
  },
};
