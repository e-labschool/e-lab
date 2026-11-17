import { useState } from "react";
import { ABUNDANCE, MIXER_ELEMENTS, averageMass, setAbundance } from "../../../lib/atomic/abundance.js";

const fmt = (x, d = 2) => x.toFixed(d);

/** BA-08: relative atomic mass from isotopic abundance (S1.2). Sliders keep the abundances adding to 100 %. */
export default function IsotopeMixer({ initialZ = 17 }) {
  const [z, setZ] = useState(MIXER_ELEMENTS.includes(initialZ) ? initialZ : 17);
  const el = ABUNDANCE[z];
  const [pcts, setPcts] = useState(() => el.isotopes.map(([, p]) => p));
  const change = (zz) => { setZ(zz); setPcts(ABUNDANCE[zz].isotopes.map(([, p]) => p)); };
  const pairs = el.isotopes.map(([a], i) => [a, pcts[i]]);
  const ar = averageMass(pairs);
  const sum = pairs.map(([a, p]) => `${a} × ${fmt(p, p < 1 ? 3 : 2)}`).join(" + ");
  const max = Math.max(...pcts, 1);
  const natural = pcts.every((p, i) => Math.abs(p - el.isotopes[i][1]) < 0.005);
  return (
    <details className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2.5" data-testid="isotope-mixer">
      <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Isotope mixer: relative atomic mass</summary>
      <div className="mt-2 flex flex-col gap-2 text-xs text-[var(--color-ink)]">
        <label className="flex items-center gap-2 font-semibold">Element
          <select value={z} onChange={(e) => change(Number(e.target.value))} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-xs" aria-label="Element for the isotope mixer">
            {MIXER_ELEMENTS.map((n) => <option key={n} value={n}>{ABUNDANCE[n].name} ({ABUNDANCE[n].symbol})</option>)}
          </select></label>
        <div className="flex h-16 items-end gap-3 border-b border-[var(--color-line)] px-2" role="img" aria-label={`Mass spectrum of ${el.name}: ${pairs.map(([a, p]) => `mass ${a}, ${fmt(p)} percent`).join("; ")}`}>
          {pairs.map(([a, p]) => (
            <div key={a} className="flex flex-1 flex-col items-center justify-end">
              <span className="text-[10px] tabular-nums">{fmt(p, p < 1 ? 3 : 1)}%</span>
              <div className="w-full max-w-[34px] rounded-t bg-[var(--color-indigo)]" style={{ height: `${Math.max(2, (p / max) * 40)}px` }} />
            </div>
          ))}
        </div>
        <div className="flex justify-around text-[10px] text-[var(--color-ink-soft)]">{pairs.map(([a]) => <span key={a}>{a}{el.symbol}</span>)}</div>
        {pairs.map(([a, p], i) => (
          <label key={a} className="flex items-center gap-2">
            <span className="w-14 shrink-0 font-semibold">{el.name.slice(0, 3)}-{a}</span>
            <input type="range" min="0" max="100" step="0.1" value={p} onChange={(e) => setPcts((cur) => setAbundance(cur, i, Number(e.target.value)))} className="min-w-0 flex-1" aria-label={`Abundance of ${el.name}-${a} in percent`} data-testid={`abundance-${a}`} />
            <span className="w-12 text-right tabular-nums">{fmt(p, 1)} %</span>
          </label>
        ))}
        <p className="rounded-md bg-[var(--color-paper)] p-2 tabular-nums" data-testid="mixer-working">
          A<sub>r</sub> = ({sum}) / 100 = <strong>{fmt(ar)}</strong>
        </p>
        <p className="text-[11px] text-[var(--color-ink-soft)]" data-testid="mixer-note">
          {natural ? `Natural abundances give ${fmt(ar)}; the accepted A_r of ${el.name.toLowerCase()} is ${fmt(el.ar)}.` : `Natural ${el.name.toLowerCase()} has A_r = ${fmt(el.ar)}. Your mixture is ${fmt(Math.abs(ar - el.ar))} ${ar > el.ar ? "heavier" : "lighter"}: the heavier isotope contributes more as its abundance rises.`} This uses mass numbers, as the IB does; real isotopic masses are not whole numbers, so the textbook value differs slightly. Abundances: NIST.{" "}
          <a href="/simulation/spectroscopy-studio" target="_blank" rel="noreferrer" className="font-semibold text-[var(--color-indigo)] underline">See a real mass spectrum</a>
        </p>
        <button type="button" onClick={() => change(z)} className="self-start rounded-md border border-[var(--color-line)] px-2 py-1 text-xs font-medium">Reset to natural abundance</button>
      </div>
    </details>
  );
}
