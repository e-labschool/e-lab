import { SPECIES } from "../theme.js";

/**
 * The reaction equation A + B -> C + D. Each species is a toggle button that selects that species' curve in the graph
 * (A or B: the reactants view narrowed to it; C or D: the products view narrowed to it); the arrow and "All" show both reactants
 * and products together. It is driven by the same state as the graph selector, so the two always agree.
 * The reaction is not reversible: the arrow only points one way.
 */
export default function ReactionEquation({ view, species, onPick, solid = false }) {
  const pressed = (k) => {
    if (k === "all") return view === "both";
    if (view === "reactants") return (k === "A" || k === "B") && (!species || species === k);
    if (view === "products") return (k === "C" || k === "D") && (!species || species === k);
    return false;
  };
  const sp = (k) => {
    const i = "ABCD".indexOf(k); const s = SPECIES[i]; const on = pressed(k);
    return (
      <button key={k} type="button" className="ct-eq-sp" aria-pressed={on} data-testid={`eq-${k}`} onClick={() => onPick(k)}
        style={{ "--sp": s.color }} title={`Show the graph of ${s.name}${solid && k === "A" ? " (the solid's sites)" : ""}`} aria-label={`${s.name}: show its curve`}>
        {k}
      </button>
    );
  };
  return (
    <div className="ct-eq" role="group" aria-label="Reaction A + B → C + D. Choose a species to see its curve." data-testid="equation">
      {sp("A")}<span aria-hidden="true">+</span>{sp("B")}
      <button type="button" className="ct-eq-arrow" aria-pressed={pressed("all")} data-testid="eq-arrow" onClick={() => onPick("all")} title="Reactants and products together (the reaction goes one way only)" aria-label="Arrow: show reactants and products together">→</button>
      {sp("C")}<span aria-hidden="true">+</span>{sp("D")}
      <button type="button" className="ct-eq-all" aria-pressed={pressed("all")} data-testid="eq-all" onClick={() => onPick("all")} title="Show reactants and products together">All</button>
    </div>
  );
}
