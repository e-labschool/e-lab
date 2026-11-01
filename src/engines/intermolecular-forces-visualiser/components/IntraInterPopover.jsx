import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { HeaderPopover } from "../../../components/simulation/SimulationDashboard.jsx";

// "Intra vs Inter": a compact popover. Intramolecular bonding = forces inside molecules or extended structures (covalent / ionic /
// metallic); intermolecular forces = attractions BETWEEN separate molecules. Ionic and metallic solids are extended structures, not
// collections of discrete molecules, and the text says so. The link opens the existing Bonding Visualizer instead of rebuilding it.
const BONDS = {
  covalent: { label: "Covalent", example: "O–H bonds in H₂O", text: "Atoms share electron pairs inside a molecule. The two O–H bonds in one H₂O molecule stay intact when water melts or boils." },
  ionic: { label: "Ionic", example: "NaCl lattice", text: "Oppositely charged ions attract in an extended 3D lattice. NaCl is a giant ionic lattice, not made of separate NaCl molecules." },
  metallic: { label: "Metallic", example: "copper", text: "Positive metal ion cores are attracted to a sea of delocalised electrons. A metal is an extended structure too, not discrete molecules." },
};
function BondSketch({ kind }) {
  if (kind === "covalent") return (<svg viewBox="0 0 64 44" aria-hidden="true"><line x1="32" y1="14" x2="14" y2="30" stroke="#cdd5e8" strokeWidth="3" /><line x1="32" y1="14" x2="50" y2="30" stroke="#cdd5e8" strokeWidth="3" /><circle cx="32" cy="14" r="9" fill="#e2392f" /><circle cx="14" cy="31" r="6" fill="#f2f4f8" /><circle cx="50" cy="31" r="6" fill="#f2f4f8" /><ellipse cx="22" cy="22" rx="3.2" ry="1.6" fill="#7fd3ff" transform="rotate(40 22 22)" /><ellipse cx="42" cy="22" rx="3.2" ry="1.6" fill="#7fd3ff" transform="rotate(-40 42 22)" /></svg>);
  if (kind === "ionic") return (<svg viewBox="0 0 64 44" aria-hidden="true">{[0, 1, 2, 3].map((i) => [0, 1, 2].map((j) => <circle key={`${i}${j}`} cx={12 + i * 13} cy={9 + j * 13} r={(i + j) % 2 ? 5.2 : 4} fill={(i + j) % 2 ? "#2f9d57" : "#ab5cf2"} />))}</svg>);
  return (<svg viewBox="0 0 64 44" aria-hidden="true">{[0, 1, 2].map((i) => [0, 1].map((j) => <circle key={`${i}${j}`} cx={14 + i * 18} cy={13 + j * 18} r="6.5" fill="#d98a4b" />))}{[[8, 22], [22, 8], [31, 24], [40, 36], [50, 20], [56, 8], [26, 36], [46, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.8" fill="#8fe3ff" />)}</svg>);
}
const INTER = [
  ["London dispersion", "between all atoms and molecules (temporary dipoles)"],
  ["Dipole–induced dipole", "a permanent dipole polarises a neighbouring electron cloud"],
  ["Dipole–dipole", "between molecules with permanent dipoles"],
  ["Hydrogen bonding", "a particularly strong, directional dipole–dipole interaction: H bonded to N, O or F meets a lone pair on N, O or F of another molecule"],
];

export default function IntraInterPopover() {
  const [sel, setSel] = useState("covalent");
  return (
    <HeaderPopover label="Intra vs Inter" testId="intra-inter" panelTestId="intra-inter-panel" width={400} small>
      <div className="imf-ii">
        <section aria-labelledby="imf-ii-intra">
          <h4 id="imf-ii-intra">Intramolecular bonding <small>holds atoms or ions together inside molecules or extended structures</small></h4>
          <div className="imf-ii-bonds" role="radiogroup" aria-label="Types of chemical bonding">
            {Object.entries(BONDS).map(([k, b]) => (
              <button key={k} type="button" role="radio" aria-checked={sel === k} className="imf-ii-bond" onClick={() => setSel(k)} data-testid={`ii-${k}`}>
                <BondSketch kind={k} /><b>{b.label}</b><span>{b.example}</span>
              </button>
            ))}
          </div>
          <p className="imf-ii-text" aria-live="polite" data-testid="ii-text">{BONDS[sel].text}</p>
          <a className="sim-btn imf-ii-link" href="/simulation/bonding-visualizer" target="_blank" rel="noopener noreferrer" data-testid="ii-link"><ExternalLink size={13} aria-hidden="true" /> Open the Bonding Visualizer</a>
        </section>
        <section aria-labelledby="imf-ii-inter">
          <h4 id="imf-ii-inter">Intermolecular forces <small>attractions between separate molecules</small></h4>
          <ul>{INTER.map(([n, d]) => <li key={n}><b>{n}</b> – {d}</li>)}</ul>
        </section>
      </div>
    </HeaderPopover>
  );
}
