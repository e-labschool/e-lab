// The configuration-driven mixture/method data model. Adding a new
// mixture is a data-only change here; the UI (MixtureSelector,
// MethodSelector, InfoPanel) reads this structure generically rather
// than having any mixture hardcoded into its own layout.
export const MIXTURES = [
  {
    id: "sand-water",
    name: "Sand and Water",
    category: "heterogeneous",
    subtype: "insoluble-solid-liquid",
    description: "Insoluble solid + liquid",
    methods: [
      { methodId: "filtration", purpose: "Recover the insoluble solid and the liquid" },
    ],
  },
  {
    id: "muddy-water",
    name: "Muddy Water",
    category: "heterogeneous",
    subtype: "suspension",
    description: "Suspension",
    methods: [
      { methodId: "filtration", purpose: "Retain the suspended particles on filter paper" },
      { methodId: "sedimentationDecantation", purpose: "Let particles settle, then pour off the clear liquid" },
    ],
  },
  {
    id: "oil-water",
    name: "Oil and Water",
    category: "heterogeneous",
    subtype: "immiscible-liquids",
    description: "Immiscible liquids",
    methods: [
      { methodId: "separatingFunnel", purpose: "Drain the denser layer, then keep the other" },
    ],
  },
  {
    id: "iron-sand",
    name: "Iron Filings and Sand",
    category: "heterogeneous",
    subtype: "solid-solid",
    description: "Solid + solid (magnetic)",
    methods: [
      { methodId: "magneticSeparation", purpose: "Attract the magnetic component, leaving the rest" },
    ],
  },
  {
    id: "mixed-particle-sizes",
    name: "Mixed Particle Sizes",
    category: "heterogeneous",
    subtype: "solid-solid",
    description: "Solid + solid (different sizes)",
    methods: [
      { methodId: "sieving", purpose: "Let smaller particles pass through, retain the larger ones" },
    ],
  },
];

export function getMixture(id) {
  return MIXTURES.find((m) => m.id === id) ?? null;
}
