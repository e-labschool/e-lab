import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { newBuilder, place, removeFrom, totalPlaced, countInSubshell, diagnose, hint, parseKey } from "../../../lib/atomic/electronBuilder.js";
import { SUBSHELL_CAPACITY, orbitalBoxes, fillingOrder, subshellLabel } from "../../../lib/atomic/electronConfiguration.js";
import { buildConfiguration } from "../logic/buildConfiguration.js";
import { useReducedMotion } from "../logic/useReducedMotion.js";

const MAX_SHELL = 7;
const ARROW = { up: "↑", down: "↓" };
const sup = (n) => String(n).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);

function shellsToShow(config) {
  const maxN = Math.max(1, ...config.subshellsDisplayOrder.map((s) => s.n));
  return Math.min(MAX_SHELL, maxN + 1); // one extra shell of decoys, so the answer is never implied by what is offered
}

/** Electron-by-electron builder. The student chooses the subshell, the orbital and the spin. Pauli exclusion and Hund's rule are
 * enforced with explained refusals; Aufbau, capacity-per-subshell choices, ion removal order and the Cr/Cu exceptions are judged
 * by Check, with the reason. Nothing about the answer is displayed before the student has tried (hints are opt-in, graded). */
export default function BuilderFlow({ z, charge, config }) {
  const reduced = useReducedMotion();
  const [animate, setAnimate] = useState(!reduced);
  const shells = shellsToShow(config);
  const [state, setState] = useState(() => newBuilder(z, charge, Array.from({ length: shells }, (_, i) => i + 1)));
  const [tool, setTool] = useState("up"); // "up" | "down" | "remove"
  const [msg, setMsg] = useState(null);
  const [result, setResult] = useState(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [lastKey, setLastKey] = useState(null);
  const gridRef = useRef(null);

  const placed = totalPlaced(state);
  const need = state.electrons;
  const done = placed === need;
  const rows = useMemo(() => {
    const byN = {};
    for (const key of Object.keys(state.boxes)) { const { n } = parseKey(key); (byN[n] ??= []).push(key); }
    return Object.entries(byN).map(([n, keys]) => ({ n: Number(n), keys }));
  }, [state.boxes]);

  function act(key, index) {
    setResult(null);
    if (tool === "remove") {
      if (!state.boxes[key][index].length) { setMsg({ kind: "info", text: "That orbital is empty." }); return; }
      setState((s) => removeFrom(s, key, index)); setMsg(null); setLastKey(null); return;
    }
    const r = place(state, key, index, tool);
    if (!r.ok) { setMsg({ kind: "rule", rule: r.violation.rule, text: r.violation.message }); return; }
    setState(r.state); setMsg(null); setLastKey(`${key}:${index}`);
  }
  function onBoxKey(e, key, index) {
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); setResult(null); if (state.boxes[key][index].length) { setState((s) => removeFrom(s, key, index)); setMsg(null); } return; }
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    if (!arrows.includes(e.key)) return;
    e.preventDefault();
    const flat = [...gridRef.current.querySelectorAll("[data-orbital]")];
    const i = flat.indexOf(e.currentTarget);
    if (e.key === "ArrowRight") flat[Math.min(i + 1, flat.length - 1)]?.focus();
    else if (e.key === "ArrowLeft") flat[Math.max(i - 1, 0)]?.focus();
    else {
      const rowKeyList = rows.flatMap((r) => r.keys);
      const curRow = rowKeyList.indexOf(key); const target = rowKeyList[curRow + (e.key === "ArrowDown" ? 1 : -1)];
      if (target) gridRef.current.querySelector(`[data-orbital="${target}:${Math.min(index, state.boxes[target].length - 1)}"]`)?.focus();
    }
  }
  function check() { setResult(diagnose(state)); }
  function clearAll() { setState(newBuilder(z, charge, Array.from({ length: shells }, (_, i) => i + 1))); setMsg(null); setResult(null); setLastKey(null); setHintLevel(0); }
  const hintText = hintLevel > 0 ? hint(state, hintLevel).text : null;
  const correct = result?.correct;
  const failedOnce = result && !result.correct && result.complete;

  return (
    <div className="flex flex-col gap-3" data-testid="ec-builder">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Place all <strong className="text-[var(--color-ink)]" data-testid="ec-need">{need}</strong> electron{need === 1 ? "" : "s"} of {config.element.name}{charge ? ` with charge ${charge > 0 ? charge : -charge}${charge > 0 ? "+" : "−"}` : ""}. You choose the subshell, the orbital and the spin.
        </p>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
          Predict: unpaired electrons
          <select value={guess} onChange={(e) => setGuess(e.target.value)} aria-label="Prediction: number of unpaired electrons" data-testid="ec-predict" className="rounded border border-[var(--color-line-strong,var(--color-line))] bg-transparent px-1 py-0.5 text-xs text-[var(--color-ink)]">
            <option value="">?</option>
            {Array.from({ length: 8 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
      </div>

      <div role="radiogroup" aria-label="What a click does" className="flex flex-wrap items-center gap-1.5">
        {[["up", "Place ↑ (spin up)"], ["down", "Place ↓ (spin down)"], ["remove", "Remove electron"]].map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={tool === v} onClick={() => setTool(v)} data-testid={`ec-tool-${v}`}
            className={"rounded-md border px-2.5 py-1 text-xs font-medium " + (tool === v ? "border-[var(--color-indigo)] bg-[var(--color-indigo)] text-white" : "border-[var(--color-line-strong,var(--color-line))] text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]")}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold tabular-nums text-[var(--color-ink)]" data-testid="ec-total" aria-live="polite">Placed {placed} / {need}</span>
        <label className="flex items-center gap-1 text-[11px] text-[var(--color-ink-soft)]"><input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />Animate</label>
      </div>

      <div ref={gridRef} className="flex flex-col gap-1 overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2" data-testid="ec-grid" role="group" aria-label="Orbitals by shell. Arrow keys move; Enter or Space places an electron; Backspace removes one.">
        {rows.map((row) => (
          <div key={row.n} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-dashed border-[var(--color-line)] pb-1 last:border-0">
            <span className="w-9 shrink-0 text-[11px] font-semibold text-[var(--color-ink-soft)]">n = {row.n}</span>
            {row.keys.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <span className="w-7 shrink-0 font-[var(--font-mono)] text-xs text-[var(--color-ink)]">{key}</span>
                <div className="flex gap-1">
                  {state.boxes[key].map((orb, i) => {
                    const k = `${key}:${i}`;
                    return (
                      <button key={i} type="button" data-orbital={k} data-electrons={orb.length}
                        onClick={() => act(key, i)} onKeyDown={(e) => onBoxKey(e, key, i)}
                        onContextMenu={(e) => { e.preventDefault(); setResult(null); setState((s) => removeFrom(s, key, i)); }}
                        aria-label={`${key} orbital ${i + 1} of ${state.boxes[key].length}: ${orb.length === 0 ? "empty" : orb.map((s) => `${s} arrow`).join(", ")}`}
                        className={"flex h-8 w-8 items-center justify-center gap-[1px] rounded-sm border text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-indigo)] " + (orb.length ? "border-[var(--color-ink-soft)] bg-[var(--color-paper)]" : "border-[var(--color-line-strong,var(--color-line))] hover:bg-[var(--color-indigo-soft)]")}>
                        {orb.map((s, j) => (
                          <span key={j} className="font-bold leading-none text-[var(--color-ink)]" style={animate && lastKey === k && j === orb.length - 1 ? { animation: "ec-drop 180ms ease-out" } : undefined}>{ARROW[s]}</span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div role="status" aria-live="polite" className="min-h-[1.25rem] text-xs" data-testid="ec-message">
        {msg && <p className={"rounded-md border px-2 py-1 text-[var(--color-ink)] " + (msg.kind === "rule" ? "border-[var(--color-coral)]" : "border-[var(--color-line)]")}><strong>{msg.rule ? `${msg.rule}: ` : ""}</strong>{msg.text}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={check} disabled={!done} aria-describedby="ec-check-why" data-testid="ec-check" className="rounded-md bg-[var(--color-indigo)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Check my configuration</button>
        <button type="button" onClick={clearAll} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-strong,var(--color-line))] px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]"><RotateCcw size={14} aria-hidden="true" />Clear</button>
        <button type="button" onClick={() => setHintLevel((l) => Math.min(l + 1, 3))} className="inline-flex items-center gap-1 rounded-md border border-[var(--color-line-strong,var(--color-line))] px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]" data-testid="ec-hint"><Lightbulb size={14} aria-hidden="true" />{hintLevel === 0 ? "Hint" : "More help"}</button>
        {failedOnce && !revealed && <button type="button" onClick={() => setRevealed(true)} className="rounded-md border border-[var(--color-line-strong,var(--color-line))] px-3 py-2 text-sm text-[var(--color-ink)] hover:bg-[var(--color-indigo-soft)]" data-testid="ec-reveal">Show me the answer</button>}
      </div>
      <p id="ec-check-why" className="text-[11px] text-[var(--color-ink-soft)]">{done ? "Ready to check." : `Check unlocks when all ${need} electron${need === 1 ? " is" : "s are"} placed (you have ${placed}).`}</p>
      {hintText && <p className="rounded-md border border-[var(--color-amber)] px-2 py-1 text-xs text-[var(--color-ink)]" data-testid="ec-hint-text">{hintText}</p>}

      {result && (
        <div role="status" className="rounded-lg border p-3 text-sm" style={{ borderColor: correct ? "var(--color-teal)" : "var(--color-coral)" }} data-testid="ec-result">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--color-ink)]">{correct ? <Check size={16} className="text-[var(--color-teal)]" aria-hidden="true" /> : <X size={16} className="text-[var(--color-coral)]" aria-hidden="true" />}{correct ? "Correct." : result.complete ? "Not quite." : "Not finished."}</p>
          {result.messages.map((m, i) => <p key={i} className="mt-1 text-[var(--color-ink-soft)]">{m.text}</p>)}
          {correct && <Success config={config} guess={guess} />}
        </div>
      )}
      {revealed && <AnswerPlayback config={config} animate={animate} />}
    </div>
  );
}

function Success({ config, guess }) {
  return (
    <div className="mt-2 flex flex-col gap-1 text-[var(--color-ink)]" data-testid="ec-success">
      <p>Configuration: <strong className="font-[var(--font-mono)]">{config.shorthandString ?? config.configurationString}</strong>{config.shorthandString ? <span className="text-[var(--color-ink-soft)]"> (full: {config.configurationString})</span> : null}</p>
      <p>Unpaired electrons: <strong data-testid="ec-unpaired">{config.unpaired}</strong>{guess !== "" ? (Number(guess) === config.unpaired ? " — your prediction was right." : ` — you predicted ${guess}. Hund's rule puts one electron in each orbital of a subshell before pairing, which sets the count.`) : ""}</p>
      {config.notes.map((n, i) => <p key={i} className="text-[var(--color-ink-soft)]">{n}</p>)}
    </div>
  );
}

/** Purposeful animation: electrons appear one at a time in the order the Aufbau principle (or the ion rule) gives, so the student sees
 * how the configuration is built. Skippable, off when the Animate switch is off or the system asks for reduced motion. */
function AnswerPlayback({ config, animate }) {
  const order = useMemo(() => {
    const out = [];
    for (const s of fillingOrder(config.subshellsFillingOrder)) for (let k = 1; k <= s.electrons; k += 1) out.push({ n: s.n, l: s.l, k });
    return out;
  }, [config]);
  const [shown, setShown] = useState(animate ? 0 : order.length);
  useEffect(() => {
    if (!animate || shown >= order.length) return undefined;
    const t = setTimeout(() => setShown((s) => s + 1), 260);
    return () => clearTimeout(t);
  }, [animate, shown, order.length]);
  const upto = order.slice(0, shown);
  const counts = {};
  for (const e of upto) counts[`${e.n}-${e.l}`] = e.k;
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3" data-testid="ec-answer">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">The answer, filled in energy order</p>
        {shown < order.length && <button type="button" onClick={() => setShown(order.length)} className="text-xs text-[var(--color-indigo)] underline">Skip animation</button>}
      </div>
      <div className="flex flex-col gap-1">
        {fillingOrder(config.subshellsFillingOrder).map((s) => {
          const c = counts[`${s.n}-${s.l}`] ?? 0;
          return (
            <div key={`${s.n}-${s.l}`} className="flex items-center gap-2">
              <span className="w-8 font-[var(--font-mono)] text-xs text-[var(--color-ink)]">{subshellLabel(s.n, s.l)}</span>
              <div className="flex gap-1">{orbitalBoxes(s.l, c).map((b, i) => <span key={i} className="flex h-7 w-7 items-center justify-center rounded-sm border border-[var(--color-line-strong,var(--color-line))] text-sm font-bold text-[var(--color-ink)]">{b.up ? "↑" : ""}{b.down ? "↓" : ""}</span>)}</div>
              <span className="text-xs tabular-nums text-[var(--color-ink-soft)]">{sup(c)}</span>
            </div>
          );
        })}
      </div>
      {shown >= order.length && <p className="mt-1 text-sm text-[var(--color-ink)]">{config.shorthandString ?? config.configurationString}{config.notes.map((n, i) => <span key={i} className="mt-1 block text-xs text-[var(--color-ink-soft)]">{n}</span>)}</p>}
    </div>
  );
}
