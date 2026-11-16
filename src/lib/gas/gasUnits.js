// IB DP Chemistry gas conventions + unit conversion: pure, no DOM, shared by the gas simulations.
//
// VERIFIED AGAINST (2026-11-16): the IB Chemistry data booklet for first assessment 2025 (text of the PDF as hosted at
// https://ibchem.com/root_pdf/DataBook2025.pdf, a secondary host of the IB document; the IB PDF itself was not opened):
//   Gas constant R ............ 8.31 J K^-1 mol^-1
//   Molar volume at STP ...... 2.27 x 10^-2 m^3 mol^-1 = 22.7 dm^3 mol^-1
//   STP ....................... 273.15 K and 100 kPa
//   SATP ...................... 298.15 K and 100 kPa   (the booklet's unit-conversion section defines it; the S1.5 content
//                                                      statements themselves only use STP)
//   Avogadro constant ........ 6.02 x 10^23 mol^-1
// S1.5 guidance (secondary summary, yueyuan-org.pages.dev): with Pa use m^3; with kPa use dm^3; older resources use 1 atm and 22.4.
// Because 1 J = 1 kPa dm^3, R = 8.31 kPa dm^3 K^-1 mol^-1 exactly, so no conversion factor appears in P V = n R T.

export const R_IB = 8.31; // J K^-1 mol^-1 = kPa dm^3 K^-1 mol^-1
export const KPA_PER_ATM = 101.325;
export const MMHG_PER_ATM = 760;
export const ABSOLUTE_ZERO_C = -273.15;
export const KELVIN_OFFSET = 273.15;
export const STP = Object.freeze({ name: "STP", T: 273.15, P_kPa: 100, molarVolume: 22.7 });
export const SATP = Object.freeze({ name: "SATP", T: 298.15, P_kPa: 100 });
export const AVOGADRO_IB = 6.02e23;

export const PRESSURE_UNITS = Object.freeze({
  kPa: Object.freeze({ id: "kPa", label: "kPa", perKPa: 1, decimals: 1, spoken: "kilopascals" }),
  atm: Object.freeze({ id: "atm", label: "atm", perKPa: 1 / KPA_PER_ATM, decimals: 3, spoken: "atmospheres" }),
  mmHg: Object.freeze({ id: "mmHg", label: "mmHg", perKPa: MMHG_PER_ATM / KPA_PER_ATM, decimals: 0, spoken: "millimetres of mercury" }),
});
export const VOLUME_UNITS = Object.freeze({
  dm3: Object.freeze({ id: "dm3", label: "dm³", perDm3: 1, decimals: 1, spoken: "cubic decimetres" }),
  L: Object.freeze({ id: "L", label: "L", perDm3: 1, decimals: 1, spoken: "litres" }),
  cm3: Object.freeze({ id: "cm3", label: "cm³", perDm3: 1000, decimals: 0, spoken: "cubic centimetres" }),
});
export const TEMPERATURE_UNITS = Object.freeze({
  K: Object.freeze({ id: "K", label: "K", decimals: 0, spoken: "kelvin" }),
  C: Object.freeze({ id: "C", label: "°C", decimals: 0, spoken: "degrees Celsius" }),
});

/** Unit systems the owner can switch between. "ib" is the default (IB data booklet conventions). */
export const UNIT_SYSTEMS = Object.freeze({
  ib: Object.freeze({ id: "ib", label: "IB (kPa, dm³)", pressure: "kPa", volume: "dm3" }),
  atm: Object.freeze({ id: "atm", label: "atm and L", pressure: "atm", volume: "L" }),
});
export const DEFAULT_UNIT_SYSTEM = "ib";

export const pressureUnit = (id) => PRESSURE_UNITS[id] ?? PRESSURE_UNITS.kPa;
export const volumeUnit = (id) => VOLUME_UNITS[id] ?? VOLUME_UNITS.dm3;

/** kPa -> chosen unit. */
export const fromKPa = (kPa, unit = "kPa") => kPa * pressureUnit(unit).perKPa;
/** chosen unit -> kPa. */
export const toKPa = (value, unit = "kPa") => value / pressureUnit(unit).perKPa;
export const fromDm3 = (dm3, unit = "dm3") => dm3 * volumeUnit(unit).perDm3;
export const toDm3 = (value, unit = "dm3") => value / volumeUnit(unit).perDm3;
export const kelvinToCelsius = (K) => K - KELVIN_OFFSET;
export const celsiusToKelvin = (C) => C + KELVIN_OFFSET;

/** Fixed-decimals text with a true minus sign and no "-0". */
export function fixed(x, decimals) {
  if (!Number.isFinite(x)) return "–";
  let s = x.toFixed(decimals);
  if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
  return s.replace("-", "−");
}

export const formatPressure = (kPa, unit = "kPa", decimals) => `${fixed(fromKPa(kPa, unit), decimals ?? pressureUnit(unit).decimals)} ${pressureUnit(unit).label}`;
export const formatVolume = (dm3, unit = "dm3", decimals) => `${fixed(fromDm3(dm3, unit), decimals ?? volumeUnit(unit).decimals)} ${volumeUnit(unit).label}`;
export const formatTemperatureK = (K, decimals = 0) => `${fixed(K, decimals)} K`;
export const formatTemperatureC = (K, decimals = 0) => `${fixed(kelvinToCelsius(K), decimals)} °C`;
/** "298 K (25 °C)" -- kelvin first (the IB working unit), Celsius beside it. */
export function formatTemperatureBoth(K, decimals = 0) { return `${formatTemperatureK(K, decimals)} (${formatTemperatureC(K, decimals)})`; }

/** n = PV / RT with IB units: P in kPa, V in dm^3, T in K. */
export const molesFrom = (P_kPa, V_dm3, T_K) => (P_kPa * V_dm3) / (R_IB * T_K);
export const pressureFrom = (n, T_K, V_dm3) => (n * R_IB * T_K) / V_dm3;
export const volumeFrom = (n, T_K, P_kPa) => (n * R_IB * T_K) / P_kPa;
export const temperatureFrom = (P_kPa, V_dm3, n) => (P_kPa * V_dm3) / (n * R_IB);

/** Parse text typed by a student ("273.15", "273,15", " 1 0 1 ") -> number | null. */
export function parseNumber(text) {
  if (typeof text === "number") return Number.isFinite(text) ? text : null;
  const t = String(text ?? "").trim().replace(/−/g, "-").replace(/,/g, ".").replace(/\s+/g, "");
  if (t === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
