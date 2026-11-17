import { useMemo, useState } from "react";
import { useMode } from "../../context/ModeContext.jsx";
import { buildConfiguration } from "./logic/buildConfiguration.js";
import PeriodicTable from "./components/PeriodicTable.jsx";
import ElementSearch from "./components/ElementSearch.jsx";
import StudentFlow from "./student/StudentFlow.jsx";
import TeacherFlow from "./teacher/TeacherFlow.jsx";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { chargeLimits, chargeRefusal } from "../../lib/atomic/ions.js";
import { speciesLabel, formatCharge } from "../../lib/atomic/format.js";

const DEFAULT_ATOMIC_NUMBER = 26; // iron: the Fe / Fe2+ / Fe3+ story is the classic IB case.
const ION_MAX_Z = 36; // S1.3.5: configurations of atoms and ions to Z = 36
const EXAMPLES = [
  { label: "Cr", z: 24, q: 0 }, { label: "Cu", z: 29, q: 0 }, { label: "Fe²⁺", z: 26, q: 2 }, { label: "Fe³⁺", z: 26, q: 3 },
  { label: "Cu⁺", z: 29, q: 1 }, { label: "Zn²⁺", z: 30, q: 2 }, { label: "O²⁻", z: 8, q: -2 },
];

// The mode-agnostic orchestrator: owns the chemistry state (element, charge). It never imports curriculum data.
export default function ElectronConfigurationExplorer({ compact = false, standalone = false }) {
  const { mode } = useMode();
  const [z, setZ] = useState(DEFAULT_ATOMIC_NUMBER);
  const [charge, setCharge] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [history, setHistory] = useState([]); // EC-10: species the student has checked this session (survives element changes)

  const config = useMemo(() => buildConfiguration(z, charge), [z, charge]);
  const ionsAllowed = z <= ION_MAX_Z;
  const limits = chargeLimits(z);

  function selectElement(next) {
    setZ(next);
    const lim = chargeLimits(next);
    if (next > ION_MAX_Z || charge > lim.maxCharge || charge < lim.minCharge) {
      if (charge !== 0) setNotice(`Charge reset to neutral: ${charge > 0 ? "this element does not form that ion." : "this element does not form that ion."}`);
      setCharge(0);
    } else setNotice(null);
    setPickerOpen(false);
  }
  function stepCharge(d) {
    const next = charge + d;
    if (!ionsAllowed) { setNotice(`Ions are covered up to Z = ${ION_MAX_Z} (the IB course range).`); return; }
    const refusal = chargeRefusal(z, next);
    if (refusal) { setNotice(refusal); return; }
    setNotice(null); setCharge(next);
  }
  function pickExample(ex) { setZ(ex.z); setCharge(ex.q); setNotice(null); setPickerOpen(false); }

  const species = speciesLabel(config.element.symbol, charge);
  const btn = "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-line-strong,var(--color-line))] text-base font-bold text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-indigo)] disabled:opacity-40";

  const body = (
    <div className="flex flex-col gap-4" data-testid="ec-root">
      <style>{`@keyframes ec-drop { from { opacity: 0; transform: translateY(-8px) scale(0.8); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { [data-testid="ec-root"] * { animation: none !important; transition: none !important; } }`}</style>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3" data-testid="ec-species-bar">
        <div className="min-w-0">
          <p className="font-[var(--font-display)] text-xl font-semibold leading-tight text-[var(--color-ink)]" data-testid="ec-species">{config.element.name}{charge ? ` ion, ${species}` : ""}</p>
          <p className="font-[var(--font-mono)] text-xs text-[var(--color-ink-soft)]">
            {config.element.symbol} &middot; Z = {z} &middot; {config.element.block}-block &middot; {config.electrons} electron{config.electrons === 1 ? "" : "s"}
            {config.isException && " · exception to Aufbau"}
          </p>
        </div>
        <button type="button" onClick={() => setPickerOpen((o) => !o)} aria-expanded={pickerOpen} data-testid="ec-change-element"
          className="rounded-md border border-[var(--color-indigo)] px-3 py-1.5 text-sm font-semibold text-[var(--color-indigo)] hover:bg-[var(--color-indigo-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-indigo)]">
          {pickerOpen ? "Hide periodic table" : "Change element"}
        </button>
        <div className="flex items-center gap-1.5" role="group" aria-label="Charge of the ion">
          <span className="text-xs text-[var(--color-ink-soft)]">Charge</span>
          <button type="button" className={btn} onClick={() => stepCharge(-1)} aria-label="Decrease charge" data-testid="ec-charge-minus">−</button>
          <span className="w-10 text-center text-sm font-bold tabular-nums text-[var(--color-ink)]" data-testid="ec-charge" aria-live="polite">{formatCharge(charge, { explicit1: true })}</span>
          <button type="button" className={btn} onClick={() => stepCharge(1)} aria-label="Increase charge" data-testid="ec-charge-plus">+</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1" aria-label="Examples">
          <span className="text-xs text-[var(--color-ink-soft)]">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" onClick={() => pickExample(ex)} data-testid={`ec-ex-${ex.label}`} className="rounded-full border border-[var(--color-line-strong,var(--color-line))] px-2 py-0.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-indigo)]">{ex.label}</button>
          ))}
        </div>
      </div>
      <div role="status" aria-live="polite" data-testid="ec-notice">{notice && <p className="rounded-md border border-[var(--color-amber)] px-2 py-1 text-xs text-[var(--color-ink)]">{notice}</p>}</div>
      {!ionsAllowed && <p className="text-[11px] text-[var(--color-ink-soft)]">Ions are offered for Z ≤ 36 (S1.3.5). Beyond that only neutral atoms are shown.</p>}
      {ionsAllowed && <p className="text-[11px] text-[var(--color-ink-soft)]">{config.element.name} forms ions from {limits.minCharge === 0 ? "0" : `${-limits.minCharge}−`} to {limits.maxCharge === 0 ? "0" : `${limits.maxCharge}+`}.</p>}

      {pickerOpen && (
        <div className="rounded-xl border border-[var(--color-line)] p-3" data-testid="ec-picker">
          <div className="mb-2"><ElementSearch onSelect={selectElement} /></div>
          <PeriodicTable selected={z} onSelect={selectElement} />
        </div>
      )}

      {mode === "student" && history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-ink-soft)]" data-testid="ec-progress" aria-label="Species you have checked this session">
          <span className="font-semibold text-[var(--color-ink)]">This session: {history.filter((h) => h.correct).length} of {history.length} correct</span>
          {history.map((h) => <span key={h.key} className="rounded-full border px-2 py-0.5 font-semibold" style={{ borderColor: h.correct ? "var(--color-teal)" : "var(--color-coral)", color: h.correct ? "var(--color-teal)" : "var(--color-coral)" }}>{h.correct ? "✓" : "✗"} {h.label}</span>)}
          <button type="button" onClick={() => setHistory([])} className="underline">Clear history</button>
        </div>
      )}

      {mode === "student" ? <StudentFlow key={`${z}:${charge}`} config={config} onChecked={(correct) => setHistory((h) => [...h.filter((x) => x.key !== `${z}:${charge}`), { key: `${z}:${charge}`, label: species, correct }])} /> : <TeacherFlow key={`${z}:${charge}`} config={config} />}
    </div>
  );

  return (
    <InteractiveFrame title="Electron Configuration Explorer" subtitle="Build configurations of atoms and ions, one electron at a time" compact={compact} standalone={standalone}>
      {body}
    </InteractiveFrame>
  );
}
