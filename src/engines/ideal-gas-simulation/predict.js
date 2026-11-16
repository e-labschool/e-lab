// "Predict & Reveal" content for the Ideal Gas Simulation. Pure (no React/DOM).
// Layout-only addition: it does NOT change the physics -- every number in the
// answer is produced by model.resolveState() for the hypothetical controls, so
// the revealed answer always agrees with what the simulation would then show.
import { LIMITS, NATIVE_UNITS, clampControls, fmtPressure, fmtVolume, resolveState, unitLabelP, unitLabelV } from "./model.js";

const ratio = (a, b) => (a > 0 ? (b / a).toFixed(2) : null);

/** { question, answer } for the current controls. */
export function predictContent(controls, units = NATIVE_UNITS) {
  const f2 = (x) => fmtPressure(x, units); const fV = (x) => fmtVolume(x, units); const uP = unitLabelP(units); const uV = unitLabelV(units);
  const c = clampControls(controls);
  const now = resolveState(c);
  const real = c.mode === "real";

  if (c.control === "volume") {
    const halve = now.V / 2 >= LIMITS.V.min;
    const V1 = halve ? now.V / 2 : Math.min(LIMITS.V.max, now.V * 2);
    const after = resolveState({ ...c, V: V1 });
    const q = `What will happen to the pressure if the volume is ${halve ? "halved" : "doubled"} (${fV(now.V)} ${uV} to ${fV(V1)} ${uV}) at constant T and amount of gas?`;
    const ok = after.status === "ok" && (!real || after.comparison.status === "ok");
    const ideal = halve ? "doubles" : "halves";
    const a = ok
      ? real
        ? `Pressure goes from ${f2(now.pressure)} to ${f2(after.pressure)} ${uP} (x${ratio(now.pressure, after.pressure)}). An ideal gas would change by exactly x${halve ? "2" : "0.5"}; the difference comes from molecular size and attractions.`
        : `The pressure ${ideal}: P is proportional to 1/V. It goes from ${f2(now.pressure)} to ${f2(after.pressure)} ${uP}.`
      : `For an ideal gas the pressure ${ideal} (P is proportional to 1/V). The simplified real-gas model is unreliable here, so try it with the slider.`;
    return { question: q, answer: a };
  }

  const target = now.pTarget ?? c.P;
  const up = target * 2 <= LIMITS.P.max;
  const P1 = up ? target * 2 : Math.max(LIMITS.P.min, target / 2);
  const after = resolveState({ ...c, P: P1, Phold: null, Vpin: null });
  const q = `What will happen to the volume if the target pressure is ${up ? "doubled" : "halved"} (${f2(target)} ${uP} to ${f2(P1)} ${uP}) at constant T and amount of gas?`;
  const ok = after.status === "ok" && now.status === "ok" && (!real || after.comparison.status === "ok");
  const ideal = up ? "halves" : "doubles";
  const a = ok
    ? real
      ? `Volume goes from ${fV(now.V)} to ${fV(after.V)} ${uV} (x${ratio(now.V, after.V)}). An ideal gas would change by exactly x${up ? "0.5" : "2"}; the difference comes from molecular size and attractions.`
      : `The piston moves ${up ? "down" : "up"} and the volume ${ideal}: V is proportional to 1/P. It goes from ${fV(now.V)} to ${fV(after.V)} ${uV}.`
    : `For an ideal gas the volume ${ideal} (V is proportional to 1/P). The target is limited by the piston range here, so try it with the slider.`;
  return { question: q, answer: a };
}
