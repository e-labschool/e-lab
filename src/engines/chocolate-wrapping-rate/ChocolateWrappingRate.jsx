import { useState, useRef, useCallback, useEffect } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { ChocolateIcon, WrapperIcon, PackIcon } from "./components/Icons.jsx";
import { createInitialState, advanceTick, currentRate, WRAPPING_RULES } from "./lib/wrappingModel.js";

const TICK_MS = 900; // real wall-clock time per simulated second -- slow enough that each event is visible
const MIN_QUANTITY = 2;
const MAX_QUANTITY = 40;
const MAX_RENDERED_PIECES = 14; // a natural-looking capped pile -- the numeric count stays authoritative

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
  const [justWrapped, setJustWrapped] = useState(false); // brief pulse only -- no persistent "+N" readout
  const timerRef = useRef(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

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
        setJustWrapped(true);
        window.setTimeout(() => setJustWrapped(false), TICK_MS * 0.6);
      }
      if (next.finished) {
        setRunning(false);
        stopTimer();
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.chocolatesPerEvent, stopTimer]);

  function handleStart() {
    if (state.finished) return;
    setHasStarted(true);
    setRunning(true);
    // Simulated time only ever advances via this interval -- pausing
    // (clearing it) freezes state.time exactly where it is, and real
    // wall-clock time spent paused is never counted, since resuming
    // just starts a fresh interval calling the same tick() from the
    // current (unchanged) state.
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
    setJustWrapped(false);
  }

  // Paused is its OWN state, distinct from "naturally stopped" -- the
  // process wasn't exhausted, the user just paused it, so the rate
  // display must never claim "0 packs s\u207B\u00B9" here.
  const isPaused = hasStarted && !running && !state.finished;
  const rate = currentRate(state);
  const activeSeries = SERIES_OPTIONS.find((s) => s.id === seriesId);
  const maxValueForSeries = seriesId === "chocolates" ? initialChocolates : seriesId === "wrappers" ? initialWrappers : initialWrappers;

  return (
    <InteractiveFrame title="Chocolate Wrapping \u2014 Understanding Rate" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1020 }}>
        <p className="text-center text-sm text-[var(--color-ink-soft)]">
          {"Choose a wrapping rule and watch how chocolates and wrappers are used to make wrapped packs. Notice how the rate changes with time."}
        </p>

        {/* Setup row */}
        <div className="mt-3 flex flex-wrap items-end justify-center gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink-soft)]">Wrapping rule</span>
            <select
              aria-label="Wrapping rule"
              value={ruleId}
              disabled={hasStarted}
              onChange={(e) => handleRuleChange(e.target.value)}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
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
              className="w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
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
              className="w-20 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1.5 text-[var(--color-ink)] disabled:opacity-50"
            />
          </label>
        </div>

        {/* Prominent rule equation */}
        <div className="mt-4 flex items-center justify-center gap-2 text-base font-semibold text-[var(--color-ink)]">
          {rule.chocolatesPerEvent === 1 ? (
            <>1 <ChocolateIcon size={26} /> + 1 <WrapperIcon size={26} /> <span aria-hidden="true">{"\u2192"}</span> 1 <PackIcon size={30} /></>
          ) : (
            <>2 <ChocolateIcon size={26} /> + 1 <WrapperIcon size={26} /> <span aria-hidden="true">{"\u2192"}</span> 1 <PackIcon size={30} /></>
          )}
        </div>

        {/* ONE continuous work-table -- no separate bordered cards per stage */}
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-[var(--color-paper-raised)] px-4 py-4 sm:gap-4">
          <SupplyPile count={state.chocolates} Icon={ChocolateIcon} label="Chocolates" total={initialChocolates} />
          <span className="text-lg font-bold text-[var(--color-ink-faint)]" aria-hidden="true">+</span>
          <SupplyPile count={state.wrappers} Icon={WrapperIcon} label="Wrappers" total={initialWrappers} />

          <span className="text-lg font-bold text-[var(--color-ink-faint)]" aria-hidden="true">{"\u2192"}</span>

          <div className="flex shrink-0 flex-col items-center">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Wrapping Station</p>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all duration-300"
              style={{
                borderColor: justWrapped ? "var(--color-teal)" : "var(--color-line)",
                boxShadow: justWrapped ? "0 0 0 5px var(--color-teal-soft)" : "none",
                transform: justWrapped ? "scale(1.1)" : "scale(1)",
              }}
            >
              <PackIcon size={28} />
            </div>
          </div>

          <span className="text-lg font-bold text-[var(--color-ink-faint)]" aria-hidden="true">{"\u2192"}</span>
          <SupplyPile count={state.packs} Icon={PackIcon} label="Wrapped Packs" />
        </div>

        {/* Compact status strip -- quantities are NOT repeated here, they're already shown above */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-lg border border-[var(--color-line)] px-4 py-2.5 text-sm">
          <span className="text-[var(--color-ink-soft)]">Time: <strong className="text-[var(--color-ink)]">{state.time.toFixed(1)} s</strong></span>
          {state.finished ? (
            <span className="font-semibold text-[var(--color-coral)]">{"Rate = 0 \u2014 the process has stopped"}</span>
          ) : isPaused ? (
            <span className="font-semibold text-[var(--color-amber)]">{"Simulation paused \u00b7 Current rate: \u2014"}</span>
          ) : !hasStarted ? (
            <span className="text-[var(--color-ink-soft)]">{"Current rate: \u2014"}</span>
          ) : (
            <span className="text-[var(--color-ink-soft)]">
              Current rate <strong className="text-base font-bold text-[var(--color-ink)]">{rate} {"packs s\u207B\u00B9"}</strong>
            </span>
          )}
          <span className="flex gap-2">
            {!running ? (
              <button type="button" aria-label={hasStarted ? "Resume" : "Start"} onClick={handleStart} disabled={state.finished} className="rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                {hasStarted ? "RESUME" : "START"}
              </button>
            ) : (
              <button type="button" aria-label="Pause" onClick={handlePause} className="rounded-md bg-[var(--color-amber)] px-3 py-1.5 text-xs font-semibold text-white">
                PAUSE
              </button>
            )}
            <button type="button" aria-label="Reset" onClick={handleReset} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
              RESET
            </button>
          </span>
        </div>

        {/* Graph -- the dominant second section */}
        <div className="mt-4">
          <label className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
            Show graph for:
            <select aria-label="Graph series" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2 py-1 text-xs text-[var(--color-ink)]">
              {SERIES_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <RateGraph history={history} series={activeSeries} maxValue={maxValueForSeries} />
          <p className="mt-1 text-center text-[11px] text-[var(--color-ink-faint)]">
            Steeper graph = faster change &nbsp;&middot;&nbsp; Less steep = slower change &nbsp;&middot;&nbsp; Horizontal = rate 0
          </p>
        </div>
      </div>
    </InteractiveFrame>
  );
}

function SupplyPile({ count, total, Icon, label }) {
  const rendered = Math.min(count, MAX_RENDERED_PIECES);
  const overflow = count - rendered;
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="flex min-h-[26px] flex-wrap justify-center gap-0.5" role="img" aria-label={`${count} ${label.toLowerCase()}`}>
        {Array.from({ length: rendered }).map((_, i) => (
          <Icon key={i} size={18} />
        ))}
        {overflow > 0 && <span className="self-center text-[10px] font-semibold text-[var(--color-ink-faint)]">+{overflow}</span>}
      </div>
      <p className="mt-1 text-xs font-semibold text-[var(--color-ink)]">
        {label}
        <br />
        {total != null ? `${count} / ${total}` : count}
      </p>
    </div>
  );
}

function RateGraph({ history, series, maxValue }) {
  const W = 680, H = 220, padL = 38, padR = 12, padT = 12, padB = 26;
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
          <text x={padL - 6} y={padT + f * (H - padT - padB) + 3} textAnchor="end" fontSize="10" fill="var(--color-ink-faint)">{Math.round(safeMax * (1 - f))}</text>
        </g>
      ))}
      {history.length > 1 && <polyline points={points} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {history.map((h, i) => (
        <circle key={i} cx={x(h.time)} cy={y(h[series.key])} r={i === history.length - 1 ? 4 : 2} fill="var(--color-indigo)" />
      ))}
      <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-ink-faint)">Time / s</text>
    </svg>
  );
}
