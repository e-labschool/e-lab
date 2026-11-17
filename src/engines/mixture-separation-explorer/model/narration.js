// Pure helpers for the UI: the one-line "what is happening" text, the live-value strip, default controls, and the
// seeded shuffle of set-up options (so the right answer is not always the first one). No React, no DOM.
import { SUBSTANCES } from "./chem.js";
import { getMethod } from "./methods.js";
import { makeRng } from "../../../lib/particles/particleCore.js";

const pct = (x) => `${Math.round(Math.min(1, Math.max(0, x)) * 100)} %`;
const deg = (T) => `${Math.round(T)} °C`;
export function fmtLab(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Live values the student can change, per method. Returned object is the initial `ctl` for the run. */
export function controlDefaults(methodId) {
  switch (methodId) {
    case "dissolve": return { stir: true };
    case "filtration": return { pour: 0.5 };
    case "decanting": return { pour: 0.3, tilt: false };
    case "evaporation": return { heat: 0.5 };
    case "crystallisation": return { heat: 0.5, stop: false };
    case "simple-distillation": case "fractional-distillation": return { heat: 0.7 };
    case "separating-funnel": return { tap: 0 };
    case "sublimation": return { heat: 0.1 };
    default: return {};
  }
}

/** Deterministic hash of a string to a positive integer. */
export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; }

/** The options of set-up step `index` of `methodId`, in a fixed but scrambled order. */
export function shuffledOptions(methodId, index) {
  const step = getMethod(methodId).setup[index];
  if (!step) return [];
  const rng = makeRng(hashString(`${methodId}:${index}`));
  const a = [...step.options];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Which volatile liquid is distilling at the head right now (closest boiling point to the thermometer), or null. */
export function distillingNow(sample, Thead) {
  const liquids = sample.parts.filter((p) => p.form === "liquid" && !SUBSTANCES[p.sub].nonvolatile);
  if (!liquids.length || !(Thead > 30)) return null;
  return [...liquids].sort((a, b) => Math.abs(SUBSTANCES[a.sub].bp - Thead) - Math.abs(SUBSTANCES[b.sub].bp - Thead))[0].sub;
}

/** One sentence describing the current moment of a run (shown under the apparatus, announced politely to screen readers). */
export function narrate(methodId, view = {}, ctl = {}, sample, stage = "run") {
  if (stage === "done") return "Finished. Read the results panel, then try a different method or mixture.";
  switch (methodId) {
    case "dissolve": return view.progress < 0.02 ? "Water is added; stir to help the solid dissolve." : `${pct(view.progress)} dissolved: water molecules pull ions out of the solid.`;
    case "decanting":
      if (view.mode === "none") return "Nothing settles out of this mixture, so there is nothing to pour off separately.";
      if (view.settle < 0.95) return `Standing: ${view.mode === "layers" ? "the layers are forming" : "the sand is settling"} (${pct(view.settle)}). Wait before pouring.`;
      return ctl.tilt ? `Pouring the top liquid off slowly (${pct(view.pouredFrac ?? 0)} poured).` : "Settled. Tilt the beaker gently and pour the top liquid off.";
    case "filtration":
      if (view.overflow) return "The liquid is pouring too fast and flowing over the paper, so unfiltered liquid reaches the filtrate.";
      return view.V === 0 ? "A dry solid cannot be filtered: it just sits on the paper." : (view.poured ?? 0) < 0.02 ? "Pour the mixture slowly down a glass rod into the filter paper." : "The filtrate drips through; anything larger than the pores stays on the paper as the residue.";
    case "evaporation": case "crystallisation":
      if (view.flash) return "The vapour has caught fire: flammable liquids must never be heated with a flame.";
      if (view.phase === "cool") return "Heating has stopped. As the solution cools, solubility falls and crystals grow.";
      if (methodId === "crystallisation" && view.rod) return "Crystals form on the cold glass rod: the solution is saturated. Stop heating and let it cool.";
      if ((view.liquid ?? 1) < 0.12) return "Nearly dry: lower the flame to stop spitting.";
      return view.boiling ? `Boiling at ${deg(view.T)}: the solvent leaves as vapour; non-volatile solids stay in the basin.` : `Heating (${deg(view.T)}): the liquid warms towards its boiling point.`;
    case "simple-distillation": case "fractional-distillation": {
      const now = distillingNow(sample, view.Thead);
      if (!view.boiling) return `Heating the flask (${deg(view.Tpot ?? 20)}). The head thermometer reads ${deg(view.Thead ?? 20)} until vapour reaches it.`;
      return `Head thermometer ${deg(view.Thead)}${now ? ` (near the boiling point of ${SUBSTANCES[now].name.toLowerCase().split(" ")[0]}, ${deg(SUBSTANCES[now].bp)})` : ""}. Flask ${view.receiver + 1} is collecting the distillate.`;
    }
    case "chromatography": return (view.frontDist ?? 0) < 0.05 ? "The paper dips into the solvent below the baseline. Start the run." : `The solvent front has risen ${(view.frontDist ?? 0).toFixed(1)} cm, carrying soluble dyes at different speeds.`;
    case "magnetic": return view.sweeping ? "The magnet sweeps over the mixture: only the iron jumps up to it." : view.passes ? `${view.passes} pass${view.passes === 1 ? "" : "es"} done (${pct(view.collected ?? 0)} of the magnetic solid collected).` : "Pass the magnet over the mixture. Each pass collects more of the magnetic solid.";
    case "separating-funnel": return view.two === false ? "Only one liquid layer here, so the funnel cannot separate anything." : (view.drained ?? 0) < 0.1 ? "The denser layer sits at the bottom. Open the tap slowly." : "Close the tap as soon as the boundary reaches it, before the upper layer drains.";
    case "sublimation": return view.melted ? "Too hot: iodine is melting and vapour escapes. Lower the flame." : view.vapour > 0 ? "Purple iodine vapour rises and turns straight back into dark crystals on the cold funnel." : "Warm the dish gently. Watch which solid turns to vapour without melting.";
    default: return "";
  }
}

/** Live-value chips for the bottom strip. Each: { id, label, value, bg, testId }. */
export function liveItems(methodId, stage, run, sample, ctl = {}) {
  const v = run?.view ?? {};
  const t = run ? fmtLab(run.t * run.pace) : "0:00";
  const base = [{ id: "time", label: "Time", value: t, bg: "#eef2ff", testId: "live-time" }];
  switch (methodId) {
    case "simple-distillation": case "fractional-distillation": {
      const ml = (v.receiverMl ?? []).reduce((a, b) => a + b, 0);
      return [{ id: "head", label: "Head thermometer", value: deg(v.Thead ?? 20), bg: "#e0f2fe", testId: "live-head" }, { id: "flask", label: "Flask", value: deg(v.Tpot ?? 20), bg: "#ffedd5", testId: "live-flask" }, { id: "col", label: "Collected", value: `${ml.toFixed(0)} mL`, bg: "#dcfce7", testId: "live-collected" }, ...base];
    }
    case "evaporation": case "crystallisation": case "sublimation":
      return [{ id: "T", label: "Temperature", value: deg(v.T ?? 20), bg: "#ffedd5", testId: "live-T" }, { id: "flame", label: "Flame", value: pct(ctl.heat ?? 0), bg: "#fef9c3", testId: "live-flame" }, methodId === "sublimation" ? { id: "subl", label: "Crystals on funnel", value: `${(v.sublimed ?? 0).toFixed(2)} g`, bg: "#ede9fe", testId: "live-subl" } : { id: "liq", label: "Liquid left", value: pct(v.liquid ?? 1), bg: "#dcfce7", testId: "live-liquid" }, ...base];
    case "filtration": return [{ id: "poured", label: "Poured", value: v.V ? pct((v.poured ?? 0) / v.V) : pct(v.poured ?? 0), bg: "#e0f2fe", testId: "live-poured" }, { id: "cake", label: "Residue", value: pct(v.cake ?? 0), bg: "#fef3c7", testId: "live-residue" }, ...base];
    case "decanting": return [{ id: "settle", label: "Settled", value: pct(v.settle ?? 0), bg: "#fef3c7", testId: "live-settled" }, { id: "pour", label: "Poured off", value: pct(v.pouredFrac ?? 0), bg: "#e0f2fe", testId: "live-poured" }, ...base];
    case "chromatography": return [{ id: "front", label: "Solvent front", value: `${(v.frontDist ?? 0).toFixed(1)} cm`, bg: "#e0f2fe", testId: "live-front" }, ...base];
    case "magnetic": return [{ id: "passes", label: "Passes", value: `${v.passes ?? 0}`, bg: "#e0f2fe", testId: "live-passes" }, { id: "col", label: "Collected", value: pct(v.collected ?? 0), bg: "#dcfce7", testId: "live-collected" }, ...base];
    case "separating-funnel": return [{ id: "dr", label: "Drained", value: `${(v.drained ?? 0).toFixed(0)} g`, bg: "#e0f2fe", testId: "live-drained" }, { id: "tap", label: "Tap", value: pct(ctl.tap ?? 0), bg: "#fef9c3", testId: "live-tap" }, ...base];
    case "dissolve": return [{ id: "dis", label: "Dissolved", value: pct(v.progress ?? 0), bg: "#e0f2fe", testId: "live-dissolved" }, ...base];
    default: return base;
  }
}
