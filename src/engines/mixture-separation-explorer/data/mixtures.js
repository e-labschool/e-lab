// The configuration-driven mixture/method data model. Adding a new
// mixture is a data-only change here; the UI (MixtureSelector,
// MethodSelector, InfoPanel) reads this structure generically rather
// than having any mixture hardcoded into its own layout.
//
// Only "sand-water" is populated in this reference-implementation
// phase. Future entries (oil+water, salt+water, milk, ink, etc.) are
// added here once their simulations exist -- this array is exactly
// where they'll go, so no restructuring is needed later.
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
];

export function getMixture(id) {
  return MIXTURES.find((m) => m.id === id) ?? null;
}
