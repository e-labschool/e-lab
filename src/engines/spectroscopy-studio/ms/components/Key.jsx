import { M_COLOR } from "../data/molecules.js";
import { shapePath } from "./shapes.js";

const Sw = ({ children, w = 34 }) => <svg width={w} height="26" viewBox={`0 0 ${w} 26`} aria-hidden="true" className="ms-keysvg">{children}</svg>;
/** The four kinds of particle and how to tell them apart WITHOUT colour: ring shape, ring line style and the charge badge. */
export default function Key({ compact = false }) {
  const items = [
    { id: "neutral", label: "Neutral molecule", sub: "no ring · badge 0", art: <Sw><circle cx="17" cy="13" r="9" fill="#58648a" opacity="0.65" /></Sw> },
    { id: "molion", label: "Molecular ion M⁺•", sub: "solid circle · badge +•", art: <Sw><circle cx="17" cy="13" r="10" fill={`${M_COLOR}22`} stroke={M_COLOR} strokeWidth="2.6" /></Sw> },
    { id: "frag", label: "Charged fragment", sub: "own shape · badge +", art: <Sw><path d={shapePath("hexagon", 17, 13, 10)} fill="#2dd4bf22" stroke="#2dd4bf" strokeWidth="2.6" /></Sw> },
    { id: "nfrag", label: "Neutral fragment", sub: "dashed ring · badge 0", art: <Sw><circle cx="17" cy="13" r="10" fill="none" stroke="#aab6d6" strokeWidth="2" strokeDasharray="5 3" /></Sw> },
  ];
  return (
    <ul className={`ms-key${compact ? " is-compact" : ""}`} aria-label="Key to the particles" data-testid="particle-key">
      {items.map((it) => <li key={it.id} data-key={it.id}>{it.art}<span><b>{it.label}</b><i>{it.sub}</i></span></li>)}
    </ul>
  );
}
