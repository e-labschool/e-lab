// Lesson configuration for the Bonding Visualizer: initial mode and optionally restricted modes.
// Stored on a Learn "simulation" block as content.simulationConfig = { initialMode, allowedModes }.
export const MODES = ["ionic", "covalent", "metallic"];
export const MODE_LABELS = { ionic: "Ionic Bonding", covalent: "Covalent Bonding", metallic: "Metallic Bonding" };

const asList = (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []);

/** Always returns a usable config: allowed modes in canonical order (never empty), initial mode inside it. */
export function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const wanted = asList(cfg.allowedModes).map((m) => String(m).trim().toLowerCase());
  let allowed = MODES.filter((m) => wanted.includes(m));
  if (allowed.length === 0) allowed = [...MODES];
  const initial = typeof cfg.initialMode === "string" ? cfg.initialMode.trim().toLowerCase() : "";
  return { allowedModes: allowed, initialMode: allowed.includes(initial) ? initial : allowed[0] };
}

/** ?mode=covalent&modes=ionic,covalent (used by the standalone /simulation route and for previews). */
export function configFromSearch(search) {
  try {
    const q = new URLSearchParams(search || "");
    if (!q.has("mode") && !q.has("modes")) return null;
    return normalizeConfig({ initialMode: q.get("mode"), allowedModes: q.get("modes") });
  } catch {
    return null;
  }
}
