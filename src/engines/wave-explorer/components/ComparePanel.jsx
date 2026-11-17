import { sliderToWavelengthNm, wavelengthNmToSlider, formatWavelength, photonEnergies, drawnWavelengthPx, regionOf } from "../lib/emSpectrum.js";
import { formatScientific } from "../lib/waveMath.js";
import { answerFor, freqHz, formatEv } from "../lib/wavePractice.js";

const KINDS = [
  { id: "energy", label: "Energy" },
  { id: "frequency", label: "Frequency" },
  { id: "wavelength", label: "Wavelength" },
];

function MiniWave({ nm, color, label }) {
  const px = drawnWavelengthPx(nm, "full");
  const k = (2 * Math.PI) / px;
  const d = Array.from({ length: 81 }, (_, i) => { const x = (i / 80) * 300; return `${i ? "L" : "M"}${x.toFixed(1)} ${(16 - 11 * Math.sin(k * x)).toFixed(1)}`; }).join(" ");
  return (
    <svg viewBox="0 0 300 32" className="h-8 w-full" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/** WE-04: two-wave comparison (A = the main wave, B set here) with a predict question whose answer is recomputed from
 * the current numbers, so changing A or B after answering simply clears the result. */
export default function ComparePanel({ aNm, bNm, onB, kind, onKind, guess, onGuess, onNewPair }) {
  const waves = [
    { id: "A", nm: aNm, color: "var(--color-indigo)" },
    { id: "B", nm: bNm, color: "var(--color-coral)" },
  ];
  const q = answerFor(kind, aNm, bNm);
  const shown = guess && guess.aNm === aNm && guess.bNm === bNm && guess.kind === kind ? guess : null;
  const eA = photonEnergies(aNm).eV; const eB = photonEnergies(bNm).eV;
  const same = Math.abs(Math.log10(aNm / bNm)) < 1e-9;
  const why = kind === "wavelength"
    ? `${formatWavelength(aNm)} (A) vs ${formatWavelength(bNm)} (B): the longer wavelength is ${q.answer}.`
    : kind === "frequency"
      ? `f = c/λ, so the shorter wavelength has the higher frequency: A = ${formatScientific(freqHz(aNm), 3)} Hz, B = ${formatScientific(freqHz(bNm), 3)} Hz, so ${q.answer}.`
      : `E = hf = hc/λ, so the shorter wavelength carries more energy per photon: A = ${formatEv(eA, formatScientific)} eV, B = ${formatEv(eB, formatScientific)} eV, so ${q.answer}.`;
  return (
    <section className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3" aria-label="Compare wave A with wave B" data-testid="compare-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Compare two waves: A (set above) and B</p>
        <button type="button" onClick={onNewPair} data-testid="compare-new" className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink-soft)]">New random pair</button>
      </div>
      <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">{"Wave B wavelength (λ) — log scale"}</span>
            <input type="range" min="0" max="1" step="0.001" value={wavelengthNmToSlider(bNm)} onChange={(e) => onB(sliderToWavelengthNm(Number(e.target.value)))} aria-label="Wave B wavelength, logarithmic scale" aria-valuetext={`${formatWavelength(bNm)}, ${regionOf(bNm).label}`} data-testid="compare-b" />
          </label>
          <table className="w-full text-[11px] text-[var(--color-ink-soft)]">
            <thead>
              <tr className="text-left text-[var(--color-ink-faint)]"><th scope="col" className="font-semibold"><span className="sr-only">Quantity</span></th>{waves.map((w) => <th key={w.id} scope="col" className="font-bold" style={{ color: w.color }}>Wave {w.id}</th>)}</tr>
            </thead>
            <tbody>
              <tr><th scope="row" className="text-left font-semibold">{"λ"}</th>{waves.map((w) => <td key={w.id}>{formatWavelength(w.nm)}</td>)}</tr>
              <tr><th scope="row" className="text-left font-semibold">f</th>{waves.map((w) => <td key={w.id}>{formatScientific(freqHz(w.nm), 3)} Hz</td>)}</tr>
              <tr><th scope="row" className="text-left font-semibold">E</th>{waves.map((w) => <td key={w.id}>{formatEv(photonEnergies(w.nm).eV, formatScientific)} eV</td>)}</tr>
              <tr><th scope="row" className="text-left font-semibold">Region</th>{waves.map((w) => <td key={w.id}>{regionOf(w.nm).label}</td>)}</tr>
            </tbody>
          </table>
          <MiniWave nm={aNm} color="var(--color-indigo)" label="Wave A, drawn schematically" />
          <MiniWave nm={bNm} color="var(--color-coral)" label="Wave B, drawn schematically" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1" role="group" aria-label="Question type">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => onKind(k.id)} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${kind === k.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>{k.label}</button>
            ))}
          </div>
          <p className="text-xs font-semibold text-[var(--color-ink)]" data-testid="compare-question">Predict: {q.prompt}</p>
          {same ? (
            <p className="text-[11px] text-[var(--color-ink-soft)]">A and B are identical: move wave B first.</p>
          ) : (
            <div className="flex gap-2">
              {["A", "B"].map((g) => (
                <button key={g} type="button" onClick={() => onGuess({ g, aNm, bNm, kind })} data-testid={`compare-guess-${g}`} aria-pressed={shown?.g === g} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${shown?.g === g ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>Wave {g}</button>
              ))}
            </div>
          )}
          {shown && (
            <p role="status" aria-live="polite" data-testid="compare-result" className="rounded-md bg-[var(--color-paper)] p-2 text-[11px] text-[var(--color-ink)]">
              <strong>{shown.g === q.answer ? "Correct. " : "Not quite. "}</strong>{why}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
