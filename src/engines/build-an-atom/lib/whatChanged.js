// Generates the "What Changed" feedback from the ACTUAL previous and
// new derived atom states plus which particle type/direction just
// changed -- never a generic templated message, so it can never say
// something inconsistent with what's actually displayed elsewhere.
export function describeChange(changedType, delta, prevDerived, nextDerived) {
  const sign = delta > 0 ? "+1" : "\u22121";

  if (changedType === "proton") {
    const elementChanged = prevDerived.element?.symbol !== nextDerived.element?.symbol;
    return {
      headline: `${sign} PROTON`,
      lines: [
        `Atomic number: ${prevDerived.atomicNumber} \u2192 ${nextDerived.atomicNumber}`,
        elementChanged
          ? `The element has changed: ${prevDerived.element?.name ?? "(no element)"} \u2192 ${nextDerived.element?.name ?? "(no element)"}`
          : `The element is still ${nextDerived.element?.name ?? "(no element)"}.`,
      ],
      resultLine: nextDerived.nuclideName ? `You have built ${nextDerived.nuclideName}.` : null,
      accentColor: "var(--color-teal)",
    };
  }

  if (changedType === "neutron") {
    return {
      headline: `${sign} NEUTRON`,
      lines: [
        `The proton number did not change, so the element is still ${nextDerived.element?.name ?? "unknown"}.`,
        `Mass number: ${prevDerived.massNumber} \u2192 ${nextDerived.massNumber}`,
      ],
      resultLine: nextDerived.nuclideName ? `You have built ${nextDerived.nuclideName}.` : null,
      accentColor: "var(--color-violet)",
    };
  }

  // electron
  const prevChargeStr = prevDerived.netCharge > 0 ? `+${prevDerived.netCharge}` : String(prevDerived.netCharge);
  const nextChargeStr = nextDerived.netCharge > 0 ? `+${nextDerived.netCharge}` : String(nextDerived.netCharge);
  const classificationChanged = prevDerived.classification !== nextDerived.classification;
  return {
    headline: `${sign} ELECTRON`,
    lines: [
      "The nucleus did not change. The element and isotope are unchanged.",
      `Net charge: ${prevChargeStr} \u2192 ${nextChargeStr}`,
    ],
    resultLine: classificationChanged
      ? nextDerived.classification === "neutral"
        ? "The atom is now neutral again."
        : `You have created a ${nextDerived.classification === "cation" ? "POSITIVE ion \u2014 a CATION" : "NEGATIVE ion \u2014 an ANION"}.`
      : null,
    accentColor: "var(--color-indigo)",
  };
}
