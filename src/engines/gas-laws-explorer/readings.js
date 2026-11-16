// Gas Laws Explorer -- adapter between the model and the shared Readings table (pure; tested in scripts/test-gas-laws-model.mjs).
import { GRAPH_DEFS, IB_UNITS, axisDef, axisFactor, buildGraph, unitLabel } from "./model.js";

// Table columns = every quantity any of the graphs plots, so the student can plot whatever they like against whatever they like.
const KEYS = ["P", "V", "Tk", "Tc", "n", "invV", "PV", "VoverT", "PoverT", "VoverN", "nT", "PVoverNT"];
const SYMBOL = { P: "P", V: "V", Tk: "T", Tc: "t", n: "n", invV: "1/V", PV: "PV", VoverT: "V/T", PoverT: "P/T", VoverN: "V/n", nT: "nT", PVoverNT: "PV/nT" };
const LABEL = { P: "P", V: "V", Tk: "T", Tc: "t", n: "n", invV: "1/V", PV: "PV", VoverT: "V/T", PoverT: "P/T", VoverN: "V/n", nT: "nT", PVoverNT: "PV/nT" };

export function readingColumns(units = IB_UNITS) {
  const atm = units.pressure !== "kPa";
  const decimals = { P: atm ? 3 : 1, V: 1, Tk: 2, Tc: 2, n: 2, invV: 4, PV: atm ? 2 : 1, VoverT: 5, PoverT: atm ? 5 : 3, VoverN: 2, nT: 1, PVoverNT: 2 };
  return KEYS.map((k) => {
    const ax = axisDef(k);
    return { key: k, label: LABEL[k], symbol: SYMBOL[k], unit: ax.unit(units), decimals: decimals[k], scale: axisFactor(ax, units) };
  });
}

/** Raw values (kPa, dm^3, K ...) for the current state; the table scales them to the display unit. */
export function readingValues(state) {
  const v = {};
  for (const k of KEYS) v[k] = axisDef(k).f(state);
  return v;
}

export const plotDefaultsFor = (graph) => ({ x: graph.xKey, y: graph.yKey });

/** Theory polyline for the chosen axes, in DISPLAY units; null when no theory graph of this mode has exactly these axes. */
export function theoryFor(state, xKey, yKey, units = IB_UNITS) {
  const def = GRAPH_DEFS[state.mode].find((g) => g.x === xKey && g.y === yKey);
  if (!def) return null;
  const g = buildGraph(state, def.id, { units, marker: false });
  return g.accessible.map((p) => ({ x: p.x, y: p.y }));
}

const PROPORTIONAL = new Set(["invV|P", "Tk|V", "Tk|P", "n|V", "nT|PV"]);
export const originFor = (x, y) => PROPORTIONAL.has(`${x}|${y}`);
export { unitLabel };
