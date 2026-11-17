import { useMemo, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../lib/acidbase/acidbase-ui.css";
import "./HOHBalance.css";
import { waterState, DROP_CM3, WATER_VOLUME_CM3, MAX_ADDED_CM3 } from "../../lib/acidbase/addition.js";
import { formatScientific, formatPH, formatDelta } from "../../lib/acidbase/format.js";
import { kwAt, pKwAt, KW_TABLE_TEMPS } from "../../lib/acidbase/constants.js";

const CONCS = [0.01, 0.1, 1];
const DECADES = Array.from({ length: 15 }, (_, i) => -i); // 10^0 ... 10^-14

/** Height fraction 0..1 of a concentration on the chosen scale. */
export function barFraction(conc, scale, linMax) {
  if (scale === "log") return Math.min(1, Math.max(0, (Math.log10(conc) + 14) / 14));
  return Math.min(1, Math.max(0, conc / linMax));
}
const niceMax = (x) => { const e = Math.pow(10, Math.floor(Math.log10(Math.max(x, 1e-12)))); return [1, 2, 5, 10].map((m) => m * e).find((v) => v >= x) ?? 10 * e; };

function Body() {
  const { isViewport } = useSimulationPresentation();
  const [c, setC] = useState(0.1);
  const [drops, setDrops] = useState({ hcl: 0, naoh: 0 });
  const [scale, setScale] = useState("log");
  const [prev, setPrev] = useState(null);
  const [tC, setTC] = useState(25);
  const kw = kwAt(tC); const pKw = pKwAt(tC); const neutralPH = pKw / 2;
  const s = useMemo(() => waterState({ hclDrops: drops.hcl, naohDrops: drops.naoh, c, kw }), [drops, c, kw]);
  const linMax = niceMax(Math.max(s.H, s.OH));
  const total = drops.hcl + drops.naoh;
  const left = Math.max(0, Math.round((MAX_ADDED_CM3 - s.vAdded) / DROP_CM3));

  function add(kind, n) {
    const room = Math.min(n, left); if (room <= 0) return;
    setPrev(s.pH);
    setDrops((d) => ({ ...d, [kind]: d[kind] + room }));
  }
  const reset = () => { setDrops({ hcl: 0, naoh: 0 }); setPrev(null); setC(0.1); setScale("log"); setTC(25); };
  const dPH = prev == null ? null : formatDelta(s.pH - prev);
  const cls = Math.abs(s.pH - neutralPH) < 0.005 ? "Neutral" : s.pH < neutralPH ? "Acidic" : "Basic";
  const caption = total === 0 ? "Pure water" : `Water + ${drops.hcl ? `${drops.hcl} drop${drops.hcl > 1 ? "s" : ""} HCl` : ""}${drops.hcl && drops.naoh ? " + " : ""}${drops.naoh ? `${drops.naoh} drop${drops.naoh > 1 ? "s" : ""} NaOH` : ""}`;
  const nExcess = s.nH - s.nOH;
  const msg = total === 0
    ? `Pure water at ${tC} °C: [H⁺] = [OH⁻] = ${formatScientific(s.H, 2)} mol dm⁻³, so pH ${formatPH(s.pH)}${tC === 25 ? " (neutral)" : ` (still neutral: [H⁺] = [OH⁻]; neutral is pH ${formatPH(neutralPH)} here, not 7)`}. Every drop adds the same amount of acid or base.`
    : `n(H⁺) added = ${formatScientific(s.nH)} mol, n(OH⁻) added = ${formatScientific(s.nOH)} mol; the excess ${nExcess >= 0 ? "H⁺" : "OH⁻"} (${formatScientific(Math.abs(nExcess) || 1e-30)} mol) in ${s.totalCm3.toFixed(2)} cm³ sets the pH. H⁺ + OH⁻ → H₂O removes the other ion, keeping [H⁺][OH⁻] = Kw = ${formatScientific(kw, 2)}.${dPH ? ` Last addition changed pH by ${dPH}: equal drops, but the same moles matter less as the solution gets more acidic or basic.` : ""}`;
  const bar = (label, conc, colour) => { const f = barFraction(conc, scale, linMax); return (
    <div className="hoh-bar"><div className="hoh-bar-top">{label}</div>
      <div className="hoh-bar-track" role="img" aria-label={`${label} ${formatScientific(conc)} mol per cubic decimetre`}><div className="hoh-bar-fill" style={{ height: `${f * 100}%`, background: colour }} /></div>
      <div className="hoh-bar-val">{formatScientific(conc)}</div></div>); };

  return (
    <section className={"ab-root hoh sim-surface-dark" + (isViewport ? " is-viewport" : "")}>
      <div className="hoh-grid">
        <div className="ab-panel hoh-left">
          <h3 className="hoh-h">Reagents + {WATER_VOLUME_CM3} cm{"³"} water, {tC} °C</h3>
          <svg viewBox="0 0 140 120" className="ab-svg hoh-beaker" role="img" aria-label={caption}>
            <path d="M22 8 V98 Q22 112 36 112 H104 Q118 112 118 98 V8" fill="none" stroke="#9aa8bd" strokeWidth="2.5" />
            <path d={`M25 ${60 - Math.min(18, s.vAdded / 6)} H115 V98 Q115 109 104 109 H36 Q25 109 25 98 Z`} fill={s.pH < neutralPH - 0.5 ? "rgba(232,121,100,.45)" : s.pH > neutralPH + 0.5 ? "rgba(108,134,238,.5)" : "rgba(90,140,210,.35)"} />
          </svg>
          <p className="hoh-cap" data-testid="caption">{caption} ({s.totalCm3.toFixed(2)} cm{"³"})</p>
          <label className="ab-field">Reagent concentration
            <select value={c} onChange={(e) => { setC(Number(e.target.value)); setDrops({ hcl: 0, naoh: 0 }); setPrev(null); }} aria-label="Reagent concentration">{CONCS.map((x) => <option key={x} value={x}>{x.toFixed(x < 1 ? 3 : 2)} mol dm{"⁻³"}</option>)}</select></label>
          <label className="ab-field hoh-temp">Temperature: <strong>{tC} °C</strong> ({tC + 273} K)
            <input type="range" min="0" max="100" step="5" value={tC} onChange={(e) => setTC(Number(e.target.value))} aria-label="Temperature in degrees Celsius" aria-valuetext={`${tC} degrees Celsius, K w ${formatScientific(kw, 2)}`} /></label>
          <p className="ab-note">1 drop = {DROP_CM3} cm{"³"} = {formatScientific(c * DROP_CM3 / 1000)} mol</p>
          <div className="hoh-btns">
            <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("hcl", 1)}>+1 drop HCl</button>
            <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("hcl", 10)}>+10 drops HCl</button>
            <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("naoh", 1)}>+1 drop NaOH</button>
            <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("naoh", 10)}>+10 drops NaOH</button>
          </div>
          {left <= 0 && <p className="ab-note ab-warn">Limit: {MAX_ADDED_CM3} cm{"³"} of reagent ({MAX_ADDED_CM3 / DROP_CM3} drops) added, the beaker is full. Press Reset.</p>}
        </div>
        <div className="ab-panel hoh-mid">
          <div className="ab-row hoh-mid-head"><h3 className="hoh-h">Concentrations ({scale === "log" ? "logarithmic" : "linear"} scale)</h3>
            <div className="ab-btns" role="group" aria-label="Axis scale">
              <button type="button" className="sim-btn ab-btn" aria-pressed={scale === "log"} onClick={() => setScale("log")}>Log</button>
              <button type="button" className="sim-btn ab-btn" aria-pressed={scale === "linear"} onClick={() => setScale("linear")}>Linear</button></div></div>
          <div className="hoh-chart">
            <div className="hoh-axis" aria-hidden="true">
              {scale === "log" ? DECADES.map((d) => <span key={d} style={{ bottom: `${((d + 14) / 14) * 100}%` }}>10<sup>{d === 0 ? "0" : `−${-d}`}</sup></span>)
                : [0, 0.25, 0.5, 0.75, 1].map((f) => <span key={f} style={{ bottom: `${f * 100}%` }}>{formatScientific(f * linMax, 1).replace(" × 10⁰", "")}</span>)}
            </div>
            <div className="hoh-plot">
              {(scale === "log" ? DECADES.map((d) => (d + 14) / 14) : [0, 0.25, 0.5, 0.75, 1]).map((f) => <i key={f} className="hoh-grid-line" style={{ bottom: `${f * 100}%` }} />)}
              <div className="hoh-bars">{bar("[H⁺]", s.H, "#e8836a")}{bar("[OH⁻]", s.OH, "#7f98f2")}</div>
            </div>
          </div>
          <p className="ab-note">{"mol dm⁻³"}. {scale === "log" ? "Each gridline is a factor of 10, so equal heights mean equal concentrations and a 10⁷-fold change is only half the axis." : `Linear axis to ${formatScientific(linMax, 1)}: the smaller ion nearly vanishes.`}</p>
        </div>
        <div className="ab-panel hoh-right">
          <div className="hoh-ph"><span>pH</span><strong data-testid="ph">{formatPH(s.pH)}</strong><em className={"hoh-" + cls.toLowerCase()}>{cls}</em></div>
          <table className="ab-table"><tbody>
            <tr><th scope="row">pOH</th><td>{formatPH(s.pOH)}</td></tr>
            <tr><th scope="row">[H{"⁺"}][OH{"⁻"}] = K<sub>w</sub></th><td>{formatScientific(s.H * s.OH, 2)}</td></tr>
            <tr><th scope="row">pK<sub>w</sub> (pH + pOH)</th><td data-testid="pkw">{formatPH(pKw)}</td></tr>
            <tr><th scope="row">Neutral pH</th><td>{formatPH(neutralPH)}</td></tr>
            <tr><th scope="row">Volume</th><td>{s.totalCm3.toFixed(2)} cm{"³"}</td></tr>
          </tbody></table>
          <p className="ab-note">pH = {"−"}log{"₁₀"}[H{"⁺"}]. K<sub>w</sub> rises with temperature because ionisation of water is endothermic, so pure hot water has a lower pH but is still neutral. {KW_TABLE_TEMPS.includes(tC) ? "Tabulated value." : "Between table rows: interpolated."} At 25 °C the IB value 1.00 {"×"} 10{"⁻¹⁴"} is used.</p>
        </div>
      </div>
      <p className="hoh-msg" aria-live="polite" data-testid="message">{msg}</p>
      <div className="ab-btns"><button type="button" className="sim-btn ab-btn" onClick={reset}>Reset</button></div>
    </section>
  );
}

export default function HOHBalance({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="H+ - OH- Balance in Water" subtitle="Add HCl or NaOH and watch [H+], [OH-] and pH move together." compact={compact} standalone={standalone}>
      <Body />
    </InteractiveFrame>
  );
}
