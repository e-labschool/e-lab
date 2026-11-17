import { useState } from "react";
import { SERIES, seriesLines, seriesLimitNm, ionisationFromLevelKJ, checkLimit, seriesRegion } from "../lib/series.js";
import { classifyRegion } from "../lib/photonMath.js";
import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import { vacuumToAirNm } from "../lib/airVacuum.js";

const REGION_COLOUR = { ultraviolet: "#7c5cd6", visible: "#2b8a6e", infrared: "#b4472f" };
const W = 640; const H = 120;

/** Series chips + convergence plot + "find the limit" activity (S1.3.2). Positions are linear in 1/wavelength-free nm over the series' own range, so the
 * lines visibly crowd together toward the limit. */
export default function SeriesView() {
  const [id, setId] = useState("balmer");
  const [count, setCount] = useState(6);
  const [guess, setGuess] = useState(""); const [res, setRes] = useState(null);
  const s = SERIES.find((x) => x.id === id);
  const lines = seriesLines(s.nLow, count); const limit = seriesLimitNm(s.nLow);
  const first = lines[0].nm; const lo = limit * 0.97; const hi = first * 1.03;
  const x = (nm) => 24 + ((nm - lo) / (hi - lo)) * (W - 48);
  const region = seriesRegion(s.nLow);
  const tryGuess = () => { const v = Number(String(guess).replace(",", ".")); if (!(v > 0)) { setRes({ msg: "Type a wavelength in nm, for example 365." }); return; } const r = checkLimit(s.nLow, v); setRes(r.ok ? { ok: true, msg: `Correct: the limit is ${r.target.toFixed(1)} nm. Energy to remove an electron from n = ${s.nLow}: ${ionisationFromLevelKJ(s.nLow).toFixed(0)} kJ mol⁻¹${s.nLow === 1 ? ", the first ionisation energy of hydrogen (compare 1312 in the Ionization Energy Explorer)." : "."}` } : { msg: `Not within 1 %. You are ${r.err > 0 ? "above" : "below"} the limit: the lines crowd together as n grows, so the limit is just shorter than the shortest line you can see (${lines[lines.length - 1].nm.toFixed(1)} nm).` }); };
  return (
    <div className="flex flex-col gap-3" data-testid="series-view">
      <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Hydrogen line series">
        {SERIES.map((x2) => (
          <button key={x2.id} type="button" aria-pressed={id === x2.id} onClick={() => { setId(x2.id); setRes(null); setGuess(""); }} data-testid={`series-${x2.id}`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${id === x2.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            {x2.name} (n → {x2.nLow})
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-1 text-center text-xs text-[var(--color-ink-soft)]"><strong className="text-[var(--color-ink)]">{s.name} series</strong>: electrons falling to n = {s.nLow}. Region: <span className="font-semibold" style={{ color: REGION_COLOUR[region] ?? "var(--color-ink)" }}>{region}</span>. Lines crowd together and converge to the series limit.</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${s.name} series: ${lines.map((l) => `n = ${l.n} at ${l.nm.toFixed(1)} nm`).join(", ")}; series limit ${limit.toFixed(1)} nm`}>
          <rect x="0" y="22" width={W} height="62" rx="4" fill={REGION_COLOUR[classifyRegion(first)] ?? "#444"} opacity="0.12" />
          {lines.map((l, i) => (
            <g key={l.n}>
              <line x1={x(l.nm)} x2={x(l.nm)} y1="24" y2="82" stroke={l.region === "visible" ? wavelengthToCSS(l.nm) : REGION_COLOUR[l.region]} strokeWidth="2.5" />
              {(i < 3 || i === lines.length - 1) && <text x={x(l.nm)} y="16" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-ink)">{l.nm.toFixed(l.nm < 100 ? 1 : 0)}</text>}
              {i < 3 && <text x={x(l.nm)} y="98" textAnchor="middle" fontSize="10" fill="var(--color-ink-soft)">{l.n}→{s.nLow}</text>}
            </g>
          ))}
          <line x1={x(limit)} x2={x(limit)} y1="20" y2="86" stroke="var(--color-ink)" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={x(limit) + 4} y="112" fontSize="11" fontWeight="700" fill="var(--color-ink)">limit {limit.toFixed(1)} nm → ionisation energy</text>
          <text x={W - 6} y="112" textAnchor="end" fontSize="10" fill="var(--color-ink-soft)">wavelength / nm (vacuum), increasing →</text>
        </svg>
        <label className="mt-1 flex items-center justify-center gap-2 text-xs text-[var(--color-ink-soft)]">Lines shown
          <input type="range" min="2" max="14" value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="Number of lines shown" data-testid="series-count" /> {count}
        </label>
        {region === "visible" && <p className="mt-1 text-center text-[11px] text-[var(--color-ink-soft)]">In air the first Balmer line is Hα = {vacuumToAirNm(lines[0].nm).toFixed(2)} nm (vacuum {lines[0].nm.toFixed(2)} nm).</p>}
      </div>
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-xs">
        <p className="mb-1.5 font-semibold text-[var(--color-ink)]">Find the limit</p>
        <p className="text-[var(--color-ink-soft)]">Look at how the gap between lines shrinks. Estimate the wavelength where the {s.name} lines converge, then check. (E = hc/λ gives the energy to remove the electron from n = {s.nLow}.)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="text" inputMode="decimal" value={guess} onChange={(e) => { setGuess(e.target.value); setRes(null); }} onKeyDown={(e) => e.key === "Enter" && tryGuess()} placeholder="limit / nm" aria-label="Your estimate of the series limit in nanometres" data-testid="series-guess" className="w-28 rounded-md border border-[var(--color-line-strong,var(--color-line))] bg-[var(--color-paper)] px-2 py-1 text-xs" />
          <button type="button" onClick={tryGuess} data-testid="series-check" className="rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white">Check</button>
        </div>
        <p role="status" className="mt-1.5 min-h-[1.2em] font-semibold" style={{ color: res?.ok ? "var(--color-teal)" : "var(--color-ink)" }} data-testid="series-result">{res?.msg}</p>
      </div>
    </div>
  );
}
