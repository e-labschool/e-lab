// Gas Laws Explorer -- presentation text for the four relationships (pure data; no physics).
// One entry per mode: the law name shown under the tab, the dynamic heading and a single
// scientifically accurate sentence. Every sentence names what is held constant, uses
// "absolute temperature" where T is in kelvin, and states the proportionality exactly.
// The relationships themselves live in model.js (PV = nRT); this file only describes them.

export const LAW_INFO = Object.freeze({
  pv: {
    abbr: "P–V",
    law: "Boyle's Law",
    quantities: "Pressure and Volume",
    sentence: "At constant temperature and amount of gas, pressure is inversely proportional to volume.",
  },
  vt: {
    abbr: "V–T",
    law: "Charles's Law",
    quantities: "Volume and Temperature",
    sentence: "At constant pressure and amount of gas, volume is directly proportional to absolute temperature.",
  },
  pt: {
    abbr: "P–T",
    law: "Gay-Lussac's Law",
    quantities: "Pressure and Temperature",
    sentence: "At constant volume and amount of gas, pressure is directly proportional to absolute temperature.",
  },
  comb: {
    abbr: "PV = nRT",
    law: "Ideal gas equation",
    quantities: "P, V, T and n",
    sentence: "PV = nRT: for an ideal gas the four variables are linked, with R = 8.31 J K\u207b\u00b9 mol\u207b\u00b9 (kPa with dm\u00b3).",
  },
  vn: {
    abbr: "V–n",
    law: "Avogadro's Law",
    quantities: "Volume and Amount of Gas",
    sentence: "At constant pressure and temperature, volume is directly proportional to the amount of gas.",
  },
});

/** "Boyle's Law — Pressure and Volume" */
export function lawHeading(mode) {
  const i = LAW_INFO[mode];
  return `${i.law} — ${i.quantities}`;
}
