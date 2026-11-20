// Lesson / URL configuration for the Equilibrium Lab: which mode opens first.
// Stored on a Learn "simulation" block as content.simulationConfig = { initialMode }, and accepted on the standalone route
// as ?mode=everyday | chemical | compare.  The student can always switch modes inside the simulation.
export const CONFIG_MODES = ["everyday", "chemical", "compare"];
export const CONFIG_MODE_LABELS = { everyday: "Everyday Analogy", chemical: "Chemical Model", compare: "Compare Both" };

const ALIASES = { "everyday-analogy": "everyday", analogy: "everyday", "chemical-model": "chemical", chem: "chemical", "compare-both": "compare", both: "compare" };

export function normalizeConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const wanted = typeof cfg.initialMode === "string" ? cfg.initialMode.trim().toLowerCase() : "";
  const mode = ALIASES[wanted] ?? wanted;
  return { initialMode: CONFIG_MODES.includes(mode) ? mode : "everyday" };
}

export function configFromSearch(search) {
  try {
    const q = new URLSearchParams(search || "");
    if (!q.has("mode") && !q.has("initialMode")) return null;
    return normalizeConfig({ initialMode: q.get("mode") ?? q.get("initialMode") });
  } catch { return null; }
}
