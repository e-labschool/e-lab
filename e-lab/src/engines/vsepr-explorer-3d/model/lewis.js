// Lewis-structure derivation for the VSEPR Explorer model: PURE.
// The model is one central atom plus terminal atoms, so a "Lewis structure" here is the central atom, bond orders and
// lone pairs. Terminal lone pairs are derived with the octet rule (H: none). NOT every free build is a valid Lewis
// structure: this returns warnings instead of pretending. Expanded / incomplete octets are exceptions, not errors.
import { ELEMENTS, MAX_TERMINAL_ORDER } from "./elements.js";

const EXCEPTION_INCOMPLETE = new Set(["Be", "B"]);

export function deriveLewis(m) {
  if (!m.central) return { empty: true, warnings: [], status: "empty", terminals: [], centralLonePairs: 0 };
  const c = ELEMENTS[m.central];
  const bonds = m.domains.filter((d) => d.kind === "bond");
  const lp = m.domains.filter((d) => d.kind === "lp").length;
  const sumOrders = bonds.reduce((s, d) => s + d.order, 0);
  const centralElectrons = 2 * sumOrders + 2 * lp;
  const warnings = []; // { level: "warn" | "info", text }
  const warn = (text) => warnings.push({ level: "warn", text });
  const info = (text) => warnings.push({ level: "info", text });

  const terminals = bonds.map((d) => {
    const el = d.symbol ? ELEMENTS[d.symbol] : null;
    if (!el) { warn("A bond has no atom at its free end: drop an atom onto it."); return { id: d.id, symbol: null, order: d.order, lonePairs: 0, formal: 0 }; }
    const max = MAX_TERMINAL_ORDER[el.symbol] ?? 1;
    if (el.symbol === "H" && d.order > 1) warn("Hydrogen can form only one bond (it holds 2 electrons).");
    else if (d.order > max) warn(`${el.symbol} does not normally form a ${d.order === 2 ? "double" : "triple"} bond as a surrounding atom.`);
    else if (max === 1 && !["H", "F", "Cl", "Br", "I"].includes(el.symbol)) warn(`${el.symbol} does not usually appear as a one-bond surrounding atom here.`);
    const lonePairs = el.symbol === "H" ? 0 : Math.max(0, 4 - d.order);
    const formal = el.valence - (2 * lonePairs + d.order);
    return { id: d.id, symbol: el.symbol, order: d.order, lonePairs, formal };
  });

  const centralFormal = c.valence - (2 * lp + sumOrders);
  if (m.central === "H" && bonds.length > 1) warn("Hydrogen cannot be a central atom with more than one bond.");
  if (bonds.length && !m.domains.every((d) => d.kind === "lp" || d.symbol)) { /* already warned above */ }

  if (centralElectrons > 8 && m.central !== "H") {
    if (c.period >= 3) info(`Expanded octet: ${m.central} has ${centralElectrons} electrons around it. This is an exception to the octet rule, possible for period 3+ elements.`);
    else warn(`${m.central} is in period 2 and cannot hold ${centralElectrons} electrons: this is not a valid Lewis structure.`);
  } else if (centralElectrons < 8 && bonds.length > 0) {
    if (EXCEPTION_INCOMPLETE.has(m.central)) info(`Incomplete octet: ${m.central} has only ${centralElectrons} electrons around it. This is a known exception to the octet rule.`);
    else if (m.central !== "H") warn(`${m.central} has only ${centralElectrons} electrons around it (incomplete octet). Add lone pairs or bonds, or this is a reactive species.`);
  }
  const net = centralFormal + terminals.reduce((s, t) => s + t.formal, 0);
  if (net !== 0 && bonds.length) {
    const sign = net > 0 ? `+${net}` : `${net}`;
    warn(`The electron count gives a net formal charge of ${sign}, so this is an ion or not a neutral molecule.`);
  } else if (centralFormal !== 0 && bonds.length) {
    warn(`${m.central} has formal charge ${centralFormal > 0 ? "+" : ""}${centralFormal}.`);
  }
  const status = warnings.some((w) => w.level === "warn") ? "warning" : warnings.length ? "exception" : "ok";
  return { empty: false, central: m.central, centralLonePairs: lp, sumOrders, centralElectrons, centralFormal, terminals, netCharge: net, warnings, status };
}
