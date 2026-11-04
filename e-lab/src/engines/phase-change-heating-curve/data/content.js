export const STAGE_CAPTION = {
  solidHeat: { label: "Ice", text: "Particles vibrate about fixed positions." },
  melt: {
    label: "Melting",
    text: "Energy is being used to overcome attractions between particles. Temperature remains constant.",
  },
  liquidHeat: { label: "Liquid Water", text: "Particles move past one another." },
  boil: {
    label: "Boiling",
    text: "Energy is being used to overcome attractions between particles. Temperature remains constant.",
  },
  gasHeat: { label: "Water Vapour", text: "Particles move freely and rapidly." },
  done: { label: "Water Vapour", text: "Particles move freely and rapidly." },
};

export const STAGE_STATUS = {
  solidHeat: { label: "Ice heating", energy: "Energy added \u2191", motion: "Particle motion \u2191", temp: "Temperature \u2191" },
  melt: { label: "Melting", energy: "Energy added \u2191", motion: "State changing", temp: "Temperature constant" },
  liquidHeat: { label: "Liquid water heating", energy: "Energy added \u2191", motion: "Particle motion \u2191", temp: "Temperature \u2191" },
  boil: { label: "Boiling", energy: "Energy added \u2191", motion: "State changing", temp: "Temperature constant" },
  gasHeat: { label: "Water vapour heating", energy: "Energy added \u2191", motion: "Particle motion \u2191", temp: "Temperature \u2191" },
  done: { label: "Water vapour heating", energy: "Energy added \u2191", motion: "Particle motion \u2191", temp: "Temperature \u2191" },
};
