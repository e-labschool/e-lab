// Per-state teaching content shared by StateMacroScene, StateParticleScene,
// CompareScene, and the final summary — one source of truth so the wording
// used in the reveal chips stays consistent everywhere it appears.

export const STATE_COLOR = {
  solid: "var(--color-indigo)",
  liquid: "var(--color-teal)",
  gas: "var(--color-block-f)",
};

export const STATE_MACRO = {
  solid: {
    label: "Solid",
    q1: "Does its shape change between containers?",
    r1: "FIXED SHAPE",
    q2: "Does its volume change between containers?",
    r2: "FIXED VOLUME",
  },
  liquid: {
    label: "Liquid",
    q1: "Does its shape change between containers?",
    r1: "NO FIXED SHAPE",
    q2: "Does its volume change between containers?",
    r2: "FIXED VOLUME",
  },
  gas: {
    label: "Gas",
    q1: "Does it take the shape of its container?",
    r1: "NO FIXED SHAPE",
    q2: "Does it fill the whole container, whatever its size?",
    r2: "NO FIXED VOLUME \u2014 FILLS AVAILABLE CONTAINER",
  },
};

export const STATE_PARTICLE = {
  solid: {
    label: "Solid",
    reveals: [
      { label: "Reveal spacing", text: "CLOSELY PACKED" },
      { label: "Reveal motion", text: "VIBRATION ABOUT APPROXIMATELY FIXED POSITIONS" },
      { label: "Reveal interactions", text: "ATTRACTIVE INTERACTIONS HELP MAINTAIN THE CLOSE ARRANGEMENT" },
    ],
    connections: [
      { cause: "Restricted relative movement", effect: "Fixed shape" },
      { cause: "Close spacing", effect: "Fixed volume" },
      { cause: "Little empty space", effect: "Very low compressibility" },
    ],
  },
  liquid: {
    label: "Liquid",
    reveals: [
      { label: "Reveal spacing", text: "CLOSE PARTICLE SPACING" },
      { label: "Reveal arrangement", text: "IRREGULAR ARRANGEMENT" },
      { label: "Reveal motion", text: "PARTICLES MOVE PAST ONE ANOTHER" },
      { label: "Reveal neighbours", text: "PARTICLES CHANGE NEIGHBOURS" },
    ],
    connections: [
      { cause: "Particles remain close", effect: "Fixed volume" },
      { cause: "Particles can rearrange", effect: "Liquid flows" },
      { cause: "Particles move past one another", effect: "Takes shape of container" },
      { cause: "Little empty space", effect: "Low compressibility" },
    ],
  },
  gas: {
    label: "Gas",
    reveals: [
      { label: "Reveal spacing", text: "LARGE PARTICLE SEPARATION" },
      { label: "Reveal motion", text: "RAPID, RANDOM MOTION" },
      { label: "Reveal collisions", text: "PARTICLES COLLIDE WITH EACH OTHER AND THE CONTAINER WALLS" },
      { label: "Reveal speeds", text: "VARIABLE PARTICLE SPEEDS" },
    ],
    connections: [
      { cause: "Large separation", effect: "High compressibility" },
      { cause: "Free translational motion", effect: "No fixed shape" },
      { cause: "Particles move throughout available space", effect: "No fixed volume" },
    ],
    note: "Intermolecular attractions are much less significant relative to particle kinetic behaviour under typical gaseous conditions.",
  },
};

export const SUMMARY_POINTS = {
  solid: ["Close particles", "Restricted positions", "Vibration", "Fixed shape", "Fixed volume", "Very low compressibility"],
  liquid: ["Close particles", "Mobile / change neighbours", "Flows", "Variable shape", "Fixed volume", "Low compressibility"],
  gas: ["Widely separated", "Rapid random motion", "Variable speeds", "Fills container", "Variable shape", "Variable volume", "High compressibility"],
};

export const COMPARE_TABLE = [
  { property: "Particle spacing", solid: "Closely packed", liquid: "Close", gas: "Widely separated" },
  { property: "Arrangement", solid: "Regular", liquid: "Irregular", gas: "Irregular, random" },
  { property: "Motion", solid: "Vibration in place", liquid: "Move past one another", gas: "Rapid, random" },
  { property: "Freedom of movement", solid: "Very restricted", liquid: "Moderate", gas: "Free" },
  { property: "Shape", solid: "Fixed", liquid: "Takes container shape", gas: "Takes container shape" },
  { property: "Volume", solid: "Fixed", liquid: "Fixed", gas: "Variable, fills container" },
  { property: "Compressibility", solid: "Very low", liquid: "Low", gas: "High" },
];
