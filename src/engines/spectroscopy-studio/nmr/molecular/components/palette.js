// Colour tokens of the molecular stages (the navy / teal / cyan / violet identity of the spectroscopy studio).
export const THEME = {
  bg: "#0a1330", panel: "#0f1d45", panel2: "#14275a", line: "#2a4080", ink: "#e8f0ff", muted: "#a9bbe3", teal: "#2dd4bf", cyan: "#22d3ee", violet: "#a78bfa",
  amber: "#fbbf24", warn: "#ffc65c", ok: "#6ee7a8", bad: "#ff8f8f", gridline: "rgba(169,187,227,0.16)",
};
export const ATOM_COLORS = { H: "#e8eefc", C: "#8a93a8", O: "#ef4a4a" };
export const ATOM_RADIUS = { H: 0.26, C: 0.4, O: 0.38 }; // ball-and-stick radii (angstrom-scaled scene units)
export const VDW_SCALE = 0.62; // fraction of the van der Waals radius used for the electron-density view
export const fmtMHz = (f) => (Number.isInteger(f) ? String(f) : Number(f).toFixed(1));
