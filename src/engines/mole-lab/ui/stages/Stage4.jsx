import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Pin, ArrowUpFromLine } from "lucide-react";
import ZoneBench from "../../scene/ZoneBench.jsx";
import StageFrame from "../StageFrame.jsx";
import { CalcPanel, PredictCard, ReferencePanel, Segmented, ValueField } from "../parts.jsx";
import { ZoneControls, ApplyCard } from "./StageParts456.jsx";
import useZoneInteraction from "./useZoneInteraction.js";
import { packEntries } from "../benchEntries.js";
import { stage4View } from "../../engine/views456.js";
import { stage4Prediction, stage4Apply } from "../../engine/tutor456.js";
import { GAS_IDS, GAS_LIMITS } from "../../engine/gasLab.js";
import { getSubstance } from "../../engine/substances.js";
import { fmtMol, fmtSig, fromQuanta } from "../../engine/numeric.js";
import { particleCaption } from "../../engine/particles.js";

const STAGE = { id: 4, title: "Gas Volume Laboratory", purpose: "See how the volume of a gas depends on the amount of gas, and why the 24 dm³ mol⁻¹ rule only holds near room temperature and pressure." };
const AMOUNTS = [0.5, 1, 2, 3];
const T_PRESETS = [{ k: 273.15, l: "0 °C" }, { k: 298.15, l: "25 °C" }, { k: 373.15, l: "100 °C" }];
const P_PRESETS = [50, 101.325, 200];

export default function Stage4({ store, shell }) {
  const { state, dispatch, getState } = store; const { layout, reduced, dark, detail, onSlow, mode } = shell;
  const view = stage4View(state); const sc = state.scenes[4]; const d = sc.data; const ex = view.exact; const tx = view.text; const sub = view.substance;
  const guided = mode === "guided"; const rtp = d.model === "rtp";
  const chamberQ = ex.chamberQ; const stockQ = ex.stockQ;
  const [tUnit, setTUnit] = useState("K"); const [calcOpen, setCalcOpen] = useState(false);
  const live = useRef({});
  const prediction = useMemo(() => (chamberQ === 0 && stockQ > 0 ? stage4Prediction({ gasId: d.gasId, nMol: fromQuanta(stockQ), model: d.model, tK: d.tempK, pPa: d.pressurePa, policy: state.policy }) : null), [chamberQ, stockQ, d.gasId, d.model, d.tempK, d.pressurePa, state.policy]);
  const answered = prediction ? d.predictions[prediction.key] : null;
  const gated = guided && Boolean(prediction) && !answered;
  const ix = useZoneInteraction({ getState, dispatch, stage: 4, vesselId: "chamber", reduced, resetKey: shell.resetNonce, gate: () => (gated ? "Answer the prediction question first." : "") });
  useEffect(() => { shell.debug.current = { ...shell.debug.current, ix, live }; });
  const cap = layout === "narrow" ? 4 : 5;
  const stock = useMemo(() => sc.packets, [sc.packets]);
  const rows = useMemo(() => [packEntries(stock, cap)], [stock, cap]);
  const apply = useMemo(() => stage4Apply(d.gasId), [d.gasId]);
  const M = ex.molarMassGPerMol;

  live.current = { gasId: d.gasId, n: ex.n, volumeDm3: ex.n > 0 ? ex.volumeDm3 : 0, scale: ex.scale, tK: ex.tK, pKPa: ex.pKPa, molarMass: M,
    lcd: { title: rtp ? "RTP CONVENTION" : "PV = nRT", v: ex.n > 0 ? tx.volume.replace(" dm³", "") : "0.0", t: rtp ? "≈298 K" : `${ex.tK.toFixed(2)} K`, p: rtp ? "≈101 kPa" : `${ex.pKPa.toFixed(1)} kPa`, n: `${fmtMol(ex.n)} mol`, note: rtp ? "Vm ≈ 24 dm³/mol (rounded)" : `Vm = ${ex.vm.toFixed(2)} dm³/mol` } };

  const run = (r) => { if (r && r.last && !r.last.ok) ix.say(r.last.message, "warn"); else if (r?.last) ix.say(r.last.message, "ok"); return r; };
  const D = (a) => run(dispatch({ ...a, stage: 4 }));
  const onAnswer = (c) => { dispatch({ type: "guide/answer", stage: 4, key: prediction.key, choice: c.id, correct: c.correct }); };
  const tVal = tUnit === "K" ? fmtSig(ex.tK, 5) : fmtSig(ex.tC, 4);
  const setT = (v) => D(tUnit === "K" ? { type: "s4/setTemperature", kelvin: v } : { type: "s4/setTemperature", celsius: v });
  const setP = (v) => D({ type: "s4/setPressure", kPa: v });
  const packetLabel = (p) => `${fmtMol(fromQuanta(p.q))} mol ${sub.formulaDisplay}`;
  const pinned = d.pinned;

  const overlay = (
    <div className="ml-overlay" data-ml-overlay>
      <div className="ml-chip-row">
        <span className="ml-pill" data-testid="ml-entity-pill">{sub.formulaDisplay} · {sub.name} · M = {tx.molarMass}</span>
        <span className={"ml-pill" + (rtp ? " ml-pill--note" : "")} data-testid="ml-model-pill">{rtp ? "At RTP: Vm = 24 dm³ mol⁻¹ (room temperature and pressure)" : `PV = nRT at ${tx.temperature}, ${tx.pressure}`}</span>
      </div>
    </div>
  );
  const workspace = (aspect) => (
    <ZoneBench ix={ix} kind="gas" rows={rows} live={live} detail={detail} aspect={aspect} reduced={reduced} dark={dark} onSlow={onSlow} overlay={overlay} testId="ml-bench"
      ariaLabel={`3D gas laboratory: ${tx.amount} of ${sub.name} in the chamber occupies ${tx.volume}; ${tx.stockAmount} still in packets`} fallbackNotice="The chamber reading and the calculation panel still work." />
  );

  const controls = (
    <div className="ml-controls" data-testid="ml-controls-4">
      {guided && prediction && <section className="ml-card" aria-label="Prediction"><PredictCard prediction={prediction} answered={answered} onAnswer={onAnswer} /></section>}
      <section className="ml-card" aria-label="Gas and amount">
        <div className="ml-field"><span className="ml-label" id="ml4-gas-l">Gas</span>
          <div className="ml4-gases" role="radiogroup" aria-labelledby="ml4-gas-l" data-testid="ml-gas">
            {GAS_IDS.map((id) => { const s = getSubstance(id); return (
              <button key={id} type="button" role="radio" aria-checked={d.gasId === id} className="ml4-gas" onClick={() => { ix.cancel(); D({ type: "s4/selectGas", gasId: id }); }} data-testid={`ml-gas-${id}`} title={s.name}>
                <b>{s.formulaDisplay}</b><small>{s.name}</small></button>); })}
          </div></div>
        <p className="ml-hint" data-testid="ml-gas-shape">{tx.geometry} · M = {tx.molarMass}</p>
        <div className="ml4-row">
          <ValueField label="Amount in the packets" value={fmtMol(ex.stockN)} unit="mol" onCommit={(v) => D({ type: "s4/setAmount", value: v })} error={d.error && /amount|mol|number|empty|greater|least/i.test(d.error) ? d.error : null} testId="ml-amount-input" hint={`0 to ${GAS_LIMITS.nMaxMol} mol`} />
        </div>
        <div className="ml-quick" role="group" aria-label="Quick amounts">
          {AMOUNTS.map((n) => <button key={n} type="button" className={"ml-chip" + (ex.stockN === n ? " is-on" : "")} aria-pressed={ex.stockN === n} onClick={() => D({ type: "s4/setAmount", value: n })} data-testid={`ml-quick-${n}`}>{fmtMol(n)} mol</button>)}
        </div>
        <Segmented label="Gas model" value={d.model} onChange={(v) => D({ type: "s4/setModel", model: v })} testId="ml-model" options={[{ value: "rtp", label: "At RTP (24 dm³ mol⁻¹)", title: "Vm ≈ 24 dm³ mol⁻¹ (rounded teaching value)" }, { value: "ideal", label: "Advanced: PV = nRT", title: "SI units, you choose T and P" }]} />
        {rtp ? <p className="ml-hint" data-testid="ml-rtp-note">At RTP (room temperature and pressure, about 25 °C and 1 atm) the molar volume is taken as 24 dm³ mol⁻¹, so 0.5 mol → 12 dm³, 1 mol → 24 dm³, 2 mol → 48 dm³. PV = nRT gives a slightly different figure at 298 K and 1.00 × 10⁵ Pa (about 24.8 dm³ mol⁻¹; 24.47 at 298.15 K and 101.325 kPa), so 24 is a rounded value that holds only near these conditions. Switch to Advanced to change temperature and pressure.</p> : (
          <div className="ml4-adv" data-testid="ml-advanced">
            <div className="ml4-row">
              <ValueField label={`Temperature`} value={tVal} unit={tUnit === "K" ? "K" : "°C"} onCommit={setT} error={d.error && /temperature|K\b|0 K|kelvin/i.test(d.error) ? d.error : null} testId="ml-temp-input" hint={`${GAS_LIMITS.tMinK} to ${GAS_LIMITS.tMaxK} K`} />
              <Segmented compact label="Temperature unit" value={tUnit} onChange={setTUnit} testId="ml-tunit" options={[{ value: "K", label: "K" }, { value: "C", label: "°C" }]} />
              <ValueField label="Pressure" value={fmtSig(ex.pKPa, 5)} unit="kPa" onCommit={setP} error={d.error && /pressure|kPa/i.test(d.error) ? d.error : null} testId="ml-press-input" hint={`${GAS_LIMITS.pMinKPa} to ${GAS_LIMITS.pMaxKPa} kPa`} />
            </div>
            <div className="ml-quick" role="group" aria-label="Temperature presets">{T_PRESETS.map((t) => <button key={t.k} type="button" className={"ml-chip" + (Math.abs(ex.tK - t.k) < 1e-6 ? " is-on" : "")} onClick={() => D({ type: "s4/setTemperature", kelvin: t.k })} data-testid={`ml-t-${t.l.replace(/\W/g, "")}`}>{t.l}</button>)}</div>
            <div className="ml-quick" role="group" aria-label="Pressure presets">{P_PRESETS.map((p) => <button key={p} type="button" className={"ml-chip" + (Math.abs(ex.pKPa - p) < 1e-6 ? " is-on" : "")} onClick={() => setP(String(p))} data-testid={`ml-p-${p}`}>{p} kPa</button>)}</div>
            {view.flags.caution && <p className="ml4-banner ml4-banner--warn" role="note" data-testid="ml-caution">{view.flags.cautionText}</p>}
          </div>
        )}
        {d.error && !/amount|mol|number|empty|greater|least|temperature|pressure|kPa|K\b/i.test(d.error) && <p className="ml-error" role="alert">{d.error}</p>}
      </section>
      <section className="ml-card" aria-label="Packets and chamber">
        <ZoneControls packets={stock} ix={ix} getLabel={packetLabel} zoneName="into the chamber" zoneVerb="Release into chamber" why={gated ? "Answer the prediction question first." : ""} busy={Boolean(ix.bench.current.pour)} />
        <div className="ml-pc-actions">
          <button type="button" className="sim-btn" disabled={chamberQ <= 0} onClick={() => { ix.cancel(); D({ type: "s4/collect" }); }} data-testid="ml-collect-btn" title="Pull the gas back into packets"><ArrowUpFromLine size={14} aria-hidden="true" /> Collect gas</button>
          <button type="button" className="sim-btn" disabled={chamberQ <= 0} onClick={() => D({ type: "s4/pin" })} data-testid="ml-pin-btn" title="Save this reading to compare"><Pin size={14} aria-hidden="true" /> Save to compare</button>
          <button type="button" className="sim-btn ml-reset-stage" onClick={() => { ix.cancel(); dispatch({ type: "reset", stage: 4 }); ix.say("Reset to the starting state.", "ok"); }} data-testid="ml-reset-stage"><RotateCcw size={14} aria-hidden="true" /> Reset this stage</button>
        </div>
      </section>
      {pinned.length > 0 && (
        <section className="ml-card" aria-label="Comparison" data-testid="ml-compare">
          <div className="ml4-tablewrap"><table className="ml4-table"><caption className="ml4-cap">Saved readings</caption>
            <thead><tr><th scope="col">Gas</th><th scope="col">n / mol</th><th scope="col">T / K</th><th scope="col">p / kPa</th><th scope="col">V / dm³</th><th scope="col">Vm</th></tr></thead>
            <tbody>{pinned.map((p) => <tr key={p.id}><th scope="row">{getSubstance(p.gasId).formulaDisplay}</th><td>{fmtMol(fromQuanta(p.nQ))}</td><td>{fmtSig(p.tK, 5)}</td><td>{fmtSig(p.pPa / 1000, 5)}</td><td>{fmtSig(p.volumeDm3, 4)}</td><td>{fmtSig(p.vm, 4)}</td></tr>)}</tbody></table></div>
          <button type="button" className="sim-btn" onClick={() => D({ type: "s4/unpin" })} data-testid="ml-unpin-btn">Clear saved readings</button>
        </section>
      )}
      {guided && <ApplyCard q={apply} unit="mol" how="n = V ÷ Vm = 36 ÷ 24" testId="ml-apply" />}
    </div>
  );

  const summary = ex.n > 0 ? `${tx.amount} × ${tx.vm} = ${tx.volume}` : "Release a packet into the chamber to see the volume";
  const calc = (
    <CalcPanel open={calcOpen} onToggle={setCalcOpen} summary={summary}>
      {guided && gated ? <p className="ml-muted" data-testid="ml-calc-locked">Answer the prediction first, then the working appears here.</p> : (
        <div className="ml-calc-grid">
          <div><h4>Live calculation</h4><ol className="ml-lines" data-testid="ml-working">{ex.n > 0 ? tx.lines.map((l) => <li key={l}>{l}</li>) : <li>The chamber is empty (V = 0).</li>}</ol></div>
          <div><h4>This gas</h4>
            <ul className="ml-lines" data-testid="ml-gas-facts"><li>Molar mass: {tx.molarMass}</li><li>Density here: M ÷ Vm = {tx.density}</li><li>Molecules per dm³: {tx.particleDensity}</li><li>Typical speed (v<sub>rms</sub>): {tx.speed}</li></ul>
            <p className="ml-muted" data-testid="ml-density-note">Different gases have different densities (M ÷ Vm) but, at the same T and p, the same Vm and the same number of molecules per dm³. Lighter molecules move faster at the same temperature.</p></div>
          <div><h4>What it means</h4><p data-testid="ml-explain">{rtp ? "The 24 dm³ mol⁻¹ value is a rounded convention for about 25 °C and about 1 atm; at 273 K and 1 atm it is about 22.4 dm³ mol⁻¹. The molar volume changes with temperature and pressure." : `Warmer gas takes more room, higher pressure squeezes it. The advanced result differs from the 24 convention by ${tx.difference}.`} {particleCaption(d.gasId, detail)} The drawn molecules are representative (12 per mol drawn, not 6.022 × 10²³) and the packet is a counting analogy, not a volume.</p></div>
        </div>
      )}
    </CalcPanel>
  );
  return <StageFrame layout={layout} stageTitle={STAGE.title} stageBlurb={STAGE.purpose} workspace={workspace} controls={controls} calc={calc} reference={<ReferencePanel compact={layout !== "wide"} />} status={ix.message.text || state.last?.message || "Choose a gas and an amount, then release a packet into the chamber."} statusTone={ix.message.tone === "warn" ? "warn" : "info"} />;
}
