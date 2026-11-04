// Shared dark "instrument" palette for the Particle Model Visualizer. The
// whole block (header, selector, chamber, controls, properties panel) uses
// this fixed dark palette rather than the site's light/dark theme tokens —
// same idea as a video player or code sandbox keeping its own chrome so it
// reads as one deliberate instrument, regardless of the page around it.
export const PALETTE = {
  bg: "#0B0E15",
  bgGradient: "radial-gradient(120% 100% at 50% 8%, #182034 0%, #0C0F17 55%, #090B10 100%)",
  panel: "#0F1420",
  panelRaised: "#12161F",
  border: "#232B3D",
  borderStrong: "#2A3244",
  textPrimary: "#E7E9EF",
  textSecondary: "#9BA3B8",
  textFaint: "#5B6478",
  eyebrow: "#7B8298",
};

export const STATE_ACCENT = {
  solid: "#6C86EE",
  liquid: "#3FA9A0",
  gas: "#D97757",
};
