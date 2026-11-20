import { useState } from "react";
import { CheckCircle2, Activity, CircleDot, ChevronDown } from "lucide-react";
import { REACTIONS, GEOMETRY, ATOM_STYLE } from "../model/reactions.js";
import { visualCounts } from "../model/visual.js";
import { chemSnapshot } from "../model/chem.js";
import { everydaySnapshot, positionLabel } from "../model/everyday.js";
import { STATUS_LABEL, SUCCESS, STAGES, ANALOGY, advancedNote, disturbanceExplanation, everydayNotice, everydayWhy, fmt, quotientSentence, positionText } from "../model/explain.js";
import { kp } from "../model/thermo.js";

export function EquilibriumIndicator({ status, kind, simple, mismatch, compact }) {
  const Icon = status === "attained" ? CheckCircle2 : status === "near" ? CircleDot : Activity;
  const label = STATUS_LABEL[status] ?? STATUS_LABEL.approaching;
  const text = status === "attained" ? (kind === "ev" ? (simple ? SUCCESS.everydaySimple : SUCCESS.everyday) : (simple ? SUCCESS.chemSimple : SUCCESS.chem)) : null;
  return (
    <div className={`eq-indicator is-${status}`} data-testid="eq-indicator" data-status={status} role="status" aria-live="polite">
      <Icon size={18} aria-hidden="true" />
      <div><strong data-testid="eq-indicator-label">{status === "attained" ? SUCCESS.title : label}</strong>
        {!compact && (text ? <p>{text}</p> : <p className="eq-faint">{status === "empty" ? "Add something to the vessel to see the reaction." : `Rates differ by ${fmt(mismatch * 100, 2)}%. They are compared with a tolerance, never with exact equality.`}</p>)}
      </div>
    </div>
  );
}

/** Static 3D-projected structure of one species (the same coordinates the vessel uses), with element symbols so it never relies on colour. */
export function MoleculeIcon({ geom, width = 64, height = 40 }) {
  const g = GEOMETRY[geom]; if (!g) return null;
  const yaw = 0.55; const pitch = -0.45; const cy = Math.cos(yaw); const sy = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
  const pts = g.atoms.map((a) => { const x = a.x * cy + a.z * sy; const z1 = -a.x * sy + a.z * cy; return { el: a.el, x, y: a.y * cp - z1 * sp, z: a.y * sp + z1 * cp }; });
  const xs = pts.map((q) => q.x); const ys = pts.map((q) => q.y); const rMax = 1.0;
  const w = Math.max(...xs) - Math.min(...xs) + 2 * rMax; const h = Math.max(...ys) - Math.min(...ys) + 2 * rMax; const k = Math.min((width - 4) / w, (height - 4) / h);
  const ox = width / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k; const oy = height / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * k;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="eq-molicon">
      {g.bonds.map(([i, j, o], n) => { const a = pts[i]; const b = pts[j]; const dx = b.x - a.x; const dy = b.y - a.y; const L = Math.hypot(dx, dy) || 1; const lines = o >= 3 ? 3 : o >= 1.5 ? 2 : 1;
        return Array.from({ length: lines }, (_, m) => { const off = (m - (lines - 1) / 2) * 2.4; return <line key={`${n}-${m}`} x1={ox + a.x * k - (dy / L) * off} y1={oy + a.y * k + (dx / L) * off} x2={ox + b.x * k - (dy / L) * off} y2={oy + b.y * k + (dx / L) * off} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />; }); })}
      {[...pts].sort((p, q) => p.z - q.z).map((a, n) => { const st = ATOM_STYLE[a.el] ?? { color: "#888", label: a.el, r: 0.6 }; const r = Math.max(4.2, st.r * k * 0.95);
        return (<g key={n}><circle cx={ox + a.x * k} cy={oy + a.y * k} r={r} fill={st.color} stroke="rgba(20,24,40,.7)" strokeWidth="1" /><text x={ox + a.x * k} y={oy + a.y * k + 3} textAnchor="middle" fontSize={Math.max(6.5, r * 0.95)} fontWeight="800" fill={st.dark ? "#1f2937" : "#fff"}>{st.label}</text></g>); })}
    </svg>
  );
}

export function SpeciesTable({ tr }) {
  const rx = REACTIONS[tr.s.rid]; const m = visualCounts(tr.vis);
  return (
    <table className="eq-table eq-species" data-testid="species-table">
      <caption className="eq-sr">Species in the vessel: structure, concentration from the engine and drawn molecules (one stands for {rx.run.unit} mol)</caption>
      <thead><tr><th scope="col">Species</th><th scope="col">mol dm⁻³</th><th scope="col">Drawn</th></tr></thead>
      <tbody>{rx.species.map((s) => (
        <tr key={s.id}><th scope="row"><MoleculeIcon geom={s.geom} /><span className="eq-spname"><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke={s.color} strokeWidth="3.5" strokeDasharray={s.dash || undefined} strokeLinecap="round" /></svg><b>{s.formula}</b>{s.note ? <small>{s.note}</small> : null}</span></th>
          <td data-testid={`conc-${s.id}`}>{fmt(tr.s.c[s.id], 3)}</td><td data-testid={`drawn-${s.id}`}>{m[s.id]}</td></tr>))}</tbody>
    </table>
  );
}

/** Q versus K bar: left of centre = Q < K (net forward), right = Q > K (net reverse). */
export function QKPanel({ tr, simple }) {
  const ch = tr.s; const rx = REACTIONS[ch.rid]; const sn = chemSnapshot(ch); const [open, setOpen] = useState(true);
  const lq = sn.Q === 0 ? -3 : !Number.isFinite(sn.Q) ? 3 : Math.max(-3, Math.min(3, Math.log10(sn.Q / sn.Kc)));
  const pos = 50 + (lq / 3) * 46;
  const note = advancedNote(rx, ch, simple);
  return (
    <section className="eq-card eq-qk" data-testid="qk-panel" data-direction={sn.direction}>
      <button type="button" className="eq-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="qk-toggle"><h3>{simple ? "Q and K" : "Equilibrium constant K and reaction quotient Q"}</h3><ChevronDown size={16} className={open ? "is-open" : ""} aria-hidden="true" /></button>
      {open && (<>
        <dl className="eq-kv">
          <div><dt>K<sub>c</sub> = {rx.kcExpr}</dt><dd data-testid="kc-value">{fmt(sn.Kc)}{rx.units.K ? <small> {rx.units.K}</small> : null}</dd></div>
          <div><dt>Q (now)</dt><dd data-testid="q-value">{fmt(sn.Q)}</dd></div>
          <div><dt>Forward rate r<sub>f</sub></dt><dd data-testid="rf-value">{fmt(sn.rf)}</dd></div>
          <div><dt>Reverse rate r<sub>r</sub></dt><dd data-testid="rr-value">{fmt(sn.rr)}</dd></div>
        </dl>
        <div className="eq-qkbar" role="img" aria-label={`Q is ${sn.direction === "equilibrium" ? "equal to" : sn.direction === "forward" ? "less than" : "greater than"} K`}>
          <div className="eq-qkbar-track"><span className="eq-qkbar-mid" /><span className="eq-qkbar-dot" style={{ left: `${pos}%` }} /></div>
          <div className="eq-qkbar-labels"><span>Q &lt; K: net forward →</span><span>K</span><span>← net reverse: Q &gt; K</span></div>
        </div>
        <p className="eq-qktext" data-testid="qk-text">{quotientSentence({ Q: sn.Q, K: sn.Kc, direction: sn.direction }, simple)}</p>
        {ch.rid === "ab" && <p className="eq-faint" data-testid="position-text">{positionText(sn.Kc, simple)}</p>}
        <details className="eq-adv"><summary>{simple ? "More detail" : "Advanced note (K, K_p, assumptions)"}</summary><ul>{note.map((t, i) => <li key={i}>{t}</li>)}</ul>
          {rx.gas && rx.id !== "ab" && <p className="eq-faint">K<sub>p</sub> = {fmt(kp(rx, ch.T, { kfRef: ch.kfRef, krRef: ch.krRef }))} bar{rx.dnGas ? <sup>{rx.dnGas}</sup> : null}</p>}</details>
      </>)}
    </section>
  );
}

export function Guide({ progress, kind, simple }) {
  const [view, setView] = useState(null); const shown = view ?? progress;
  const st = STAGES[shown - 1];
  const text = kind === "ev" ? (simple ? st.simple : st.prompt) : st.chem;
  return (
    <section className="eq-guide" data-testid="guide" aria-label="Learning stages (suggestions, nothing is locked)">
      <ol className="eq-stages">
        {STAGES.map((s) => (<li key={s.n}><button type="button" className={"eq-stage" + (s.n === progress ? " is-now" : s.n < progress ? " is-done" : "") + (s.n === shown ? " is-view" : "")} aria-current={s.n === progress ? "step" : undefined} aria-pressed={s.n === shown} data-testid={`stage-${s.n}`} onClick={() => setView(s.n === progress ? null : s.n)} title={s.title}>
          <i>{s.n < progress ? "✓" : s.n}</i><span>{s.short}</span></button></li>))}
      </ol>
      <p className="eq-stagetext" data-testid="stage-text"><b>{st.n}. {st.title}.</b> {text}</p>
    </section>
  );
}

export function BeforeAfter({ tr, kind, on, onToggle }) {
  const b = tr.before; if (!b || !tr.info) return null;
  const rx = kind === "ev" ? null : REACTIONS[tr.s.rid];
  const now = kind === "ev" ? everydaySnapshot(tr.s) : chemSnapshot(tr.s);
  const rows = kind === "ev"
    ? [["Forward rate", b.rf, now.rfDet], ["Reverse rate", b.rr, now.rrDet], ["A (mean)", b.A, now.detA], ["B (mean)", b.B, now.detB]]
    : [["K", b.K, now.Kc], ["Q", b.Q, now.Q], ["Forward rate", b.rf, now.rf], ["Reverse rate", b.rr, now.rr], ...rx.species.map((s) => [`[${s.formula}]`, b.c[s.id], tr.s.c[s.id]])];
  return (
    <div className="eq-ba" data-testid="before-after">
      <button type="button" className="eq-btn eq-btn--small" aria-pressed={on} onClick={onToggle} data-testid="compare-toggle">{on ? "Hide before / after" : "Compare before and after"}</button>
      {on && (<table className="eq-table"><caption className="eq-sr">Values just before the last disturbance and now</caption><thead><tr><th scope="col">Quantity</th><th scope="col">Before</th><th scope="col">Now</th></tr></thead>
        <tbody>{rows.map(([n, a, c]) => (<tr key={n}><th scope="row">{n}</th><td>{fmt(a)}</td><td>{fmt(c)}</td></tr>))}</tbody></table>)}
    </div>
  );
}

export function Explanation({ kind, tr, scene, simple, mode, cmpOn, onCmp }) {
  const lines = tr.info ? (kind === "ev" ? everydayNotice(tr, simple) : disturbanceExplanation(tr, simple)) : null;
  const sn = kind === "ev" ? everydaySnapshot(tr.s) : null;
  return (
    <section className="eq-card eq-explain" data-testid="explanation" aria-label="Explanation">
      <h3>{simple ? "What is happening" : "What is happening"}</h3>
      {kind === "ev" && (<p className="eq-pos" data-testid="position-label">{simple ? "Where the crowds settle:" : "Equilibrium position:"} <b>{sn.position === "Balanced" ? "Balanced" : sn.position === "Towards reactants" ? "Towards A" : "Towards B"}</b> (B<sub>eq</sub> / A<sub>eq</sub> = k<sub>f</sub> / k<sub>r</sub> = {fmt(sn.K)}; expected A = {fmt(sn.Aeq, 3)}, B = {fmt(sn.Beq, 3)})</p>)}
      {lines ? (<ul className="eq-notice" data-testid="notice">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>)
        : (<p>{kind === "ev" ? (scene.started ? "Watch both buses. The blue bus carries people from A to B and the orange bus carries them from B to A." : "Press Start. All 100 people begin in City A.") : (scene.started ? "Watch the concentrations and the two rates." : "Press Start. Only reactants are present at first.")}</p>)}
      {kind === "ev" && <p className="eq-why" data-testid="why">{everydayWhy(sn, simple)}</p>}
      {kind === "ch" && REACTIONS[tr.s.rid].colourNote && <p className="eq-faint">{REACTIONS[tr.s.rid].colourNote}</p>}
      {kind === "ch" && <p className="eq-faint" data-testid="teaching-note">{REACTIONS[tr.s.rid].source}</p>}
      <BeforeAfter tr={tr} kind={kind} on={cmpOn} onToggle={onCmp} />
      {mode !== "chemical" && (<details className="eq-analogy" data-testid="analogy-limits" open={mode === "compare"}><summary>{simple ? "What the buses can and cannot show" : "What the analogy does and does not explain"}</summary>
        <div className="eq-two"><div><h4>It shows</h4><ul>{(simple ? ANALOGY.explainsSimple : ANALOGY.explains).map((t) => <li key={t}>{t}</li>)}</ul></div>
          <div><h4>It does not show</h4><ul>{(simple ? ANALOGY.doesNotSimple : ANALOGY.doesNot).map((t) => <li key={t}>{t}</li>)}</ul></div></div></details>)}
    </section>
  );
}
export { positionLabel };
