// Content shown in the properties panel beside the chamber. Wording stays
// true to the IB DP Chemistry 2025 Structure 1.1 particle model.
export const STATE_INFO = {
  solid: {
    label: "Solid",
    tagline: "Closely packed \u2022 Ordered \u2022 Fixed positions",
    properties: [
      "Fixed volume",
      "Fixed shape",
      "Very difficult to compress",
      "Stronger attractive forces keep particles closely packed",
      "Particles vibrate about fixed positions",
    ],
  },
  liquid: {
    label: "Liquid",
    tagline: "Closely packed \u2022 Disordered \u2022 Free to move",
    properties: [
      "Fixed volume",
      "No fixed shape \u2014 takes the shape of the part of the container it occupies",
      "Very difficult to compress",
      "Attractive forces between particles are weaker than in solids",
      "Particles vibrate, rotate and move past one another",
    ],
  },
  gas: {
    label: "Gas",
    tagline: "Widely spaced \u2022 Random \u2022 Rapid motion",
    properties: [
      "No fixed volume \u2014 expands to occupy the available space",
      "No fixed shape",
      "Can be compressed",
      "Attractive forces between particles are negligible in the idealized model",
      "Particles vibrate, rotate and move freely and rapidly",
    ],
  },
};

export const STATE_ORDER = ["solid", "liquid", "gas"];
