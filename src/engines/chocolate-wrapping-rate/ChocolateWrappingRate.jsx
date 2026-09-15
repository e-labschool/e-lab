import { useState, useRef, useCallback, useEffect } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { ChocolateIcon, WrapperIcon, PackIcon } from "./components/Icons.jsx";
import { createInitialState, advanceTick, currentRateOverWindow, WRAPPING_RULES, RATE_WINDOW_SECONDS } from "./lib/wrappingModel.js";

const TICK_MS = 900; // real wall-clock time per simulated second -- slow enough that each event is visible
const MIN_QUANTITY = 2;
const MAX_QUANTITY = 40;

const SERIES_OPTIONS = [
  { id: "packs", label: "Wrapped Packs Produced", key: "packs" },
  { id: "chocolates", label: "Chocolates Remaining", key: "chocolates" },
  { id: "wrappers", label: "Wrappers Remaining", key: "wrappers" },
];

export default function ChocolateWrappingRate({ compact = false }) {
  const [ruleId, setRuleId] = useState("rule1");
  const rule = WRAPPING_RULES[ruleId];

  const [initialChocolates, setInitialChocolates] = useState(rule.defaultChocolates);
  const [initialWrappers, setInitialWrappers] = useState(rule.defaultWrappers);

  const [state, setState] = useState(() => createInitialState(rule.defaultChocolates, rule.defaultWrappers));
  const [history, setHistory] = useState(() => [{ time: 0, packs: 0, chocolates: rule.defaultChocolates, wrappers: rule.defaultWrappers }]);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [seriesId, setSeriesId] = useState("packs");
  const [justWrapped, setJustWrapped] = useState(0);
  const [showEndReveal, setShowEndReveal] = useState(false);
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  // Changing the rule before starting updates the suggested defaults --
  // only while setup controls are still unlocked (never after Start).
  function handleRuleChange(nextRuleId) {
    if (hasStarted) return;
    const nextRule = WRAPPING_RULES[nextRuleId];
    setRuleId(nextRuleId);
    setInitialChocolates(nextRule.defaultChocolates);
    setInitialWrappers(nextRule.defaultWrappers);
    setState(createInitialState(nextRule.defaultChocolates, nextRule.defaultWrappers));
    setHistory([{ time: 0, packs: 0, chocolates: nextRule.defaultChocolates, wrappers: nextRule.defaultWrappers }]);
  }

  function handleQuantityChange(setter, value) {
    if (hasStarted) return;
    const clamped = Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, Number(value) || MIN_QUANTITY));
    setter(clamped);
  }

  // Keep the live state in sync with quantity edits while still unlocked.
  useEffect(() => {
    if (hasStarted) return;
    setState(createInitialState(initialChocolates, initialWrappers));
    setHistory([{ time: 0, packs: 0, chocolates: initialChocolates, wrappers: initialWrappers }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialChocolates, initialWrappers, hasStarted]);

  const tick = useCallback(() => {
    setState((prev) => {
      const next = advanceTick(prev, rule.chocolatesPerEvent);
      setHistory((h) => [...h, { time: next.time, packs: next.packs, chocolates: next.chocolates, wrappers: next.wrappers }]);
      if (next.lastEventCount > 0) {
        setJustWrapped(next.lastEventCount);
        window.setTimeout(() => setJustWrapped(0), TICK_MS * 0.6);
      }
      if (next.finished) {
        setRunning(false);
        stopTimer();
        setShowEndReveal(false);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.chocolatesPerEvent, stopTimer]);

  function handleStart() {
    if (state.finished) return;
    setHasStarted(true);
    setRunning(true);
    timerRef.current = setInterval(tick, TICK_MS);
  }

  function handlePause() {
    setRunning(false);
    stopTimer();
  }

  function handleReset() {
    setRunning(false);
    setHasStarted(false);
    stopTimer();
    setState(createInitialState(initialChocolates, initialWrappers));
    setHistory([{ time: 0, packs: 0, chocolates: initialChocolates, wrappers: initialWrappers }]);
    setJustWrapped(0);
    setShowEndReveal(false);
  }

  const rateOverWindow = currentRateOverWindow(state);
  const activeSeries = SERIES_OPTIONS.find((s) => s.id === seriesId);
  const maxValueForSeries = seriesId === "chocolates" ? initialChocolates : seriesId === "wrappers" ? initialWrappers : Math.floor(initialWrappers);

  return (
    <InteractiveFrame title="Chocolate Wrapping \u2014 Understanding Rate" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1020 }}>
        <p className="text-center text-sm text-[var(--color-ink-soft)]">
          {"Choose a wrapping rule and watch how chocolates and wrappers are used to make wrapped packs. Notice how the rate changes with time."}
        </p>

        {/* Setup controls */}
        <div className="mt-4 flex flex-wrap items-end justify-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink-soft)]">Wrapping rule</span>
            <select
              aria-label="Wrapping rule"
              value={ruleId}
              disabled={hasStarted}
              onChange={(e) => handleRuleChange(e.target.value)}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
            >
              <option value="rule1">{WRAPPING_RULES.rule1.label}</option>
              <option value="rule2">{WRAPPING_RULES.rule2.label}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink-soft)]">Initial Chocolates</span>
            <input
              type="number"
              aria-label="Initial chocolates"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={initialChocolates}
              disabled={hasStarted}
              onChange={(e) => handleQuantityChange(setInitialChocolates, e.target.value)}
              className="w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink-soft)]">Initial Wrappers</span>
            <input
              type="number"
              aria-label="Initial wrappers"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              value={initialWrappers}
              disabled={hasStarted}
              onChange={(e) => handleQuantityChange(setInitialWrappers, e.target.value)}
              className="w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
            />
          </label>
        </div>

        {/* Rule preview */}
        <p className="mt-3 text-center text-sm font-semibold text-[var(--color-ink)]">
          {rule.chocolatesPerEvent === 1 ? (
            <>1 <ChocolateIconInline /> + 1 <WrapperIconInline /> {"\u2192"} 1 <PackIconInline /></>
          ) : (
            <>2 <ChocolateIconInline /> + 1 <WrapperIconInline /> {"\u2192"} 1 <PackIconInline /></>
          )}
        </p>

        {/* Main horizontal process */}
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto_1fr]">
          <SupplyArea title="Chocolates" count={state.chocolates} Icon={ChocolateIcon} />
          <SupplyArea title="Wrappers" count={state.wrappers} Icon={WrapperIcon} />

          <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Wrapping Station</p>
            <div
              className="mt-2 flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all duration-300"
              style={{
                borderColor: justWrapped > 0 ? "var(--color-teal)" : "var(--color-line)",
                boxShadow: justWrapped > 0 ? "0 0 0 6px var(--color-teal-soft)" : "none",
                transform: justWrapped > 0 ? "scale(1.08)" : "scale(1)",
              }}
            >
              <PackIcon size={32} />
            </div>
            {justWrapped > 0 && <p className="mt-2 text-xs font-semibold text-[var(--color-teal)]">+{justWrapped} wrapped!</p>}
          </div>

          <SupplyArea title="Finished Packs" count={state.packs} Icon={PackIcon} />
        </div>

        {state.finished && (
          <div className="mt-3 text-center">
            <p className="text-sm font-bold text-[var(--color-coral)]">{"Rate = 0 \u2014 the process has stopped"}</p>
            {!showEndReveal ? (
              <button type="button" onClick={() => setShowEndReveal(true)} className="mt-1 text-xs font-medium text-[var(--color-indigo)] hover:underline">
                Why did the process stop?
              </button>
            ) : (
              <p className="mx-auto mt-1 max-w-md text-xs text-[var(--color-ink-soft)]">
                {"One of the required starting materials is no longer available in enough quantity to make another complete pack. No more product can be formed, so the rate becomes zero."}
              </p>
            )}
          </div>
        )}

        {/* Live counters */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <IconCounter label="Chocolates Remaining" value={`${state.chocolates} / ${initialChocolates}`} Icon={ChocolateIcon} />
          <IconCounter label="Wrappers Remaining" value={`${state.wrappers} / ${initialWrappers}`} Icon={WrapperIcon} />
          <IconCounter label="Wrapped Packs" value={state.packs} Icon={PackIcon} />
          <Counter label="Time Elapsed" value={`${state.time} s`} />
          <Counter label="Current Rate" value={state.finished ? "0" : `${rateOverWindow} packs / ${RATE_WINDOW_SECONDS} s`} emphasize={state.finished} />
        </div>

        {/* Graph */}
        <div className="mt-4 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
              Show graph for:
              <select aria-label="Graph series" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1 text-xs text-[var(--color-ink)]">
                {SERIES_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
          <RateGraph history={history} series={activeSeries} maxValue={maxValueForSeries} />
          {history.length > 3 && (
            <p className="mt-1 text-center text-[10px] text-[var(--color-ink-faint)]">
              Steeper graph {"\u2192"} faster change &middot; Less steep {"\u2192"} slower change &middot; Horizontal {"\u2192"} rate = 0
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="mt-4 flex justify-center gap-2">
          {!running ? (
            <button type="button" aria-label="Start" onClick={handleStart} disabled={state.finished} className="rounded-md bg-[var(--color-indigo)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
              START
            </button>
          ) : (
            <button type="button" aria-label="Pause" onClick={handlePause} className="rounded-md bg-[var(--color-amber)] px-4 py-2 text-sm font-semibold text-white">
              PAUSE
            </button>
          )}
          <button type="button" aria-label="Reset" onClick={handleReset} className="rounded-md border border-[var(--color-line)] px-4 py-2 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            RESET
          </button>
        </div>
      </div>
    </InteractiveFrame>
  );
}

function ChocolateIconInline() { return <span className="inline-block align-middle"><ChocolateIcon size={16} /></span>; }
function WrapperIconInline() { return <span className="inline-block align-middle"><WrapperIcon size={16} /></span>; }
function PackIconInline() { return <span className="inline-block align-middle"><PackIcon size={18} /></span>; }

// Displays a natural, capped visual pile so 20+ objects never shrink into
// unreadable specks -- the NUMERIC count (shown below the pile) always
// stays authoritative; only the individually-rendered pieces are capped.
const MAX_RENDERED_PIECES = 16;

function SupplyArea({ title, count, Icon }) {
  const rendered = Math.min(count, MAX_RENDERED_PIECES);
  const overflow = count - rendered;
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{title}</p>
      <div className="flex flex-wrap justify-center gap-1" role="img" aria-label={`${count} ${title.toLowerCase()}`}>
        {Array.from({ length: rendered }).map((_, i) => (
          <span key={i} className="transition-opacity duration-300">
            <Icon size={20} />
          </span>
        ))}
        {overflow > 0 && <span className="self-center text-xs font-semibold text-[var(--color-ink-faint)]">+{overflow}</span>}
      </div>
      <p className="mt-1.5 text-center text-sm font-bold text-[var(--color-ink)]">{count}</p>
    </div>
  );
}

function Counter({ label, value, emphasize = false }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-center">
      <p className={`text-sm font-bold ${emphasize ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>{value}</p>
      <p className="text-[10px] text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function IconCounter({ label, value, Icon }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1">
        <Icon size={14} />
        <p className="text-sm font-bold text-[var(--color-ink)]">{value}</p>
      </div>
      <p className="text-[10px] text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function RateGraph({ history, series, maxValue }) {
  const W = 640, H = 170, padL = 36, padR = 12, padT = 10, padB = 24;
  const maxTime = Math.max(1, history[history.length - 1]?.time ?? 1);
  const safeMax = Math.max(1, maxValue);

  function x(t) { return padL + (t / maxTime) * (W - padL - padR); }
  function y(v) {
    const clamped = Math.max(0, Math.min(safeMax, v));
    return padT + (1 - clamped / safeMax) * (H - padT - padB);
  }

  const points = history.map((h) => `${x(h.time).toFixed(1)},${y(h[series.key]).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Graph of ${series.label} over time in seconds`}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={padL - 6} y={padT + f * (H - padT - padB) + 3} textAnchor="end" fontSize="9" fill="var(--color-ink-faint)">{Math.round(safeMax * (1 - f))}</text>
        </g>
      ))}
      {history.length > 1 && <polyline points={points} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {history.map((h, i) => (
        <circle key={i} cx={x(h.time)} cy={y(h[series.key])} r={i === history.length - 1 ? 4 : 2.2} fill="var(--color-indigo)" />
      ))}
      <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">Time / s</text>
    </svg>
  );
}
