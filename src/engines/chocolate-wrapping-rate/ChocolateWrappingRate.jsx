import { useState, useRef, useCallback, useEffect } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { ChocolateIcon, WrapperIcon, PackIcon } from "./components/Icons.jsx";
import { createInitialState, advanceTick, currentRate } from "./lib/wrappingModel.js";

const TICK_MS = 900; // slow enough that each discrete wrapping event is visible, not a blur
const INITIAL_CHOCOLATES = 20;
const INITIAL_WRAPPERS = 10;

const SERIES_OPTIONS = [
  { id: "packs", label: "Wrapped Packs Produced", key: "packs", direction: "up" },
  { id: "chocolates", label: "Chocolates Remaining", key: "chocolates", direction: "down" },
  { id: "wrappers", label: "Wrappers Remaining", key: "wrappers", direction: "down" },
];

export default function ChocolateWrappingRate({ compact = false }) {
  const [state, setState] = useState(() => createInitialState(INITIAL_CHOCOLATES, INITIAL_WRAPPERS));
  const [history, setHistory] = useState(() => [{ time: 0, packs: 0, chocolates: INITIAL_CHOCOLATES, wrappers: INITIAL_WRAPPERS }]);
  const [running, setRunning] = useState(false);
  const [seriesId, setSeriesId] = useState("packs");
  const [justWrapped, setJustWrapped] = useState(0); // brief pulse count for the "event just happened" animation
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    setState((prev) => {
      const next = advanceTick(prev);
      setHistory((h) => [...h, { time: next.time, packs: next.packs, chocolates: next.chocolates, wrappers: next.wrappers }]);
      if (next.lastEventCount > 0) {
        setJustWrapped(next.lastEventCount);
        window.setTimeout(() => setJustWrapped(0), TICK_MS * 0.6);
      }
      if (next.finished) {
        setRunning(false);
        stopTimer();
        setShowQuiz(true);
      }
      return next;
    });
  }, [stopTimer]);

  useEffect(() => stopTimer, [stopTimer]);

  function handleStart() {
    if (state.finished) return;
    setRunning(true);
    setShowQuiz(false);
    timerRef.current = setInterval(tick, TICK_MS);
  }

  function handlePause() {
    setRunning(false);
    stopTimer();
  }

  function handleReset() {
    setRunning(false);
    stopTimer();
    setState(createInitialState(INITIAL_CHOCOLATES, INITIAL_WRAPPERS));
    setHistory([{ time: 0, packs: 0, chocolates: INITIAL_CHOCOLATES, wrappers: INITIAL_WRAPPERS }]);
    setJustWrapped(0);
    setShowQuiz(false);
    setQuizAnswer(null);
  }

  const rate = currentRate(state);
  const activeSeries = SERIES_OPTIONS.find((s) => s.id === seriesId);

  return (
    <InteractiveFrame title="Chocolate Wrapping \u2014 Understanding Rate" subtitle="An introductory analogy for rate of reaction" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 980 }}>
        <p className="text-center text-sm font-semibold text-[var(--color-ink)]">
          2 Chocolates + 1 Wrapper <span aria-hidden="true">{"\u2192"}</span> 1 Wrapped Pack
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          {/* LEFT — table of raw materials */}
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Work Table</p>
            <IconGrid count={state.chocolates} Icon={ChocolateIcon} label="chocolates remaining" />
            <IconGrid count={state.wrappers} Icon={WrapperIcon} label="wrappers remaining" className="mt-2" />
          </div>

          {/* CENTRE — wrapping station */}
          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-6 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Wrapping Station</p>
            <div
              className="mt-2 flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all"
              style={{
                borderColor: justWrapped > 0 ? "var(--color-teal)" : "var(--color-line)",
                boxShadow: justWrapped > 0 ? "0 0 0 6px var(--color-teal-soft)" : "none",
              }}
            >
              <PackIcon size={30} />
            </div>
            {justWrapped > 0 && <p className="mt-2 text-xs font-semibold text-[var(--color-teal)]">+{justWrapped} wrapped!</p>}
          </div>

          {/* RIGHT — finished packs */}
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Finished Packs</p>
            <IconGrid count={state.packs} Icon={PackIcon} label="wrapped packs produced" />
          </div>
        </div>

        {/* Live counters */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Counter label="Chocolates" value={state.chocolates} />
          <Counter label="Wrappers" value={state.wrappers} />
          <Counter label="Packs Produced" value={state.packs} />
          <Counter label="Time" value={state.time} />
          <Counter label="Current Rate" value={state.finished ? "0" : rate} suffix=" packs/tick" emphasize={state.finished} />
        </div>
        {state.finished && <p className="mt-2 text-center text-sm font-bold text-[var(--color-coral)]">{"Rate = 0 \u2014 the process has stopped"}</p>}

        {/* Graph */}
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--color-ink)]">Graph</p>
            <div className="flex gap-1">
              {SERIES_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeriesId(s.id)}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${seriesId === s.id ? "bg-[var(--color-indigo)] text-white" : "text-[var(--color-ink-faint)] hover:bg-[var(--color-line)]/40"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <RateGraph history={history} series={activeSeries} maxValue={seriesId === "chocolates" ? INITIAL_CHOCOLATES : seriesId === "wrappers" ? INITIAL_WRAPPERS : INITIAL_WRAPPERS} />
        </div>

        {/* Controls */}
        <div className="mt-4 flex justify-center gap-2">
          {!running ? (
            <button type="button" onClick={handleStart} disabled={state.finished} className="rounded-md bg-[var(--color-indigo)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              START
            </button>
          ) : (
            <button type="button" onClick={handlePause} className="rounded-md bg-[var(--color-amber)] px-4 py-2 text-sm font-semibold text-white">
              PAUSE
            </button>
          )}
          <button type="button" onClick={handleReset} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            RESET
          </button>
        </div>

        {/* Discovery prompt */}
        {showQuiz && <DiscoveryQuiz answer={quizAnswer} onAnswer={setQuizAnswer} />}
      </div>
    </InteractiveFrame>
  );
}

function IconGrid({ count, Icon, label, className = "" }) {
  const capped = Math.min(count, 24); // representative cap so 20+ icons never sprawl uncontrollably
  return (
    <div className={`flex flex-wrap justify-center gap-1 ${className}`} role="img" aria-label={`${count} ${label}`}>
      {Array.from({ length: capped }).map((_, i) => (
        <Icon key={i} size={16} />
      ))}
    </div>
  );
}

function Counter({ label, value, suffix = "", emphasize = false }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-center">
      <p className={`text-base font-bold ${emphasize ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>{value}{suffix}</p>
      <p className="text-[10px] text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function RateGraph({ history, series, maxValue }) {
  const W = 600, H = 160, padL = 34, padR = 12, padT = 10, padB = 22;
  const maxTime = Math.max(1, history[history.length - 1]?.time ?? 1);

  function x(t) {
    return padL + (t / maxTime) * (W - padL - padR);
  }
  function y(v) {
    const clamped = Math.max(0, Math.min(maxValue, v));
    return padT + (1 - clamped / maxValue) * (H - padT - padB);
  }

  const points = history.map((h) => `${x(h.time).toFixed(1)},${y(h[series.key]).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Graph of ${series.label} over time`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={padL - 6} y={padT + f * (H - padT - padB) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-faint)">
            {Math.round(maxValue * (1 - f))}
          </text>
        </g>
      ))}
      {history.length > 1 && <polyline points={points} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {history.map((h, i) => (
        <circle key={i} cx={x(h.time)} cy={y(h[series.key])} r={i === history.length - 1 ? 4 : 2.2} fill="var(--color-indigo)" />
      ))}
      <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">Time (ticks)</text>
    </svg>
  );
}

const QUIZ_OPTIONS = [
  { id: "A", text: "It increased" },
  { id: "B", text: "It remained constant" },
  { id: "C", text: "It gradually decreased" },
  { id: "D", text: "It suddenly became faster" },
];

function DiscoveryQuiz({ answer, onAnswer }) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--color-indigo)]/25 bg-[var(--color-indigo-soft)] p-3">
      <p className="text-sm font-semibold text-[var(--color-ink)]">What happened to the rate as time passed?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUIZ_OPTIONS.map((opt) => {
          const isCorrect = opt.id === "C";
          const selected = answer === opt.id;
          const showResult = answer != null;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onAnswer(opt.id)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                showResult && isCorrect
                  ? "border-[var(--color-teal)] bg-[var(--color-teal-soft)] text-[var(--color-teal)]"
                  : showResult && selected
                  ? "border-[var(--color-coral)] bg-[var(--color-coral-soft)] text-[var(--color-coral)]"
                  : "border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
              }`}
            >
              {opt.id}. {opt.text}
            </button>
          );
        })}
      </div>
      {answer != null && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          {answer === "C"
            ? "Correct \u2014 the rate gradually decreased as fewer chocolates and wrappers remained available."
            : "Look at the graph: the curve gets less steep over time, showing the rate gradually decreased."}
          {" "}{"The process stopped once the graph became horizontal \u2014 no more product was being formed."}
        </p>
      )}
    </div>
  );
}
