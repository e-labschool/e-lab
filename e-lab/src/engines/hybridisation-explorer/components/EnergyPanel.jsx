import { ChevronDown, ChevronUp } from "lucide-react";
import Sci from "./Sci.jsx";
import { RECIPES } from "../model/hybrids.js";
import { condensedLatex } from "../model/elements.js";

// Orbital box diagram. The ATOMIC section is the actual (ground or illustrative-excited) configuration of the atom; the
// dashed HYBRID section below is the simplified hybrid-orbital model built from it. Boxes are the primary orbital-selection UI.
const CHIP = (o) => `var(--hy-${o.kind === "s" ? "s" : o.kind[0] === "p" ? o.kind : "d"}-pos)`; // the same colour as the 3D lobe: 2px blue, 2py green, 2pz purple, s orange

function Arrows({ e }) { return e === 0 ? null : <>{<span className="up" aria-hidden="true">{"↑"}</span>}{e === 2 && <span className="dn" aria-hidden="true">{"↓"}</span>}</>; }
const spinText = (e) => (e === 0 ? "empty" : e === 1 ? "1 electron, spin up" : "2 electrons, paired");

export function OrbitalBox({ id, latex, plain, electrons, chip, selected, hover, onClick, disabled, hybrid, mixed, sub, testId }) {
  return (
    <button
      type="button" className={"hy-box" + (hybrid ? " hy-box--hybrid" : "") + (mixed ? " hy-box--mixed" : "")} aria-pressed={selected} data-hover={hover ? "true" : undefined}
      disabled={disabled} onClick={onClick} data-testid={testId ?? `box-${id}`} data-electrons={electrons}
      aria-label={`${plain}: ${spinText(electrons)}${selected ? ", selected" : ""}${mixed ? ", mixed into the hybrid set" : ""}`}
      title={`${plain}: ${spinText(electrons)}`}
    >
      <span className="hy-box-sq" style={{ "--chip": chip }}><Arrows e={electrons} /></span>
      <span className="hy-box-lab"><Sci src={latex} /></span>
      {sub && <span className="hy-box-sub">{sub}</span>}
    </button>
  );
}

export default function EnergyPanel({
  atom, selectable = true, hoverId = null, onToggle, onCollapse, collapsible = true, title = "Energy Levels", hybridised = true, testId = "energy-panel", label,
}) {
  if (!atom) return null;
  const state = atom.state; const hyb = hybridised ? atom.hybrid : null;
  const sel = new Set(atom.selected ?? []);
  const rows = [];
  if (state.n >= 3) rows.push("d"); if (state.n >= 2) rows.push("p"); rows.push("s");
  const consumed = hyb ? hyb.consumed : [];
  const recipe = hyb ? RECIPES[hyb.recipeId] : null;
  const remaining = hyb ? atom.orbitals.filter((o) => !consumed.includes(o.id)) : [];
  return (
    <section className="hy-energy" aria-label={title} data-testid={testId}>
      <div className="hy-energy-head">
        <h3 className="hy-h" style={{ margin: 0 }}>{title}{label && <span className="hy-small"> {"· "}{label}</span>}</h3>
        {collapsible && <button type="button" className="hy-collapse" onClick={onCollapse} aria-expanded="true" aria-controls={testId} data-testid="energy-collapse" title="Collapse the Energy Levels panel"><ChevronUp size={14} aria-hidden="true" /> Hide</button>}
      </div>
      <p className="hy-config" data-testid="energy-config"><b>Electron configuration ({state.kind === "excited" ? "excited, illustrative" : "ground state"})</b><Sci src={condensedLatex(state)} /></p>
      <div className="hy-sec hy-sec--atomic" data-testid="atomic-section">
        <p className="hy-sec-title">Atomic orbitals <small>(actual configuration{state.kind === "excited" ? ": illustrative promotion" : ""})</small></p>
        <div className="hy-levels">
          {rows.map((type) => {
            const list = atom.orbitals.filter((o) => o.type === type);
            return (
              <div className="hy-level" key={type}>
                <span className="hy-level-name">{state.n}{type}</span>
                <div className="hy-boxes" role="group" aria-label={`${state.n}${type} orbitals`}>
                  {list.map((o) => {
                    const mixed = consumed.includes(o.id);
                    return (
                      <OrbitalBox
                        key={o.id} id={o.id} latex={o.latex} plain={o.plain} electrons={o.electrons} chip={CHIP(o)} selected={sel.has(o.id) && !mixed} hover={hoverId === o.id}
                        disabled={!selectable || mixed} mixed={mixed} onClick={() => onToggle?.(o.id)} sub={mixed ? "mixed" : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="hy-small" style={{ fontSize: 10.5 }}>Energy rises upwards. Electrons fill degenerate orbitals singly with parallel spins first (Hund{"’"}s rule).</p>
      </div>
      {hyb && (
        <div className="hy-sec hy-sec--hybrid" data-testid="hybrid-section">
          <p className="hy-sec-title">Hybrid-orbital model <small>(simplified: {hyb.hybrids.length} <Sci src={recipe.latex} /> hybrids, {recipe.geometry.toLowerCase()}, {recipe.idealText})</small></p>
          <div className="hy-boxes" role="group" aria-label="Hybrid orbitals">
            {hyb.hybrids.map((h) => (
              <OrbitalBox
                key={h.id} id={`hybrid-${h.index}`} latex={recipe.latex} plain={`${recipe.id} hybrid ${h.index + 1}`} electrons={h.electrons} chip={`var(--hy-h${h.index % 6}-pos)`} hybrid
                selected={sel.has(h.id)} hover={hoverId === h.id} disabled={!selectable} onClick={() => onToggle?.(h.id)} sub={`${h.index + 1}${h.electrons === 2 ? " · LP" : ""}`}
              />
            ))}
          </div>
          <p className="hy-small" style={{ fontSize: 10.5 }} data-testid="hybrid-remaining">
            {remaining.length ? <>Unhybridised: {remaining.filter((o) => o.type !== "d" || o.electrons > 0).map((o, i) => <span key={o.id}>{i ? ", " : ""}<Sci src={o.latex} /></span>)}.</> : "No unhybridised p orbitals remain."}
            {" "}These {hyb.hybrids.length} hybrids replace the {consumed.length} atomic orbitals mixed above (n in = n out); the electrons are the same.
          </p>
        </div>
      )}
      {state.kind === "excited" && <p className="hy-note" data-testid="promotion-note">{state.symbol === "C" ? "The 2s¹ 2p³ arrangement is a conventional teaching illustration used in valence-bond explanations, not a mandatory, experimentally observed intermediate that carbon passes through before bonding." : "Illustrative promotion used by the valence-bond model; atoms do not have to pass through this state before bonding."}</p>}
      {recipe?.traditional && <p className="hy-note" data-testid="traditional-note">Traditional hybridisation model: modern molecular-orbital descriptions of hypervalent molecules (PCl{"₅"}, SF{"₆"}) do not require significant d-orbital participation.</p>}
    </section>
  );
}
export function ExpandButton({ onClick }) { return <button type="button" className="hy-collapse" onClick={onClick} aria-expanded="false" data-testid="energy-expand"><ChevronDown size={14} aria-hidden="true" /> Energy Levels</button>; }
