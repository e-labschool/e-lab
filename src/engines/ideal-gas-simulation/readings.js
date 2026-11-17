// Ideal vs Real Gas -- adapter between the model and the shared Readings table (pure; tested in scripts/test-ideal-gas-model.mjs).
// Rows store the model's native values (atm, L, K, mol); each column's `scale` converts to the display unit.
import { IB_UNITS, generateZCurve, R_GAS } from "./model.js";
import { PRESSURE_UNITS, VOLUME_UNITS } from "../../lib/gas/gasUnits.js";

const KPA_PER_ATM = 101.325;

export function readingColumns(units = IB_UNITS) {
  const pu = PRESSURE_UNITS[units.pressure] ?? PRESSURE_UNITS.kPa; const vu = VOLUME_UNITS[units.volume] ?? VOLUME_UNITS.dm3;
  const ps = pu.perKPa * KPA_PER_ATM; const vs = vu.perDm3;
  const atm = units.pressure !== "kPa";
  return [
    { key: "P", label: "P", symbol: "P", unit: pu.label, decimals: atm ? 3 : 1, scale: ps },
    { key: "V", label: "V", symbol: "V", unit: vu.label, decimals: 2, scale: vs },
    { key: "T", label: "T", symbol: "T", unit: "K", decimals: 2, scale: 1 },
    { key: "n", label: "n", symbol: "n", unit: "mol", decimals: 2, scale: 1 },
    { key: "invV", label: "1/V", symbol: "1/V", unit: `${vu.label}⁻¹`, decimals: 4, scale: 1 / vs },
    { key: "PV", label: "PV", symbol: "PV", unit: `${pu.label}·${vu.label}`, decimals: atm ? 2 : 1, scale: ps * vs },
    { key: "PVoverNT", label: "PV/nT", symbol: "PV/nT", unit: `${pu.label}·${vu.label} mol⁻¹ K⁻¹`, decimals: 2, scale: ps * vs },
    { key: "Z", label: "Z", symbol: "Z", unit: "", decimals: 3, scale: 1 },
  ];
}

/** Raw values of the current resolved state (the displayed pressure of the selected model). */
export function readingValues(state) {
  const P = state.pressure; const V = state.V; const T = state.T; const n = state.n;
  return { P, V, T, n, invV: 1 / V, PV: P * V, PVoverNT: (P * V) / (n * T), Z: state.Z };
}

export function plotDefaultsFor(state) { return state.mode === "real" ? { x: "P", y: "Z" } : { x: "invV", y: "P" }; }
const PROPORTIONAL = new Set(["invV|P", "invV|PV"]);
export const originFor = (x, y) => PROPORTIONAL.has(`${x}|${y}`);

/** Theory line in DISPLAY units for the chosen axes (ideal-gas reference; the real vdW Z curve for Z against P in Real mode). */
export function theoryFor(state, xKey, yKey, columns) {
  const sc = (k) => columns.find((c) => c.key === k)?.scale ?? 1;
  const n = state.n; const T = state.T;
  const Vs = Array.from({ length: 41 }, (_, i) => state.V * (0.25 + (3.75 * i) / 40)); // 0.25 V ... 4 V
  const ideal = (V) => ({ P: (n * R_GAS * T) / V, V, invV: 1 / V, PV: n * R_GAS * T, PVoverNT: R_GAS, Z: 1, T, n });
  if (state.mode === "real" && xKey === "P" && yKey === "Z") {
    const c = generateZCurve(n, T, "real", undefined, state.gasId);
    return c.points.map((p) => ({ x: p.P * sc("P"), y: p.Z }));
  }
  const ok = { "V|P": 1, "invV|P": 1, "P|Z": 1, "P|PVoverNT": 1, "V|PV": 1, "invV|PV": 1 };
  if (!ok[`${xKey}|${yKey}`]) return null;
  if (xKey === "P") {
    const Ps = Array.from({ length: 30 }, (_, i) => 0.1 * Math.pow(5000, i / 29)); // 0.1 ... 500 atm
    return Ps.map((P) => ({ x: P * sc("P"), y: (yKey === "Z" ? 1 : R_GAS) * sc(yKey) }));
  }
  return Vs.map((V) => { const r = ideal(V); return { x: r[xKey] * sc(xKey), y: r[yKey] * sc(yKey) }; });
}
