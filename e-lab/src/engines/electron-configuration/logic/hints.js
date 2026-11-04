// Progressive-hint logic, kept separate from display so richer hint types
// can be added later without touching HintPanel.jsx.
import { getElementBySymbol } from "../../../data/chemistry/elements.js";
import { SUBSHELL_LETTERS } from "./buildConfiguration.js";

const NOBLE_GAS_SYMBOLS = ["He", "Ne", "Ar", "Kr", "Xe", "Rn", "Og"];
const NOBLE_GASES = NOBLE_GAS_SYMBOLS.map((s) => getElementBySymbol(s)).filter(Boolean);

export function getPreviousNobleGas(atomicNumber) {
  const candidates = NOBLE_GASES.filter((el) => el.atomicNumber < atomicNumber);
  if (candidates.length === 0) return null;
  return candidates.reduce((closest, el) => (el.atomicNumber > closest.atomicNumber ? el : closest));
}

/**
 * Returns hint text for a given level (1-indexed). Levels 1-2 are fixed
 * (period/block, then noble-gas core); level 3+ progressively reveals one
 * more subshell of the answer at a time, in filling order.
 */
export function getHintText(level, config) {
  if (level <= 0) return null;

  if (level === 1) {
    return `${config.element.name} is in period ${config.element.period}, ${config.element.block}-block.`;
  }

  if (level === 2) {
    const core = getPreviousNobleGas(config.element.atomicNumber);
    return core
      ? `Its configuration builds on the ${core.name} (${core.symbol}) noble-gas core: [${core.symbol}] + ${config.element.atomicNumber - core.atomicNumber} more electrons.`
      : `Its configuration starts from scratch — no noble gas comes before it.`;
  }

  const revealCount = level - 2;
  const subshellsToShow = config.subshellsFillingOrder.slice(0, revealCount);
  const asString = subshellsToShow
    .map((s) => `${s.n}${SUBSHELL_LETTERS[s.l]}${s.electrons}`)
    .join(" ");
  const isComplete = revealCount >= config.subshellsFillingOrder.length;
  return isComplete
    ? `Full filling order: ${asString}`
    : `Filled so far, in order: ${asString} \u2026`;
}

export function getMaxHintLevel(config) {
  return 2 + config.subshellsFillingOrder.length;
}
