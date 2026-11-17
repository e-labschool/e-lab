import { useState } from "react";
import { TEXT, MUTED, CURVE, SHADE } from "../theme.js";

/**
 * Reaction (energy) profile for the current Ea and catalyst setting (IB R2.2: a catalyst provides an alternative pathway with a lower Ea).
 * The Ea values come from the sliders (a demonstration scale, see Settings). The enthalpy change is NOT modelled in the vessel: the
 * exothermic / endothermic choice is a labelled illustration only, and the same delta H applies with and without the catalyst.
 */
const W = 300; const H = 120; const L = 34; const R = 10; const T = 12; const B = 24;
export const PROFILE_DH = { exo: -20, endo: 20 }; // kJ/mol, illustrative

export function profileGeometry({ ea, eaCat, dh }) {
  // Energy axis in kJ/mol with reactants at 0. Peak = Ea (uncatalysed) above reactants; catalysed peak = eaCat.
  const top = Math.max(ea, 5) * 1.15 + Math.max(dh, 0);
  const bottom = Math.min(0, dh) - 6;
  const y = (E) => T + (1 - (E - bottom) / (top - bottom)) * (H - T - B);
  const x = (f) => L + f * (W - L - R);
  const curve = (peak) => {
    // reactants plateau, smooth hump to the peak, products plateau (cubic Bezier pairs through the peak)
    const x0 = x(0.04); const x1 = x(0.3); const xp = x(0.5); const x2 = x(0.7); const x3 = x(0.96);
    return `M${x0},${y(0)} L${x1},${y(0)} C${x(0.4)},${y(0)} ${x(0.42)},${y(peak)} ${xp},${y(peak)} C${x(0.58)},${y(peak)} ${x(0.6)},${y(dh)} ${x2},${y(dh)} L${x3},${y(dh)}`;
  };
  return { y, x, curve };
}

export default function ReactionProfile({ ea, eaEff, catalyst }) {
  const [kind, setKind] = useState("exo");
  const dh = Math.sign(PROFILE_DH[kind]) * Math.min(Math.abs(PROFILE_DH[kind]), Math.floor(ea / 2)); // keeps dH below Ea, as for a real endothermic step
  const eaCat = catalyst ? eaEff : null;
  const g = profileGeometry({ ea, eaCat, dh });
  const xm = g.x(0.5);
  const arrow = (x, y1, y2, color, label, side, dashTo) => (
    <g>
      {dashTo != null && <line x1={x} x2={dashTo} y1={y2} y2={y2} stroke={color} strokeWidth="1" strokeDasharray="2 3" />}
      <line x1={x} x2={x} y1={y1} y2={y2} stroke={color} strokeWidth="1.5" markerEnd="url(#rp-arr)" />
      <text x={x + (side === "r" ? 5 : -5)} y={(y1 + y2) / 2 + 4} fontSize="11" fontWeight="700" fill={color} textAnchor={side === "r" ? "start" : "end"} stroke="#fff" strokeWidth="3" paintOrder="stroke">{label}</text>
    </g>
  );
  return (
    <div className="ct-profile" data-testid="reaction-profile">
      <div className="ct-profile-head">
        <b>Reaction profile</b>
        <span role="group" aria-label="Enthalpy change shown (illustration only)">
          <button type="button" className="sd-btn sd-btn--sm" aria-pressed={kind === "exo"} onClick={() => setKind("exo")}>Exothermic</button>{" "}
          <button type="button" className="sd-btn sd-btn--sm" aria-pressed={kind === "endo"} onClick={() => setKind("endo")}>Endothermic</button>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Energy profile: Ea ${ea} kJ per mole${catalyst ? `, lowered to ${eaEff.toFixed(0)} kJ per mole with the catalyst` : ""}; enthalpy change ${dh > 0 ? "+" : "−"}${Math.abs(dh)} kJ per mole (illustration).`}>
        <defs><marker id="rp-arr" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill={TEXT} /></marker></defs>
        <line x1={L} y1={T} x2={L} y2={H - B} stroke={MUTED} />
        <line x1={L} y1={H - B} x2={W - R} y2={H - B} stroke={MUTED} />
        <text x="10" y={(H - B + T) / 2} fontSize="11" fill={TEXT} transform={`rotate(-90 10 ${(H - B + T) / 2})`} textAnchor="middle">Energy</text>
        <text x={(L + W - R) / 2} y={H - 8} fontSize="11" fill={TEXT} textAnchor="middle">Progress of reaction</text>
        <line x1={g.x(0.04)} x2={g.x(0.96)} y1={g.y(0)} y2={g.y(0)} stroke="#cbd5e1" strokeDasharray="3 3" />
        <path d={g.curve(ea)} fill="none" stroke={catalyst ? "#94a3b8" : CURVE} strokeWidth="2.5" strokeDasharray={catalyst ? "6 4" : ""} data-testid="profile-uncat" />
        {catalyst && <path d={g.curve(eaCat)} fill="none" stroke="#15803d" strokeWidth="2.5" data-testid="profile-cat" />}
        {arrow(g.x(0.2), g.y(0), g.y(ea), SHADE, "Ea", "l", xm)}
        {catalyst && arrow(g.x(0.62), g.y(0), g.y(eaCat), "#15803d", "Ea(cat)", "r", xm)}
        {arrow(g.x(0.88), g.y(0), g.y(dh), TEXT, "\u0394H", "r")}
        <text x={g.x(0.04)} y={g.y(0) + 13} fontSize="11" fill={TEXT}>Reactants</text>
        <text x={g.x(0.84)} y={g.y(dh) + (dh < 0 ? 13 : -5)} fontSize="11" fill={TEXT} textAnchor="end" stroke="#fff" strokeWidth="3" paintOrder="stroke">Products</text>
      </svg>
      <p className="ct-profile-vals" data-testid="profile-values">Ea = {ea.toFixed(0)} kJ mol{"\u207B\u00B9"}{catalyst ? `; with the catalyst Ea = ${eaEff.toFixed(0)} kJ mol\u207B\u00B9` : ""}; {"\u0394H"} = {dh > 0 ? "+" : "\u2212"}{Math.abs(dh)} kJ mol{"\u207B\u00B9"} (illustrative: the vessel does not model heat; a catalyst lowers Ea, not ΔH).</p>
    </div>
  );
}
