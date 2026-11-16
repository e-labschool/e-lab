import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw, Shuffle } from "lucide-react";
import { ALKANE_MAX, FORCE_TAGS, RANK_SETS, RANK_SET_BY_ID, alkaneExplanation, alkaneSeries, moveItem, scoreRanking, shuffledOrder } from "../model/ranking.js";

/** Panel of boiling-point sets (the "controls" column). */
export function RankSetList({ setId, onPick, results }) {
  return (
    <div className="imf-subs imf-ranksets" role="radiogroup" aria-label="Substances to rank">
      {RANK_SETS.map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={setId === s.id} className="imf-sub" onClick={() => onPick(s.id)} data-testid={`rankset-${s.id}`}>
          <b>{s.title}{results[s.id]?.perfect ? " ✓" : ""}</b><span>{s.items.length} substances{s.level === "hl" ? " · HL" : ""}</span>
        </button>
      ))}
    </div>
  );
}

/** Scatter/line chart of boiling point against electrons for the alkane series (SVG, no WebGL needed). */
function AlkaneChart({ n }) {
  const series = alkaneSeries(); const W = 360; const H = 170; const P = { l: 44, r: 10, t: 10, b: 34 };
  const x = (e) => P.l + ((e - 10) / (66 - 10)) * (W - P.l - P.r); const y = (t) => P.t + (1 - (t + 170) / (140 + 170)) * (H - P.t - P.b);
  const pts = series.map((s) => `${x(s.electrons).toFixed(1)},${y(s.bp).toFixed(1)}`).join(" ");
  const zero = y(25);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="imf-alkchart" role="img" aria-label={`Boiling point of the unbranched alkanes against number of electrons. Currently ${series[n - 1].name}: ${series[n - 1].electrons} electrons, ${series[n - 1].bp} degrees Celsius.`} data-testid="alkane-chart">
      <line x1={P.l} y1={P.t} x2={P.l} y2={H - P.b} className="imf-ax" /><line x1={P.l} y1={H - P.b} x2={W - P.r} y2={H - P.b} className="imf-ax" />
      <line x1={P.l} y1={zero} x2={W - P.r} y2={zero} className="imf-ref" /><text x={W - P.r - 2} y={zero - 3} textAnchor="end" className="imf-tick">room temperature (25 °C)</text>
      {[-150, -100, -50, 0, 50, 100].map((t) => <text key={t} x={P.l - 5} y={y(t) + 3} textAnchor="end" className="imf-tick">{t}</text>)}
      {[10, 26, 42, 58].map((e) => <text key={e} x={x(e)} y={H - P.b + 13} textAnchor="middle" className="imf-tick">{e}</text>)}
      <polyline points={pts} fill="none" className="imf-curve-ghost" />
      {series.map((s) => <circle key={s.n} cx={x(s.electrons)} cy={y(s.bp)} r={s.n === n ? 6 : 3.5} fill={s.n === n ? "#ffd166" : "#7fb0ff"} stroke={s.n === n ? "#fff" : "none"} strokeWidth="2" data-testid={`alk-pt-${s.n}`} />)}
      <text x={P.l + (W - P.l - P.r) / 2} y={H - 4} textAnchor="middle" className="imf-axlabel">Electrons per molecule</text>
      <text transform={`translate(11 ${P.t + (H - P.t - P.b) / 2}) rotate(-90)`} textAnchor="middle" className="imf-axlabel">Boiling point (°C)</text>
    </svg>
  );
}

export function AlkaneSeries({ n, onChange }) {
  const s = alkaneSeries()[n - 1];
  return (
    <section className="imf-alk" aria-label="Alkane homologous series" data-testid="alkane-series">
      <h3>Homologous series: how chain length changes London dispersion</h3>
      <label className="imf-alk-row">Carbon atoms <b data-testid="alk-n">{n}</b>
        <input type="range" min={1} max={ALKANE_MAX} step={1} value={n} onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={`${s.name}, ${s.formula}`} data-testid="alk-slider" />
      </label>
      <div className="imf-alk-grid">
        <dl className="imf-alk-facts"><dt>Molecule</dt><dd data-testid="alk-name">{s.name} <small>{s.formula}</small></dd><dt>Electrons</dt><dd data-testid="alk-electrons">{s.electrons}</dd><dt>Boiling point</dt><dd data-testid="alk-bp">{s.bp} °C</dd><dt>At 25 °C</dt><dd>{s.phase}</dd></dl>
        <AlkaneChart n={n} />
      </div>
      <p className="imf-alk-text" data-testid="alk-text">{alkaneExplanation(n)}</p>
    </section>
  );
}

/**
 * Predict-first boiling-point task. Phase 1 (predict): the student orders the substances with the up / down buttons (keyboard friendly);
 * no boiling point is shown. Phase 2 (revealed): actual boiling points, the reason for each position and the score.
 */
export default function BoilingPointTask({ setId, order, onOrder, revealed, onReveal, onAgain, onShuffle, attempt }) {
  const set = RANK_SET_BY_ID[setId]; const byId = useMemo(() => Object.fromEntries(set.items.map((i) => [i.id, i])), [set]);
  const score = revealed ? scoreRanking(setId, order) : null;
  const [live, setLive] = useState("");
  const move = (i, d) => { onOrder(moveItem(order, i, i + d)); setLive(`${byId[order[i]].label} moved to position ${Math.max(1, Math.min(order.length, i + d + 1))} of ${order.length}`); };
  const right = revealed ? [...set.items].sort((a, b) => a.bp - b.bp).map((x) => x.id) : null;
  return (
    <div className="imf-rank" data-testid="rank-task" data-set={setId} data-revealed={revealed ? "1" : "0"}>
      <header className="imf-rank-head">
        <h3>{set.title}</h3>
        <p>{revealed ? "Compare with your prediction." : <>Put these substances in order of <b>boiling point</b>, lowest at the top. Decide before you check.</>}</p>
      </header>
      <ol className="imf-rank-list" aria-label="Your prediction, lowest boiling point first">
        <li className="imf-rank-end" aria-hidden="true">lowest boiling point</li>
        {order.map((id, i) => {
          const it = byId[id]; const pl = score?.places.find((p) => p.id === id);
          return (
            <li key={id} className="imf-rank-item" data-testid={`rank-item-${id}`} data-ok={pl ? (pl.ok ? "1" : "0") : undefined}>
              <span className="imf-rank-pos" aria-hidden="true">{i + 1}</span>
              <span className="imf-rank-name"><b>{it.label}</b> <small>{it.name}</small></span>
              {!revealed && (
                <span className="imf-rank-btns">
                  <button type="button" className="sim-btn imf-ico" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${it.label} up`} data-testid={`rank-up-${id}`}><ArrowUp size={15} aria-hidden="true" /></button>
                  <button type="button" className="sim-btn imf-ico" onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${it.label} down`} data-testid={`rank-down-${id}`}><ArrowDown size={15} aria-hidden="true" /></button>
                </span>
              )}
              {revealed && (
                <span className="imf-rank-reveal">
                  <span className="imf-rank-bp" data-testid={`rank-bp-${id}`}>{it.bp} °C</span>
                  <span className="imf-rank-tags">{it.forces.map((f) => <i key={f} data-f={f}>{FORCE_TAGS[f]}</i>)}</span>
                  <span className="imf-rank-why">{pl.ok ? "✓ " : `Correct place: ${pl.actual + 1}. `}{it.why}</span>
                </span>
              )}
            </li>
          );
        })}
        <li className="imf-rank-end" aria-hidden="true">highest boiling point</li>
      </ol>
      <p className="imf-sr" aria-live="polite">{live}</p>
      {revealed && (
        <p className="imf-rank-score" data-testid="rank-score" role="status">{score.perfect ? `All ${score.total} in the right place.` : `${score.correct} of ${score.total} in the right place.`} <span>{set.idea}</span></p>
      )}
      <div className="imf-btns imf-rank-actions">
        {!revealed ? (
          <>
            <button type="button" className="sim-btn sim-btn--primary" onClick={onReveal} data-testid="rank-check"><Check size={14} aria-hidden="true" /> Check my order</button>
            <button type="button" className="sim-btn" onClick={onShuffle} data-testid="rank-shuffle"><Shuffle size={14} aria-hidden="true" /> Shuffle</button>
          </>
        ) : (
          <button type="button" className="sim-btn sim-btn--primary" onClick={onAgain} data-testid="rank-again"><RotateCcw size={14} aria-hidden="true" /> Try again{attempt >= 1 ? ` (attempt ${attempt + 1})` : ""}</button>
        )}
      </div>
    </div>
  );
}
