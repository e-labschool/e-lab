// Content shown in the compact info panel beside the chamber. Wording
// stays true to the IB DP Chemistry 2025 Structure 1.1 particle model —
// only the presentation changed (one small elegant card instead of five
// separate boxes) as part of the visual rework.
export const STATE_INFO = {
  solid: {
    label: "Solid",
    tagline: "Closely packed \u2022 Ordered",
    movement: "Particles vibrate about fixed positions.",
    attraction: "Strong",
    shape: "Fixed",
    volume: "Fixed",
  },
  liquid: {
    label: "Liquid",
    tagline: "Closely packed \u2022 Disordered",
    movement: "Particles slide past one another, mostly toward the lower chamber.",
    attraction: "Moderate",
    shape: "Not fixed",
    volume: "Fixed",
  },
  gas: {
    label: "Gas",
    tagline: "Widely separated \u2022 Random",
    movement: "Particles move rapidly in all directions, bouncing off the walls.",
    attraction: "Very weak",
    shape: "Not fixed",
    volume: "Not fixed",
  },
};

export const STATE_ORDER = ["solid", "liquid", "gas"];
