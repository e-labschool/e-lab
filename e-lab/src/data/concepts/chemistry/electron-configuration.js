// Layer 1 — core concepts for the "electron-configuration" domain.
// These concepts are curriculum-independent: no syllabus code appears anywhere below.
// Curriculum-specific placement lives only in src/data/curricula.

const electronConfigurationConcepts = [
  {
    id: "emission-spectra",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Emission Spectra",
    description: "Discrete lines of light produced when excited electrons fall to lower energy levels.",
    relatedConcepts: ["discrete-energy-levels"],
  },
  {
    id: "discrete-energy-levels",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Discrete Energy Levels",
    description: "Evidence that electrons occupy fixed, quantized energy levels rather than a continuous range.",
    relatedConcepts: ["emission-spectra","electron-shells"],
  },
  {
    id: "electron-shells",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Electron Shells",
    description: "Principal energy levels that hold a limited, predictable number of electrons.",
    relatedConcepts: ["discrete-energy-levels","electron-subshells"],
  },
  {
    id: "electron-subshells",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Electron Subshells",
    description: "Divisions within a shell (s, p, d, f) with distinct shapes and electron capacities.",
    relatedConcepts: ["electron-shells","atomic-orbitals"],
  },
  {
    id: "atomic-orbitals",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Atomic Orbitals",
    description: "Regions of space where an electron is likely to be found, each holding at most two electrons.",
    relatedConcepts: ["electron-subshells","pauli-exclusion-principle"],
  },
  {
    id: "aufbau-principle",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Aufbau Principle",
    description: "The rule that electrons occupy the lowest-energy available orbitals first.",
    relatedConcepts: ["electron-configuration","hunds-rule"],
  },
  {
    id: "hunds-rule",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Hund's Rule",
    description: "Electrons fill degenerate orbitals singly, with parallel spin, before pairing up.",
    relatedConcepts: ["atomic-orbitals","aufbau-principle"],
  },
  {
    id: "pauli-exclusion-principle",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Pauli Exclusion Principle",
    description: "No two electrons in an atom can share an identical set of quantum numbers, limiting orbitals to two electrons of opposite spin.",
    relatedConcepts: ["atomic-orbitals"],
  },
  {
    id: "electron-configuration",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Electron Configuration",
    description: "The full distribution of an atom's electrons among shells and subshells in its ground state.",
    relatedConcepts: ["aufbau-principle","hunds-rule","pauli-exclusion-principle","periodic-table-organization"],
  },
  {
    id: "ion-electron-configuration",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Ion Electron Configuration",
    description: "How electron configuration changes when atoms gain or lose electrons to form ions.",
    relatedConcepts: ["electron-configuration","ion-formation"],
  },
  {
    id: "ionization-energy",
    subject: "chemistry",
    domain: "electron-configuration",
    title: "Ionization Energy",
    description: "The energy required to remove an electron from a gaseous atom or ion, and what it reveals about atomic structure.",
    relatedConcepts: ["electron-configuration","periodic-trends-ionization-energy"],
  },
];

export default electronConfigurationConcepts;
