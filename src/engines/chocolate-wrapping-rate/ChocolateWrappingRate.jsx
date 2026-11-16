import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import NumberField from "../../components/interactive-shell/NumberField.jsx";
import { ChocolateIcon, WrapperIcon, PackIcon } from "./components/Icons.jsx";
import {
  WRAPPING_RULES, MIN_QUANTITY, MAX_QUANTITY, DECAY_FRACTION, advanceTick, createInitialState, historyRow, normaliseQuantity,
  packsPossible, rateAverage, rateLastSecond, startBlocker,
} from "./lib/wrappingModel.js";
import "./ChocolateWrappingRate.css";

const MAX_RENDERED_PIECES = 14; // a capped pile: the number is authoritative, the drawing is a sample
const SPEEDS = { slow: { label: "Slow", ms: 1800 }, normal: { label: "Normal", ms: 900 }, fast: { label: "Fast", ms: 400 } };

const SERIES_OPTIONS = [
  { id: "packs", label: "Wrapped packs made (total)", short: "Packs made", key: "packs", unit: "packs" },
  { id: "rate", label: "Rate: packs wrapped each second", short: "Rate / packs s⁻¹", key: "rate", unit: "packs per second" },
  { id: "chocolates", label: "Chocolates remaining", short: "Chocolates left", key: "chocolates", unit: "chocolates" },
  { id: "wrappers", label: "Wrappers remaining", short: "Wrappers left", key: "wrappers", unit: "wrappers" },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return reduced;
}

/** Runs the whole game once (pure) to get the finishing time, so the graph's time axis is fixed and does not rescale as it runs. */
function totalSeconds(c, w, per) {
  let s = createInitialState(c, w, per); let guard = 0;
  while (!s.finished && guard++ < 10000) s = advanceTick(s, per);
  return Math.max(1, s.time);
}

export default function ChocolateWrappingRate({ compact = false, standalone = false }) {
  const reduced = usePrefersReducedMotion();
  const [ruleId, setRuleId] = useState("rule1");
  const rule = WRAPPING_RULES[ruleId];
  const per = rule.chocolatesPerEvent;
  const [initialChocolates, setInitialChocolates] = useState(rule.defaultChocolates);
  const [initialWrappers, setInitialWrappers] = useState(rule.defaultWrappers);
  const [state, setState] = useState(() => createInitialState(rule.defaultChocolates, rule.defaultWrappers, per));
  const [history, setHistory] = useState(() => [historyRow(createInitialState(rule.defaultChocolates, rule.defaultWrappers, per))]);
  const [running, setRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [seriesId, setSeriesId] = useState("packs");
  const [speed, setSpeed] = useState(reduced ? "slow" : "normal");
  const [pulse, setPulse] = useState(false);
  const [notices, setNotices] = useState({ chocolates: "", wrappers: "" });
  const [previous, setPrevious] = useState(null); // the run before the last Reset, for comparison
  const [announce, setAnnounce] = useState("");
  const stateRef = useRef(state);
  const timerRef = useRef(null);
  const pulseTimer = useRef(null);
  const perRef = useRef(per); perRef.current = per;

  const stopTimer = useCallback(() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } }, []);
  useEffect(() => () => { stopTimer(); clearTimeout(pulseTimer.current); }, [stopTimer]);

  const applySupplies = useCallback((c, w, p, keepPrevious = true) => {
    stopTimer();
    const fresh = createInitialState(c, w, p);
    stateRef.current = fresh; setState(fresh); setHistory([historyRow(fresh)]); setRunning(false); setHasStarted(false); setPulse(false);
    if (!keepPrevious) setPrevious(null);
  }, [stopTimer]);

  const tick = useCallback(() => {
    const prev = stateRef.current;
    const next = advanceTick(prev, perRef.current);
    stateRef.current = next;
    setState(next);
    if (next.time > prev.time && next.lastEvents > 0) {
      setHistory((h) => (h[h.length - 1].time === next.time ? h : [...h, historyRow(next)]));
      setPulse(true); clearTimeout(pulseTimer.current); pulseTimer.current = setTimeout(() => setPulse(false), 450);
      setAnnounce(`Second ${next.time}: ${next.lastEvents} ${next.lastEvents === 1 ? "pack" : "packs"} wrapped. ${next.chocolates} chocolates and ${next.wrappers} wrappers left.`);
    }
    if (next.finished) { stopTimer(); setRunning(false); setAnnounce((a) => `${a} Finished: no more packs can be made.`); }
  }, [stopTimer]);

  const startTimer = useCallback((ms) => { stopTimer(); timerRef.current = setInterval(tick, ms); }, [stopTimer, tick]);

  function handleRuleChange(id) {
    if (hasStarted) return;
    const r = WRAPPING_RULES[id];
    setRuleId(id); setInitialChocolates(r.defaultChocolates); setInitialWrappers(r.defaultWrappers); setNotices({ chocolates: "", wrappers: "" });
    applySupplies(r.defaultChocolates, r.defaultWrappers, r.chocolatesPerEvent);
  }
  function commitQuantity(which, raw) {
    if (hasStarted) return;
    const label = which === "chocolates" ? "number of chocolates" : "number of wrappers";
    const { value, notice } = normaliseQuantity(raw, label);
    if (notice) setNotices((n) => ({ ...n, [which]: notice }));
    if (value == null) return;
    const c = which === "chocolates" ? value : initialChocolates; const w = which === "wrappers" ? value : initialWrappers;
    if (which === "chocolates") setInitialChocolates(value); else setInitialWrappers(value);
    applySupplies(c, w, per);
  }

  function handleStart() {
    if (state.finished || startBlocker(rule, initialChocolates, initialWrappers)) return;
    setHasStarted(true); setRunning(true); startTimer(SPEEDS[speed].ms);
  }
  function handlePause() { setRunning(false); stopTimer(); }
  function handleReset() {
    if (hasStarted && history.length > 1) setPrevious({ history, series: `${initialChocolates} chocolates + ${initialWrappers} wrappers, rule ${rule.id === "rule1" ? "1:1" : "2:1"}` });
    applySupplies(initialChocolates, initialWrappers, per);
    setAnnounce("Reset.");
  }
  function changeSpeed(id) { setSpeed(id); if (running) startTimer(SPEEDS[id].ms); }

  const blocker = startBlocker(rule, initialChocolates, initialWrappers);
  const isPaused = hasStarted && !running && !state.finished;
  const last = rateLastSecond(state); const avg = rateAverage(state);
  const activeSeries = SERIES_OPTIONS.find((s) => s.id === seriesId);
  const tMax = useMemo(() => totalSeconds(initialChocolates, initialWrappers, per), [initialChocolates, initialWrappers, per]);
  const possible = packsPossible(initialChocolates, initialWrappers, per);

  return (
    <InteractiveFrame title={"Chocolate Wrapping — Understanding Rate"} compact={compact} standalone={standalone}>
      <div className="mx-auto w-full cw-root" style={{ maxWidth: 1020 }} data-testid="cw-root">
        <p className="cw-lead">
          Choose a wrapping rule and watch how chocolates and wrappers are used to make wrapped packs. The rate is how many packs are wrapped each second: notice how it changes with time.
        </p>

        <div className="cw-setup">
          <label className="cw-field">
            <span>Wrapping rule</span>
            <select aria-label="Wrapping rule" value={ruleId} disabled={hasStarted} onChange={(e) => handleRuleChange(e.target.value)} data-testid="cw-rule" className="cw-select">
              <option value="rule1">{WRAPPING_RULES.rule1.label}</option>
              <option value="rule2">{WRAPPING_RULES.rule2.label}</option>
            </select>
          </label>
          <div className="cw-field">
            <span>Initial chocolates</span>
            {hasStarted ? <b className="cw-locked" data-testid="cw-choc-locked">{initialChocolates}</b> : (
              <NumberField value={initialChocolates} min={MIN_QUANTITY} max={MAX_QUANTITY} decimals={0} unit="" label="Initial chocolates" width={64} testId="cw-chocolates"
                onCommit={(v) => commitQuantity("chocolates", v)} onNotice={(t) => setNotices((n) => ({ ...n, chocolates: t ?? "" }))} />
            )}
          </div>
          <div className="cw-field">
            <span>Initial wrappers</span>
            {hasStarted ? <b className="cw-locked" data-testid="cw-wrap-locked">{initialWrappers}</b> : (
              <NumberField value={initialWrappers} min={MIN_QUANTITY} max={MAX_QUANTITY} decimals={0} unit="" label="Initial wrappers" width={64} testId="cw-wrappers"
                onCommit={(v) => commitQuantity("wrappers", v)} onNotice={(t) => setNotices((n) => ({ ...n, wrappers: t ?? "" }))} />
            )}
          </div>
          <label className="cw-field">
            <span>Speed</span>
            <select aria-label="Speed" value={speed} onChange={(e) => changeSpeed(e.target.value)} data-testid="cw-speed" className="cw-select">
              {Object.entries(SPEEDS).map(([id, s]) => <option key={id} value={id}>{s.label}</option>)}
            </select>
          </label>
        </div>
        <p className="cw-limits" data-testid="cw-limits">
          {hasStarted ? "Quantities are locked while the run is going. Press Reset to change them." : `Any whole number from ${MIN_QUANTITY} to ${MAX_QUANTITY}; press Enter or leave the box to apply it.`}
          {" "}{blocker || `At most ${possible} ${possible === 1 ? "pack" : "packs"} can be made.`}
        </p>
        {(notices.chocolates || notices.wrappers) && <p className="cw-notice" role="status" data-testid="cw-notice">{notices.chocolates || notices.wrappers}</p>}

        <div className="cw-rule" aria-label="Wrapping rule equation">
          {per === 1 ? <>1 <ChocolateIcon size={26} /> + 1 <WrapperIcon size={26} /> <span aria-hidden="true">{"→"}</span> 1 <PackIcon size={30} /></> : <>2 <ChocolateIcon size={26} /> + 1 <WrapperIcon size={26} /> <span aria-hidden="true">{"→"}</span> 1 <PackIcon size={30} /></>}
        </div>

        <div className="cw-table">
          <SupplyPile count={state.chocolates} Icon={ChocolateIcon} label="Chocolates" total={initialChocolates} />
          <span className="cw-op" aria-hidden="true">+</span>
          <SupplyPile count={state.wrappers} Icon={WrapperIcon} label="Wrappers" total={initialWrappers} />
          <span className="cw-op" aria-hidden="true">{"→"}</span>
          <div className="cw-station">
            <p className="cw-cap">Wrapping station</p>
            <div className={`cw-circle${pulse ? " cw-circle--pulse" : ""}${reduced ? " cw-circle--static" : ""}`} data-pulse={pulse ? "1" : "0"} data-testid="cw-station"><PackIcon size={28} /></div>
          </div>
          <span className="cw-op" aria-hidden="true">{"→"}</span>
          <SupplyPile count={state.packs} Icon={PackIcon} label="Wrapped packs" />
        </div>

        <div className="cw-status" data-testid="cw-status">
          <span>Time: <strong data-testid="cw-time">{state.time} s</strong></span>
          <span title="Packs wrapped during the most recent second. This is the gradient of the last segment of the 'packs made' graph.">
            Rate in the last second: <strong data-testid="cw-rate-last">{last == null ? "—" : `${last} ${last === 1 ? "pack" : "packs"} s⁻¹`}</strong>
          </span>
          <span title="Total packs divided by total time. This is the gradient of the straight line from the origin to the latest point.">
            Average rate so far: <strong data-testid="cw-rate-avg">{avg == null ? "—" : `${avg.toFixed(1)} packs s⁻¹`}</strong>
          </span>
          {state.finished && <span className="cw-end" data-testid="cw-finished">{"Finished: no more packs can be made, so the rate is now 0. Press Reset to run again."}</span>}
          {isPaused && <span className="cw-paused">Paused</span>}
          <span className="cw-buttons">
            {state.finished ? (
              <button type="button" className="cw-btn cw-btn--primary" disabled data-testid="cw-start">FINISHED</button>
            ) : !running ? (
              <button type="button" className="cw-btn cw-btn--primary" aria-label={hasStarted ? "Resume" : "Start"} onClick={handleStart} disabled={!!blocker} title={blocker || undefined} data-testid="cw-start">{hasStarted ? "RESUME" : "START"}</button>
            ) : (
              <button type="button" className="cw-btn cw-btn--amber" aria-label="Pause" onClick={handlePause} data-testid="cw-pause">PAUSE</button>
            )}
            <button type="button" className="cw-btn" aria-label="Reset" onClick={handleReset} data-testid="cw-reset">RESET</button>
          </span>
        </div>
        <p className="cw-sr" aria-live="polite" data-testid="cw-live">{announce}</p>

        <div className="cw-graph-wrap">
          <label className="cw-graph-pick">
            Show graph for:
            <select aria-label="Graph series" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} className="cw-select" data-testid="cw-series">
              {SERIES_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <RateGraph history={history} series={activeSeries} initialChocolates={initialChocolates} initialWrappers={initialWrappers} possible={possible} tMax={tMax} previous={previous} />
          <p className="cw-legend" data-testid="cw-legend">
            {seriesId === "packs" ? "Gradient = rate. Teal segment: the last second (rate in the last second). Dashed amber line: from the origin to now (average rate). Steeper graph = faster, flat = rate 0."
              : seriesId === "rate" ? "Each bar is the number of packs wrapped in that second, which is the rate. It falls as the chocolates and wrappers run out."
                : "Steeper graph = faster change; flat = no change."}
            {previous && " Dashed grey: the previous run."}
          </p>
          <details className="cw-think">
            <summary>Think about it</summary>
            <p><b>1.</b> Why do fewer packs get wrapped each second as time goes on? (Each second {Math.round(DECAY_FRACTION * 100)} % of the packs that could still be made are wrapped, so less supply means fewer packs.)</p>
            <p><b>2.</b> In a chemical reaction what plays the part of the chocolates and wrappers? (The reactants. As they are used up their concentration falls, so the rate of reaction falls.)</p>
            <p><b>3.</b> Predict, then try: start with 40 chocolates and 40 wrappers. Is the first-second rate higher or lower than with 20 and 20? Compare with the previous run in the graph.</p>
            <p className="cw-note">This is an analogy: in a real reaction the rate also depends on temperature, a catalyst and a rate constant.</p>
          </details>
        </div>
      </div>
    </InteractiveFrame>
  );
}

function SupplyPile({ count, total, Icon, label }) {
  const rendered = Math.min(count, MAX_RENDERED_PIECES);
  const overflow = count - rendered;
  return (
    <div className="cw-pile">
      <div className="cw-pieces" role="img" aria-label={`${count} ${label.toLowerCase()}`}>
        {Array.from({ length: rendered }).map((_, i) => <Icon key={i} size={18} />)}
        {overflow > 0 && <span className="cw-more">+{overflow}</span>}
      </div>
      <p className="cw-pile-label">{label}<br />{total != null ? `${count} / ${total}` : count}</p>
    </div>
  );
}

function niceStep(max) {
  if (max <= 5) return 1; if (max <= 10) return 2; if (max <= 25) return 5; if (max <= 50) return 10; if (max <= 100) return 20; return 50;
}

function RateGraph({ history, series, initialChocolates, initialWrappers, possible, tMax, previous }) {
  const W = 680; const H = 250; const padL = 52; const padR = 14; const padT = 12; const padB = 40;
  const first = history.find((h) => h.time === 1)?.rate ?? 1;
  const yMaxRaw = series.id === "chocolates" ? initialChocolates : series.id === "wrappers" ? initialWrappers : series.id === "packs" ? Math.max(1, possible) : Math.max(1, history.reduce((m, h) => Math.max(m, h.rate), first));
  const yStep = niceStep(yMaxRaw); const yMax = Math.max(yStep, Math.ceil(yMaxRaw / yStep) * yStep);
  const xStep = tMax <= 12 ? 1 : tMax <= 30 ? 2 : 5; const xMax = Math.max(xStep, Math.ceil(tMax / xStep) * xStep);
  const x = (t) => padL + (t / xMax) * (W - padL - padR);
  const y = (v) => padT + (1 - Math.max(0, Math.min(yMax, v)) / yMax) * (H - padT - padB);
  const isRate = series.id === "rate";
  const pts = (hist) => hist.filter((h) => !isRate || h.time > 0).map((h) => `${x(h.time).toFixed(1)},${y(h[series.key]).toFixed(1)}`).join(" ");
  const yTicks = []; for (let v = 0; v <= yMax + 1e-9; v += yStep) yTicks.push(v);
  const xTicks = []; for (let t = 0; t <= xMax; t += xStep) xTicks.push(t);
  const lastRow = history[history.length - 1]; const prevRow = history[history.length - 2];
  const showGradients = series.id === "packs" && history.length > 1;
  const barW = Math.max(3, (x(1) - x(0)) * 0.7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cw-graph" role="img" aria-label={`Graph of ${series.label} against time in seconds`} data-testid="cw-graph">
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-soft)">{v}</text>
        </g>
      ))}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} x2={x(t)} y1={H - padB} y2={H - padB + 4} stroke="var(--color-ink-soft)" />
          <text x={x(t)} y={H - padB + 16} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)">{t}</text>
        </g>
      ))}
      <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--color-ink-soft)" />
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="var(--color-ink-soft)" />
      <text x={(padL + W - padR) / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--color-ink)">Time / s</text>
      <text transform={`translate(13 ${(padT + H - padB) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="var(--color-ink)">{series.short}</text>
      {previous && !isRate && <polyline points={pts(previous.history)} fill="none" stroke="var(--color-ink-faint)" strokeWidth="2" strokeDasharray="6 4" />}
      {previous && isRate && previous.history.filter((h) => h.time > 0).map((h) => <rect key={`p${h.time}`} x={x(h.time) - barW / 2 - 2} y={y(h.rate)} width={barW} height={Math.max(0, y(0) - y(h.rate))} fill="none" stroke="var(--color-ink-faint)" strokeDasharray="3 3" />)}
      {isRate
        ? history.filter((h) => h.time > 0).map((h) => <rect key={h.time} x={x(h.time) - barW / 2} y={y(h.rate)} width={barW} height={Math.max(0, y(0) - y(h.rate))} fill="var(--color-indigo)" data-testid="cw-bar" />)
        : history.length > 1 && <polyline points={pts(history)} fill="none" stroke="var(--color-indigo)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {showGradients && lastRow.time > 0 && <line x1={x(0)} y1={y(0)} x2={x(lastRow.time)} y2={y(lastRow.packs)} stroke="#b45309" strokeWidth="2" strokeDasharray="6 4" data-testid="cw-avg-line" />}
      {showGradients && prevRow && <line x1={x(prevRow.time)} y1={y(prevRow.packs)} x2={x(lastRow.time)} y2={y(lastRow.packs)} stroke="#0f766e" strokeWidth="4.5" strokeLinecap="round" data-testid="cw-last-segment" />}
      {!isRate && history.map((h, i) => <circle key={i} cx={x(h.time)} cy={y(h[series.key])} r={i === history.length - 1 ? 4.5 : 2.2} fill="var(--color-indigo)" />)}
    </svg>
  );
}
