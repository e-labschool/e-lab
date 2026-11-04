// Structure 1.1 — the first e-Lab lesson-sequence implementation, meant to
// become the template for the rest of the curriculum. Content here is
// deliberately data, not JSX: LessonSectionPage.jsx is the ONE template
// that renders every section below, so a future subtopic only needs a
// content file like this one, not a new page component.
//
// Sections without full content yet (shortDescription set, everything
// else omitted) render a clear "full lesson coming soon" state in
// LessonSectionPage rather than a blank or fake page — see that
// component's handling of missing fields.

const structure11 = {
  sections: [
    {
      id: "s1-1-matter",
      title: "Matter",
      shortDescription: "What matter is, and why chemists use models to think about it.",
      simpleExplanation: [
        "Everything around you is made of matter.",
        "The air around you. The water you drink. Your phone. Your desk. Your body.",
        "They may look completely different, but chemistry allows us to think about all of them at a much smaller scale.",
      ],
      analogy: {
        heading: "Think of it like this…",
        body: [
          "Think of a photograph on a screen.",
          "From far away, the picture looks continuous.",
          "Zoom in… and zoom in again… and eventually you begin to notice the tiny pixels that make up the image.",
          "Matter is NOT made of pixels. But this gives us a useful idea: something that looks continuous at our scale can have structure at a much smaller scale.",
        ],
        notice: "Analogy — not a literal representation of matter.",
      },
      visual: {
        type: "zoom-sequence",
        steps: ["Glass of water", "Zoom in…", "Closer view…", "Zoom in again…", "Particle model"],
        observeLabel: "WHAT WE OBSERVE",
        observe: "A glass of water",
        modelLabel: "WHAT OUR MODEL REPRESENTS",
        model: "Particles at a microscopic scale",
      },
      scientificExplanation: {
        heading: "The chemistry",
        body: [
          "Matter is anything that has mass and occupies space.",
          "Chemists use particle models to represent and explain matter at scales that are too small to observe directly in ordinary situations.",
        ],
        modelReminder: "A scientific model is a representation that helps us explain and predict behaviour. It is not necessarily an exact picture of reality.",
      },
      interactive: {
        type: "particle-box",
        title: "Explore Matter",
        options: ["ice", "liquid-water", "water-vapour"],
        afterLabel: "Notice something?",
        after: "The same substance can look and behave very differently depending on its physical state. We'll discover why shortly.",
      },
      checkYourselfId: "s1-1-matter",
      nextLabel: "Elements, Compounds & Mixtures",
      closing: {
        summaryLabel: "Nice start!",
        summary: "You have begun looking at matter at two levels:",
        levels: ["WHAT WE OBSERVE", "HOW WE MODEL IT"],
      },
    },
    {
      id: "s1-1-elements-compounds-mixtures",
      title: "Elements, Compounds & Mixtures",
      shortDescription: "How matter can contain one substance, chemically joined substances, or simply mixed substances.",
      simpleExplanation: [
        "Matter is not all put together in the same way.",
        "Some substances contain only one element.",
        "Some contain atoms of different elements chemically joined together.",
        "Others contain different substances simply mixed together.",
      ],
      analogy: {
        heading: "Think of it like this…",
        body: [
          "Imagine a collection containing only one type of coloured building block, all the same throughout — an ELEMENT.",
          "Now connect two different types of blocks together in the same repeating combination — a COMPOUND.",
          "Now put different blocks together in a container without joining all of them — a MIXTURE.",
        ],
        notice: "Analogy — real elements and compounds involve actual chemical bonds, not connectable blocks.",
      },
      visual: {
        type: "three-way-particles",
        panels: [
          { label: "ELEMENT", description: "Same element type throughout." },
          { label: "COMPOUND", description: "Different element types bonded together in a fixed ratio." },
          { label: "MIXTURE", description: "More than one element and/or compound present, not all chemically bonded into one substance." },
        ],
      },
      scientificExplanation: {
        heading: "The chemistry",
        body: [],
        definitions: [
          {
            term: "Element",
            body: "A primary constituent of matter that cannot be chemically broken down into simpler substances.",
            examples: ["Fe", "Cu", "O\u2082"],
            misconception: {
              question: "Wait… O\u2082 contains two atoms. Why isn't it a compound?",
              answer: "Because both atoms are oxygen. A compound must contain atoms of different elements chemically bonded together.",
            },
          },
          {
            term: "Compound",
            body: "Atoms of different elements chemically bonded together in a fixed ratio.",
            examples: ["H\u2082O — 2 hydrogen atoms : 1 oxygen atom"],
            emphasize: ["Different elements", "Chemically bonded", "Fixed ratio"],
          },
          {
            term: "Mixture",
            body: "More than one element and/or compound in no fixed ratio. Its components are not all chemically bonded into one compound and can therefore be separated by physical methods.",
            emphasize: ["More than one substance", "No fixed ratio", "Physically separable"],
          },
        ],
      },
      interactive: {
        type: "container-build",
        title: "Build Some Matter",
        challenges: ["element", "compound", "mixture"],
      },
      summary: [
        { label: "ELEMENT", value: "One element type" },
        { label: "COMPOUND", value: "Different elements + bonded + fixed ratio" },
        { label: "MIXTURE", value: "Different substances together + no fixed ratio" },
      ],
      checkYourselfId: "s1-1-elements-compounds-mixtures",
      nextLabel: "Homogeneous & Heterogeneous Mixtures",
    },
    {
      id: "s1-1-mixture-types",
      title: "Homogeneous & Heterogeneous Mixtures",
      shortDescription: "Why some mixtures look completely uniform and others clearly don't.",
      heading: "Do all mixtures look the same?",
      simpleExplanation: [
        "Compare salt water and sand + water.",
        "Both are mixtures. But one looks uniform while the other clearly does not.",
      ],
      analogy: {
        heading: "Think of it like this…",
        body: [
          "Think of two drinks. One drink looks completely uniform throughout.",
          "Another contains visible pulp.",
          "Both are mixtures, but their uniformity is different.",
        ],
        notice: "Analogy — real homogeneous/heterogeneous mixtures aren't about drinks specifically.",
      },
      visual: {
        type: "side-by-side",
        panels: [
          { label: "SALT WATER", description: "Uniform appearance." },
          { label: "SAND + WATER", description: "Visible separate material." },
        ],
      },
      scientificExplanation: {
        heading: "The chemistry",
        body: [],
        definitions: [
          { term: "Homogeneous mixture", body: "A mixture with uniform composition throughout the sample.", examples: ["air", "salt solution"] },
          { term: "Heterogeneous mixture", body: "A mixture whose composition is not uniform throughout the sample and may contain different visible regions or phases.", examples: ["sand + water", "oil + water"] },
        ],
      },
      interactive: { type: "mixture-beaker", title: "Mixture Beaker" },
      checkYourselfId: "s1-1-mixture-types",
      nextLabel: "Separating Mixtures",
    },
    {
      id: "s1-1-separation",
      title: "Separating Mixtures",
      shortDescription: "Six physical methods for separating the components of a mixture.",
    },
    {
      id: "s1-1-states",
      title: "Solids, Liquids & Gases",
      shortDescription: "Explaining the three states of matter with the kinetic molecular theory.",
    },
    {
      id: "s1-1-state-changes",
      title: "Changes of State",
      shortDescription: "Melting, freezing, vaporization, condensation, sublimation and deposition.",
    },
    {
      id: "s1-1-temperature-particles",
      title: "Temperature & Particle Motion",
      shortDescription: "What temperature actually measures at the particle level.",
    },
    {
      id: "s1-1-celsius-kelvin",
      title: "Celsius & Kelvin",
      shortDescription: "Converting between the two temperature scales chemists use.",
    },
  ],
  completion: {
    heading: "Structure 1.1 Complete",
    intro: "You can now:",
    outcomes: [
      "distinguish elements, compounds and mixtures",
      "distinguish homogeneous and heterogeneous mixtures",
      "choose appropriate physical separation methods",
      "explain solids, liquids and gases using a particle model",
      "identify changes of state",
      "use state symbols",
      "relate temperature to average kinetic energy",
      "convert between Celsius and Kelvin",
    ],
    nextSubtopicLabel: "Structure 1.2: The Nuclear Atom",
  },
};

export default structure11;
