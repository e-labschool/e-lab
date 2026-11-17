import { useMemo, useState } from "react";
import { AVOGADRO_GASES, compareTwoGases, gasById } from "../avogadroGases.js";
import { formatScientific, formatValue, unitLabel } from "../model.js";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";

// Two cylinders, same volume, same P and T, two different gases: the number of molecules is the same, the mass is not.
// Drawn particles are a fixed, deterministic sample (n / 0.05 mol per dot, as in the main chamber), so nothing moves or flickers.
const W = 120; const H = 130;
function dots(count, seed) {
  let a = seed >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const out = []; let tries = 0;
  while (out.length < count && tries++ < 4000) {
    const x = 9 + rnd() * (W - 18), y = 9 + rnd() * (H - 18);
    if (out.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > 150)) out.push({ x, y });
  }
  return out;
}

function Cylinder({ label, gas, count, seed }) {
  const pts = useMemo(() => dots(count, seed), [count, seed]);
  return (
    <svg width="138" height="150" viewBox={`-9 -4 ${W + 18} ${H + 20}`} role="img" aria-label={`Cylinder of ${gas.name}: ${count} drawn particles`} data-testid={`avo-cyl-${label}`}>
      <rect x="0" y="0" width={W} height={H} rx="4" fill="#F4F7FC" stroke="#6B7A99" strokeWidth="2" />
      <rect x="-4" y="-4" width={W + 8} height="9" rx="3" fill="#9AA7C2" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5.5" fill={gas.colour} opacity="0.9" />)}
      <text x={W / 2} y={H + 14} textAnchor="middle" fontSize="12" fontWeight="700" fill="#14226B">{label}: {gas.tag}</text>
    </svg>
  );
}

export default function AvogadroCompare({ state, units }) {
  const [a, setA] = useState("He");
  const [b, setB] = useState("CO2");
  const [guess, setGuess] = useState(null);
  const [shown, setShown] = useState(false);
  const r = compareTwoGases(state, a, b);
  const count = Math.max(1, Math.round(r.n / 0.05));
  const sci = (x) => { const f = formatScientific(x, 2); return <>{f.mantissa} &times; 10<sup>{f.exponent}</sup></>; };
  const row = (k, v) => (
    <tr key={k.gas.id + k.gas.tag} data-testid={`avo-row-${v}`}>
      <th scope="row" className="pr-2 text-left font-semibold">{v}: {k.gas.tag}</th>
      <td className="pr-2 tabular-nums">{k.gas.M.toFixed(2)}</td>
      <td className="pr-2 tabular-nums">{k.n.toFixed(2)}</td>
      <td className="pr-2 tabular-nums" data-testid={`avo-molecules-${v}`}>{sci(k.molecules)}</td>
      <td className="pr-2 tabular-nums" data-testid={`avo-mass-${v}`}>{k.mass.toFixed(1)}</td>
      <td className="tabular-nums">{k.density.toFixed(2)}</td>
    </tr>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto text-[length:var(--sd-fs)] text-[#14226B]" data-testid="avogadro-compare">
      <p className="m-0 text-[length:var(--sd-fs-sm)] text-[#33415F]">
        Two cylinders of the same volume, {formatValue("V", r.V, units)} {unitLabel("V", units)}, at the same pressure ({formatValue("P", r.P, units)} {unitLabel("P", units)}) and temperature ({Math.round(r.T)} K).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Gas A</span>
        <select aria-label="Gas A" value={a} onChange={(e) => setA(e.target.value)} className="rounded border border-[#B8C4E0] bg-white px-1 py-0.5" data-testid="avo-select-A">
          {AVOGADRO_GASES.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.tag})</option>)}
        </select>
        <span className="font-semibold">Gas B</span>
        <select aria-label="Gas B" value={b} onChange={(e) => setB(e.target.value)} className="rounded border border-[#B8C4E0] bg-white px-1 py-0.5" data-testid="avo-select-B">
          {AVOGADRO_GASES.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.tag})</option>)}
        </select>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Cylinder label="A" gas={gasById(a)} count={count} seed={11} />
        <Cylinder label="B" gas={gasById(b)} count={count} seed={29} />
      </div>
      <div className="rounded-lg border border-[#DAE3F3] bg-[#F4F7FC] p-1.5">
        <p className="m-0 font-semibold">Predict: which cylinder holds more molecules?</p>
        <MiniSwitch options={[{ id: "A", label: "A" }, { id: "B", label: "B" }, { id: "same", label: "The same" }]} value={guess} onChange={(g) => { setGuess(g); setShown(false); }} ariaLabel="Your prediction" testId="avo-guess" />
        <button type="button" className="sd-btn sd-btn--sm mt-1" disabled={!guess} onClick={() => setShown(true)} data-testid="avo-reveal">Check</button>
        {shown && (
          <p className="m-0 mt-1" role="status" data-testid="avo-answer">
            {guess === "same" ? "Correct. " : "Not quite. "}
            Equal volumes of any gas at the same temperature and pressure contain the same number of molecules (Avogadro): n = PV/RT = {r.n.toFixed(2)} mol, so {sci(r.A.molecules)} molecules in each.
            The masses differ because the molar masses differ.
          </p>
        )}
      </div>
      <table className="w-full border-collapse text-left text-[length:var(--sd-fs-sm)]" data-testid="avo-table">
        <thead><tr className="text-[#4a5a82]"><th scope="col" className="pr-2">Cylinder</th><th scope="col" className="pr-2">M / g mol&#8315;&sup1;</th><th scope="col" className="pr-2">n / mol</th><th scope="col" className="pr-2">Molecules</th><th scope="col" className="pr-2">Mass / g</th><th scope="col">Density / g dm&#8315;&sup3;</th></tr></thead>
        <tbody>{row(r.A, "A")}{row(r.B, "B")}</tbody>
      </table>
    </div>
  );
}
