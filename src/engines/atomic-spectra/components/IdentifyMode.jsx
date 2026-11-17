import { useState } from "react";
import { SPECTRA } from "../data/spectra.js";
import { makeUnknownSample, checkGuess, clueFor, IDENTIFY_ELEMENTS } from "../lib/identify.js";
import SpectrumDisplay from "./SpectrumDisplay.jsx";

/** AS-05: an unlabelled emission spectrum; the student names the element from the line positions. */
export default function IdentifyMode() {
  const [n, setN] = useState(1); const [guess, setGuess] = useState(null); const [score, setScore] = useState({ right: 0, tried: 0 }); const [counted, setCounted] = useState(false);
  const sample = makeUnknownSample(n); const sp = SPECTRA[sample];
  const pick = (sym) => { setGuess(sym); if (!counted) { setCounted(true); setScore((s) => ({ right: s.right + (sym === sample ? 1 : 0), tried: s.tried + 1 })); } };
  const r = guess ? checkGuess(sample, guess) : null;
  return (
    <div className="flex flex-col gap-2" data-testid="identify-mode">
      <p className="text-center text-xs text-[var(--color-ink-soft)]">An unknown discharge lamp is excited. Use the line positions (compare them with the other elements in the Emission view) to name the gas. {score.tried ? <strong className="text-[var(--color-ink)]">{score.right} of {score.tried} first guesses right.</strong> : null}</p>
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Emission spectrum of the unknown sample</p>
        <SpectrumDisplay lines={sp.lines} mode="emission" elementLabel="Unknown sample" medium={sp.medium} />
        <p className="mt-1 text-center text-[11px] text-[var(--color-ink-soft)]">{clueFor(sample)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Which element is it?">
        {IDENTIFY_ELEMENTS.map((sym) => (
          <button key={sym} type="button" onClick={() => pick(sym)} aria-pressed={guess === sym} data-testid={`guess-${sym}`} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${guess === sym ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>{SPECTRA[sym].name}</button>
        ))}
      </div>
      <p role="status" className="min-h-[1.4em] text-center text-xs font-semibold" style={{ color: r?.ok ? "var(--color-teal)" : "var(--color-coral)" }} data-testid="identify-result">
        {r ? (r.ok ? `Correct: it is ${r.name}.` : `Not ${SPECTRA[guess].name}. Compare the strongest lines again.`) : ""}
      </p>
      <div className="flex justify-center"><button type="button" onClick={() => { setN((x) => x + 1); setGuess(null); setCounted(false); }} data-testid="identify-next" className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-soft)]">New sample</button></div>
    </div>
  );
}
