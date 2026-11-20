// Educational text.  Pure functions of the simulation state so every sentence is computed from the same numbers the graphs show.
// Each message exists in a normal and a "simple wording" form.
import { REACTIONS, gasCoefficients } from "./reactions.js";
import { kp } from "./thermo.js";

export const STATUS_LABEL = Object.freeze({
  approaching: "Approaching equilibrium", near: "Near equilibrium", attained: "Dynamic equilibrium attained", empty: "No reaction possible",
});
export const SUCCESS = Object.freeze({
  title: "Dynamic equilibrium attained!",
  everyday: "People continue moving in both directions, but the average transfer rates are equal. The populations remain constant on average.",
  everydaySimple: "People keep travelling both ways. On average the same number go each way, so the crowds stay the same size.",
  chem: "Both reactions are still happening, at the same rate. Because the forward rate equals the reverse rate, the concentrations stay constant.",
  chemSimple: "Both reactions still go on, at the same speed, so the amounts stop changing.",
});

export const fmt = (x, digits = 3) => {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  if (x === Infinity) return "∞";
  if (x === 0) return "0";
  const a = Math.abs(x);
  if (a >= 1e4 || a < 1e-3) { const [m, e] = x.toExponential(digits - 1).split("e"); return `${m}×10${superscript(parseInt(e, 10))}`; }
  return Number(x.toPrecision(digits)).toString();
};
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
const superscript = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

// ------------------------------------------------------------------ everyday
export function everydayNotice(tr, simple = false) {
  const info = tr.info; if (!info) return null;
  const lines = [simple ? "The balance has been upset." : "Equilibrium disturbed."];
  if (info.direction === "forward") lines.push(simple ? "For now more people go from A to B than from B to A." : "Forward transfer temporarily exceeds reverse transfer.");
  else if (info.direction === "reverse") lines.push(simple ? "For now more people go from B to A than from A to B." : "Reverse transfer temporarily exceeds forward transfer.");
  if (tr.phase === "attained") { lines.push(simple ? "The crowds have settled." : "System readjusted."); lines.push(simple ? "A new balance: the two trips are equal again." : "New dynamic equilibrium attained."); }
  else lines.push(simple ? "The crowds are adjusting." : "System readjusting.");
  return lines;
}

export function everydayWhy(snap, simple) {
  const eq = `At equilibrium: forward rate = k_f × A = ${fmt(snap.kf)} × ${fmt(snap.Aeq, 3)} = ${fmt(snap.kf * snap.Aeq)} people per time unit, and reverse rate = k_r × B = ${fmt(snap.kr)} × ${fmt(snap.Beq, 3)} = ${fmt(snap.kr * snap.Beq)}.`;
  return simple
    ? `Going each way takes the same number of people at balance: ${fmt(snap.kf * snap.Aeq)} per time unit. The crowds can be different sizes, because k_f and k_r are different.`
    : `${eq} The rates are equal even though the populations are not: B_eq / A_eq = k_f / k_r = ${fmt(snap.K)}.`;
}

export const ANALOGY = Object.freeze({
  explains: [
    "A reversible change goes both ways at once.",
    "Forward and reverse rates start different and become equal.",
    "At equilibrium the rates are equal, yet nothing stops: it is dynamic.",
    "Equal rates do not mean equal amounts: the position depends on k_f / k_r.",
    "Adding or removing people changes the rates and the system readjusts (Le Chatelier).",
  ],
  doesNot: [
    "Real molecules react by collisions with enough energy, not by taking a bus.",
    "It cannot show the effect of temperature, pressure or a catalyst: bus speed is not a rate constant.",
    "It has no stoichiometry: one person always becomes one person.",
    "The chemical model is authoritative; the analogy is only a first picture.",
  ],
  explainsSimple: ["Change can go forwards and backwards at the same time.", "The two trips start different and become equal.", "When equal, people still keep moving. That is why it is called dynamic.", "Equal trips do not mean equal crowds.", "Add or remove people and the crowds adjust."],
  doesNotSimple: ["Molecules do not ride buses: they collide.", "It cannot show heat, pressure or catalysts.", "It cannot show molecules splitting into two or three.", "The chemical model is the one to trust."],
});

// ------------------------------------------------------------------ chemical
const side = (rx, sign) => rx.species.filter((s) => (sign < 0 ? rx.nu[s.id] < 0 : rx.nu[s.id] > 0)).map((s) => `${Math.abs(rx.nu[s.id]) > 1 ? Math.abs(rx.nu[s.id]) : ""}${s.formula}`).join(" + ");
const directionWords = (rx, dir, simple) => (dir === "forward" ? (simple ? `${side(rx, -1)} turns into ${side(rx, 1)}` : `${side(rx, -1)} → ${side(rx, 1)}`) : dir === "reverse" ? (simple ? `${side(rx, 1)} turns back into ${side(rx, -1)}` : `${side(rx, 1)} → ${side(rx, -1)}`) : "no net change");

export function quotientSentence(info, simple) {
  if (!info || !Number.isFinite(info.K)) return "";
  const q = fmt(info.Q); const k = fmt(info.K);
  if (info.direction === "equilibrium") return simple ? `Q (${q}) equals K (${k}), so nothing changes overall.` : `Q = ${q} equals K = ${k}: the system is at equilibrium.`;
  if (info.direction === "forward") return simple ? `Q (${q}) is smaller than K (${k}), so the forward reaction wins for now.` : `Q = ${q} is less than K = ${k}, so the net reaction proceeds forward.`;
  return simple ? `Q (${q}) is bigger than K (${k}), so the reverse reaction wins for now.` : `Q = ${q} is greater than K = ${k}, so the net reaction proceeds in reverse.`;
}

export function disturbanceExplanation(tr, simple = false) {
  const info = tr.info; if (!info) return null; const rx = REACTIONS[tr.s.rid]; const out = [];
  const before = tr.before;
  switch (info.type) {
    case "ch/add": case "ch/remove": {
      const add = info.type === "ch/add";
      out.push(simple ? `You ${add ? "added" : "took out"} ${fmt(info.n)} mol of ${info.formula}. The amount changed straight away.` : `${add ? "Added" : "Removed"} ${fmt(info.n)} mol of ${info.formula}: its concentration changed at once, so Q changed from ${fmt(before?.Q)} to ${fmt(info.Q)} while K stayed ${fmt(info.K)} (the temperature has not changed).`);
      out.push(quotientSentence(info, simple));
      if (info.direction !== "equilibrium") out.push(`${simple ? "What happens" : "Net change"}: ${directionWords(rx, info.direction, simple)} until Q = K again. ${simple ? "The system works against the change you made." : "The system acts to oppose the change (Le Chatelier's principle)."}`);
      break;
    }
    case "ch/temp": {
      const hot = info.dir > 0; const endo = rx.thermo.dH > 0; const dH = (rx.thermo.dH / 1000).toFixed(1);
      out.push(simple ? `You made it ${hot ? "hotter" : "cooler"} (${Math.round(info.T0)} K → ${Math.round(info.T1)} K).` : `Temperature ${hot ? "increased" : "decreased"} from ${info.T0.toFixed(0)} K to ${info.T1.toFixed(0)} K. Both k_f and k_r change, and so does K: ${fmt(before?.K)} → ${fmt(info.K)}.`);
      out.push(simple ? `The forward reaction is ${endo ? "endothermic (takes in heat)" : "exothermic (gives out heat)"}, so heating ${endo === hot ? "favours" : "disfavours"} the products.` : `The forward reaction is ${endo ? "endothermic" : "exothermic"} (ΔH° ≈ ${endo ? "+" : ""}${dH} kJ mol⁻¹), so K ${endo === hot ? "increases" : "decreases"} with ${hot ? "heating" : "cooling"} (van 't Hoff: d ln K / dT = ΔH° / RT²).`);
      out.push(quotientSentence(info, simple));
      out.push(simple ? "The amounts did not change at that moment; only the balance point moved." : "The concentrations were unchanged at that instant, so Q was unchanged while K moved; the equilibrium position then readjusts. Unlike a catalyst, temperature changes K.");
      break;
    }
    case "ch/vol": {
      const dec = info.dir === "decrease"; const g = gasCoefficients(rx);
      out.push(simple ? `You made the container ${dec ? "smaller" : "bigger"}. The gas is ${dec ? "squeezed" : "spread out"}.` : `Volume ${dec ? "decreased" : "increased"} (${fmt(info.V0)} → ${fmt(info.V1)} dm³): every concentration ${dec ? "doubled" : "halved"} at once (same amount of gas, ${dec ? "smaller" : "larger"} space), so the total pressure ${dec ? "rose" : "fell"} (ideal gas).`);
      if (g.dn === 0) out.push(simple ? "There are the same number of gas molecules on both sides, so squeezing does not favour either side. Both reactions speed up together." : `There are ${g.left} mol of gas on each side (Δn = 0), so Q = K is unchanged by the volume change: no shift in composition. Both rates change by the same factor.`);
      else { const fewer = g.dn > 0 ? "reactants" : "products"; out.push(simple ? `${dec ? "Squeezing" : "Spreading"} favours the side with ${dec ? "fewer" : "more"} gas molecules.` : `Q ${info.Q > info.K ? "became greater than" : info.Q < info.K ? "became less than" : "equals"} K, so the net reaction goes ${info.direction}. ${dec ? "Higher pressure favours the side with fewer gas moles" : "Lower pressure favours the side with more gas moles"} (${g.left} mol on the left, ${g.right} on the right).`); void fewer; }
      out.push(quotientSentence(info, simple));
      break;
    }
    case "ch/cat": {
      out.push(info.on
        ? (simple ? `A catalyst speeds up both reactions by the same factor (about ×${fmt(info.factor, 2)}).` : `Catalyst added: it lowers the activation energy of the forward and the reverse reaction equally, so both rate constants rise by the same factor (about ×${fmt(info.factor, 2)} here). k_f / k_r = K is unchanged.`)
        : (simple ? "The catalyst was taken away, so both reactions slow down by the same factor." : "Catalyst removed: both rate constants fall by the same factor; K is unchanged."));
      out.push(simple ? "The end amounts stay the same. A catalyst only gets you there faster." : "The equilibrium constant, the equilibrium position and the final composition are unchanged; the system just reaches equilibrium sooner. If already at equilibrium the rates rise but remain equal.");
      break;
    }
    default: break;
  }
  return out.filter(Boolean);
}

export function positionText(K, simple) {
  const pos = K < 0.5 ? "towards reactants" : K > 2 ? "towards products" : "balanced";
  return simple ? `Position: ${pos}` : `Equilibrium position: ${pos}`;
}

/** The advanced panel: K expressions, Kc / K° / Kp, and the stated assumptions. */
export function advancedNote(rx, ch, simple = false) {
  const lines = [];
  lines.push(`K_c = ${rx.kcExpr}${rx.units.K ? `  (units: ${rx.units.K})` : ""}.`);
  if (rx.gas && rx.id !== "ab") {
    const p = kp(rx, ch.T, { kfRef: ch.kfRef, krRef: ch.krRef });
    lines.push(`For gases K_p = K_c (RT)^Δn with Δn = ${rx.dnGas >= 0 ? "+" : "−"}${Math.abs(rx.dnGas)}; here K_p = ${fmt(p)} bar${rx.dnGas ? `^${rx.dnGas}` : ""} (the standard-state K° is the same number with the unit of bar divided out, p° = 1 bar).`);
  }
  lines.push(rx.aqueous ? "Aqueous solution: pressure and volume of a gas play no role here, so no pressure control is offered." : "Ideal gases assumed. Changing volume changes pressure and every concentration; adding an inert gas at constant volume changes neither the partial pressures nor the concentrations, so it does not shift the equilibrium. At constant total pressure an added inert gas makes the volume expand, which acts like a volume increase.");
  lines.push(`${rx.source}`);
  if (rx.mechanismNote) lines.push(rx.mechanismNote);
  lines.push("Rate laws use the overall stoichiometry as mass-action orders: a teaching approximation. K = k_f / k_r is imposed at every temperature.");
  return simple ? lines.slice(0, 2) : lines;
}

// ------------------------------------------------------------------ learning stages
export const STAGES = Object.freeze([
  { n: 1, short: "Observe", title: "Observe", prompt: "Press Start. Everyone begins in City A, so only the blue bus has passengers. Watch the forward process.", simple: "Press Start. Watch people leave A.", chem: "Press Start. Only reactants are present, so only the forward reaction is happening." },
  { n: 2, short: "Reverse", title: "Reverse process", prompt: "Products now exist, so the reverse process begins. Watch the orange bus start working.", simple: "Now some people are in B, so some go back to A.", chem: "Products have formed, so the reverse reaction begins. Its rate rises with the amount of product." },
  { n: 3, short: "Approach", title: "Approaching equilibrium", prompt: "The forward rate falls and the reverse rate rises. Watch the two curves come together.", simple: "The two lines on the graph move towards each other.", chem: "The forward rate falls and the reverse rate rises: the curves converge." },
  { n: 4, short: "Equilibrium", title: "Dynamic equilibrium", prompt: "The rates are equal but not zero. Populations stay constant on average while people keep moving.", simple: "The lines meet but do not drop to zero. People keep moving.", chem: "The rates are equal and nonzero; concentrations stay constant while reactions continue both ways." },
  { n: 5, short: "Position", title: "Equilibrium position", prompt: "Try Towards A, Center and Towards B. Equal rates do not mean equal populations.", simple: "Try the three buttons. The crowds can end up different sizes.", chem: "Compare reactions: K is small (reactant-favoured), near 1 (balanced) or large (product-favoured). Position and speed are different things." },
  { n: 6, short: "Disturb", title: "Disturb equilibrium", prompt: "Add or remove people. Predict which bus will be busier before you press.", simple: "Add or remove people. Guess first, then check.", chem: "Add or remove a species. Predict the direction from Q and K before you press." },
  { n: 7, short: "Conditions", title: "Chemical conditions", prompt: "Chemical Model: explore temperature, volume (pressure) and a catalyst.", simple: "Try heat, squeezing and a catalyst in Chemical Model.", chem: "Change temperature, volume or add a catalyst. Only temperature changes K." },
  { n: 8, short: "Explain", title: "Explain", prompt: "Explain each change using the rates, Q, K and Le Chatelier's principle.", simple: "Say in your own words why the crowds moved.", chem: "Explain each change using the rates, Q compared with K, and Le Chatelier's principle." },
]);

/** Short plain description of what a rate value means, used by the hover read-outs. */
export const RATE_UNITS = Object.freeze({ everyday: "people per time unit", chem: "mol dm⁻³ s⁻¹" });
