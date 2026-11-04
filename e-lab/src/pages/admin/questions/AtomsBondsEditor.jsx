import { Plus, X } from "lucide-react";

// Dedicated editor for organic-structure and lewis-structure — both
// share the EXACT same real renderer contract, verified directly against
// OrganicStructure.jsx/LewisStructure.jsx rather than invented:
//   atoms: [{ id, symbol, x, y, implicit? }]
//   bonds: [{ from, to, order, style? }]   (from/to reference atom ids)
const inputCls = "w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";

export default function AtomsBondsEditor({ content, onChange, showOverallCharge = false }) {
  const atoms = Array.isArray(content.atoms) ? content.atoms : [];
  const bonds = Array.isArray(content.bonds) ? content.bonds : [];

  function updateAtom(i, patch) {
    onChange({ ...content, atoms: atoms.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  }
  function addAtom() {
    const id = `a${atoms.length + 1}`;
    onChange({ ...content, atoms: [...atoms, { id, symbol: "C", x: 0, y: 0 }] });
  }
  function removeAtom(i) {
    const removedId = atoms[i].id;
    onChange({
      ...content,
      atoms: atoms.filter((_, j) => j !== i),
      bonds: bonds.filter((b) => b.from !== removedId && b.to !== removedId),
    });
  }

  function updateBond(i, patch) {
    onChange({ ...content, bonds: bonds.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  }
  function addBond() {
    if (atoms.length < 2) return;
    onChange({ ...content, bonds: [...bonds, { from: atoms[0].id, to: atoms[1].id, order: 1 }] });
  }
  function removeBond(i) {
    onChange({ ...content, bonds: bonds.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-4">
      {showOverallCharge && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Overall charge (optional)</label>
          <input className={inputCls} value={content.overallCharge ?? ""} onChange={(e) => onChange({ ...content, overallCharge: e.target.value })} placeholder="e.g. 2-" />
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Atoms</p>
        <div className="space-y-1.5">
          {atoms.map((atom, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input className={`${inputCls} w-14`} placeholder="id" value={atom.id ?? ""} onChange={(e) => updateAtom(i, { id: e.target.value })} />
              <input className={`${inputCls} w-16`} placeholder="Symbol" value={atom.symbol ?? ""} onChange={(e) => updateAtom(i, { symbol: e.target.value })} />
              <input type="number" className={`${inputCls} w-16`} placeholder="x" value={atom.x ?? 0} onChange={(e) => updateAtom(i, { x: Number(e.target.value) })} />
              <input type="number" className={`${inputCls} w-16`} placeholder="y" value={atom.y ?? 0} onChange={(e) => updateAtom(i, { y: Number(e.target.value) })} />
              <label className="flex items-center gap-1 text-[10px] text-[var(--color-ink-faint)]">
                <input type="checkbox" checked={!!atom.implicit} onChange={(e) => updateAtom(i, { implicit: e.target.checked })} /> implicit
              </label>
              <button type="button" onClick={() => removeAtom(i)} className="text-[var(--color-coral)]"><X size={13} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addAtom} className="mt-1.5 text-xs font-medium text-[var(--color-indigo)]"><Plus size={12} className="inline" /> Add Atom</button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Bonds</p>
        <div className="space-y-1.5">
          {bonds.map((bond, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select className={inputCls} value={bond.from ?? ""} onChange={(e) => updateBond(i, { from: e.target.value })}>
                {atoms.map((a) => <option key={a.id} value={a.id}>{a.id} ({a.symbol})</option>)}
              </select>
              <span className="text-xs text-[var(--color-ink-faint)]">\u2192</span>
              <select className={inputCls} value={bond.to ?? ""} onChange={(e) => updateBond(i, { to: e.target.value })}>
                {atoms.map((a) => <option key={a.id} value={a.id}>{a.id} ({a.symbol})</option>)}
              </select>
              <select className={`${inputCls} w-24`} value={bond.order ?? 1} onChange={(e) => updateBond(i, { order: Number(e.target.value) })}>
                <option value={1}>Single</option>
                <option value={2}>Double</option>
                <option value={3}>Triple</option>
              </select>
              <select className={`${inputCls} w-24`} value={bond.style ?? ""} onChange={(e) => updateBond(i, { style: e.target.value || undefined })}>
                <option value="">Plain</option>
                <option value="wedge">Wedge</option>
                <option value="dash">Dash</option>
              </select>
              <button type="button" onClick={() => removeBond(i)} className="text-[var(--color-coral)]"><X size={13} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addBond} disabled={atoms.length < 2} className="mt-1.5 text-xs font-medium text-[var(--color-indigo)] disabled:opacity-40"><Plus size={12} className="inline" /> Add Bond</button>
      </div>
    </div>
  );
}
