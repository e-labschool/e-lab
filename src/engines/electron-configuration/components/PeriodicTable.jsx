import { useMemo, useRef, useState } from "react";
import elements from "../../../data/chemistry/elements.js";

const BLOCK_VAR = { s: "var(--color-block-s)", p: "var(--color-block-p)", d: "var(--color-block-d)", f: "var(--color-block-f)" };
const IB_SCOPE_Z = 36;

function cellPosition(el) {
  if (el.block === "f") return { col: 3 + (el.atomicNumber - (el.atomicNumber < 90 ? 58 : 90)), row: el.atomicNumber < 90 ? 9 : 10 };
  return { col: el.group, row: el.period };
}

/** Compact picker. Roving tabindex + arrow keys (grid-aware), Home/End, shows group and period headers, block colours and the
 * Z <= 36 "IB scope" shading. A group of toggle buttons (valid ARIA: role=group, aria-pressed). */
export default function PeriodicTable({ selected, onSelect, onPicked }) {
  const cells = useMemo(() => elements.map((el) => ({ el, ...cellPosition(el) })), []);
  const refs = useRef({});
  const [focusZ, setFocusZ] = useState(selected);

  function move(from, dc, dr) {
    const cur = cells.find((c) => c.el.atomicNumber === from);
    if (!cur) return;
    let best = null; let bestScore = Infinity;
    for (const c of cells) {
      const dcol = c.col - cur.col; const drow = c.row - cur.row;
      if (dc !== 0 && (drow !== 0 || Math.sign(dcol) !== dc)) continue; // horizontal: same row, nearest column that way
      if (dr !== 0 && Math.sign(drow) !== dr) continue; // vertical: nearest row that way, nearest column
      const score = dc !== 0 ? Math.abs(dcol) : Math.abs(drow) * 100 + Math.abs(dcol);
      if (score < bestScore) { bestScore = score; best = c; }
    }
    if (best) { setFocusZ(best.el.atomicNumber); refs.current[best.el.atomicNumber]?.focus(); }
  }
  function onKey(e, z) {
    const map = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (map[e.key]) { e.preventDefault(); move(z, ...map[e.key]); }
    else if (e.key === "Home") { e.preventDefault(); setFocusZ(1); refs.current[1]?.focus(); }
    else if (e.key === "End") { e.preventDefault(); setFocusZ(118); refs.current[118]?.focus(); }
  }

  return (
    <div className="max-w-full overflow-x-auto" data-testid="ec-periodic-table">
      <div className="relative grid min-w-[520px] gap-[2px]" style={{ gridTemplateColumns: "18px repeat(18, minmax(0, 1fr))", gridTemplateRows: "16px repeat(10, auto)" }} role="group" aria-label="Periodic table: arrow keys move between elements, Enter selects">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={`g${i}`} className="text-center text-[10px] font-semibold text-[var(--color-ink-soft)]" style={{ gridColumn: i + 2, gridRow: 1 }} aria-hidden="true">{i + 1}</span>
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <span key={`p${i}`} className="flex items-center justify-center text-[10px] font-semibold text-[var(--color-ink-soft)]" style={{ gridColumn: 1, gridRow: i + 2 }} aria-hidden="true">{i + 1}</span>
        ))}
        {cells.map(({ el, col, row }) => {
          const z = el.atomicNumber; const isSel = z === selected; const inScope = z <= IB_SCOPE_Z;
          return (
            <button
              key={z} type="button" ref={(n) => { refs.current[z] = n; }}
              tabIndex={z === focusZ ? 0 : -1}
              onFocus={() => setFocusZ(z)}
              onKeyDown={(e) => onKey(e, z)}
              onClick={() => { onSelect(z); onPicked?.(z); }}
              aria-pressed={isSel}
              aria-label={`${el.name}, atomic number ${z}, ${el.block}-block${inScope ? "" : ", beyond the IB course range"}`}
              title={`${el.name} (Z = ${z}, ${el.block}-block${el.group ? `, group ${el.group}` : ""}, period ${el.period})`}
              data-z={z}
              style={{ gridColumn: col + 1, gridRow: row + 1, borderColor: isSel ? "var(--color-ink)" : undefined, borderBottom: isSel ? undefined : `3px solid ${BLOCK_VAR[el.block]}`, opacity: inScope || isSel ? 1 : 0.72 }}
              className={`flex h-8 min-w-0 flex-col items-center justify-center rounded-[3px] border text-[11px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-indigo)] ${isSel ? "border-2 bg-[var(--color-ink)] text-[var(--color-paper)]" : "border-[var(--color-line-strong,var(--color-line))] text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]"}`}
            >
              <span className="text-[9px] opacity-75">{z}</span>
              <span className="text-[12px] font-semibold">{el.symbol}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-[var(--color-ink-soft)]">
        {["s", "p", "d", "f"].map((b) => <span key={b} className="flex items-center gap-1"><span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: BLOCK_VAR[b] }} aria-hidden="true" />{b}-block</span>)}
        <span>Elements beyond Z = 36 are outside the IB course (shown paler).</span>
      </p>
    </div>
  );
}
