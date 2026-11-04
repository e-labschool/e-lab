import { useEffect, useRef, useState } from "react";
import { densityColor } from "../model/shielding.js";

/** Reacts to the studio's monotonic stepRequest counter ({ n, dir }): calls onStep(dir) once per new request (ignores the initial value). */
export function useStepRequest(stepRequest, onStep) {
  const last = useRef(stepRequest?.n ?? 0); const cb = useRef(onStep); cb.current = onStep;
  useEffect(() => {
    if (!stepRequest || stepRequest.n === last.current) return;
    last.current = stepRequest.n; cb.current(stepRequest.dir >= 0 ? 1 : -1);
  }, [stepRequest]);
}

export function Segmented({ label, value, options, onChange, testId, small }) {
  return (
    <div className={`nm-seg${small ? " nm-seg--s" : ""}`} role="group" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" className="sim-btn nm-segbtn" aria-pressed={value === o.value} onClick={() => onChange(o.value)} disabled={o.disabled} title={o.title} data-testid={o.testId}>{o.label}</button>
      ))}
    </div>
  );
}

export function Toggle({ label, pressed, onChange, testId, title, icon }) {
  return <button type="button" className="sim-btn nm-textbtn" aria-pressed={pressed} onClick={() => onChange(!pressed)} data-testid={testId} title={title}>{icon}<span>{label}</span></button>;
}

export function DensityLegend() {
  const stops = [0, 0.25, 0.5, 0.75, 1].map((s) => densityColor(s));
  return (
    <div className="nm-legend" data-testid="density-legend">
      <div className="nm-legend-bar" style={{ background: `linear-gradient(90deg, ${stops.join(",")})` }} aria-hidden="true" />
      <div className="nm-legend-row"><span>electron-rich / shielded</span><span>electron-poor / deshielded</span></div>
      <div className="nm-note-s">Qualitative colouring only: heavy atoms from bond polarity (electronegativity), H from the representative δ of their environment. Not a calculated electron density.</div>
    </div>
  );
}

export function Explain({ children, testId = "explain" }) {
  return <div className="nm-explain" aria-live="polite" aria-atomic="true" data-testid={testId}>{children}</div>;
}

export function Feedback({ result, testId = "feedback" }) {
  if (!result) return null;
  return (
    <div className={`nm-feedback ${result.correct ? "is-ok" : "is-bad"}`} role="status" data-testid={testId} data-correct={result.correct ? "1" : "0"}>
      <p className="nm-fb-msg"><b>{result.message}</b></p>
      {result.explanation && <p className="nm-fb-exp">{result.explanation}</p>}
    </div>
  );
}

/** Animated value that follows `target` (0..1) over durationMs / speed. restartToken: when it changes the value jumps to `from` and animates again.
 *  reducedMotion: jumps straight to the target (no animation). Returns the current value. */
export function useTween(target, { durationMs = 1500, speed = 1, reducedMotion = false, restartToken = 0, from = 0, paused = false } = {}) {
  const [v, setV] = useState(target);
  const ref = useRef({ v: target, token: restartToken, raf: 0, last: 0 });
  useEffect(() => {
    const st = ref.current; cancelAnimationFrame(st.raf);
    if (st.token !== restartToken) { st.token = restartToken; st.v = from; setV(from); }
    if (reducedMotion) { st.v = target; setV(target); return undefined; }
    if (paused) return undefined;
    st.last = performance.now();
    const tick = (now) => {
      const dt = now - st.last; st.last = now;
      const dir = Math.sign(target - st.v); const step = (dt / (durationMs / Math.max(0.05, speed)));
      st.v = dir === 0 ? target : dir > 0 ? Math.min(target, st.v + step) : Math.max(target, st.v - step);
      setV(st.v);
      if (st.v !== target) st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(st.raf);
  }, [target, speed, reducedMotion, restartToken, paused, durationMs, from]);
  return reducedMotion ? target : v;
}

export function PascalBars({ n, color = "#22d3ee", label = true }) {
  const row = []; let r = [1];
  for (let i = 0; i < n; i += 1) { const nx = [1]; for (let k = 1; k < r.length; k += 1) nx.push(r[k - 1] + r[k]); nx.push(1); r = nx; }
  row.push(...r); const max = Math.max(...row);
  return (
    <div className="nm-pascal" role="img" aria-label={`Relative line intensities ${row.join(" : ")}`} data-testid="pascal-bars">
      {row.map((v, i) => (
        <div key={i} className="nm-pascal-col"><span>{label ? v : ""}</span><div className="nm-pascal-bar" style={{ height: `${(v / max) * 34 + 3}px`, background: color }} /></div>
      ))}
    </div>
  );
}
