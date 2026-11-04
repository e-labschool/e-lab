import { useMemo } from "react";
import { MiniSwitch, SettingToggle, SliderRow } from "../../../../components/simulation/SimulationDashboard.jsx";
import { CARRIER_PPM, FID_PRESETS } from "../../state/studioState.js";
import { larmorMHz } from "../physics/constants.js";
import { integrateHz, lorentzianFwhmHz, synthesizeFid, transformFid } from "../physics/fid.js";
import { buildFidModel, spectrumWindow } from "../physics/fidModel.js";
import LinePlot from "../../components/LinePlot.jsx";
import Slot from "../../components/Slot.jsx";
import { Explain, Group, PredictBox, Stats, TeacherNote } from "../../components/ui.jsx";
import { useSize } from "../../components/useSize.js";
import { useTimeline } from "../../components/useTimeline.js";
import { useStudio, useStudioActions } from "../../state/StudioContext.jsx";

export const FID_DURATION = 6; // 0-3 s: acquisition drawn, 3-6 s: the Fourier transform sweep
const ACQ_END = 3;
const WINDOWS = [{ id: 10, label: "10 ms" }, { id: 40, label: "40 ms" }, { id: 200, label: "200 ms" }, { id: 0, label: "Full" }];

/** Stage 2, activity 2: FIDExplorer + FourierTransformViewer. The FID is synthesised from the chosen resonances; the spectrum is the real FFT of the sampled FID. */
export default function SignalView({ slots }) {
  const a = useStudioActions();
  const b0 = useStudio((s) => s.b0Tesla);
  const f = useStudio((s) => s.fid);
  const mode = useStudio((s) => s.mode);
  const op = larmorMHz(b0);
  const model = useMemo(() => buildFidModel(f, op), [f.comps, f.t2starMs, f.noisePct, f.lbHz, op]); // eslint-disable-line react-hooks/exhaustive-deps
  const tl = useTimeline({ id: "fid", duration: FID_DURATION, events: [ACQ_END], initial: FID_DURATION });
  const tau = tl.t;
  const acqFrac = Math.min(1, tau / ACQ_END);
  const sweeping = tau > ACQ_END && tau < FID_DURATION;
  const sweepFrac = Math.min(1, Math.max(0, (tau - ACQ_END) / (FID_DURATION - ACQ_END)));
  const [fidRef, fidSz] = useSize(); const [specRef, specSz] = useSize();
  const [win0, win1] = spectrumWindow(model, f.zoom);
  const windowMs = f.windowMs === 0 ? (model.acq.aq * 1000) : f.windowMs;
  const nWin = Math.min(model.fid.n, Math.max(2, Math.round(windowMs / 1000 / model.acq.dwell)));
  const tms = useMemo(() => { const t = new Float64Array(model.fid.n); for (let i = 0; i < t.length; i += 1) t[i] = i * model.acq.dwell * 1000; return t; }, [model]);
  const nCut = Math.max(2, Math.round(nWin * (tau <= 0 ? 0 : acqFrac)));
  const single = useMemo(() => {
    if (!f.compare) return null;
    const c = { ...model.comps[0], amplitude: 1 / model.comps.length }; // the first resonance alone, same T2* and noise-free for clarity
    const s = synthesizeFid({ components: [c], dwell: model.acq.dwell, n: Math.min(model.fid.n, nWin + 2), noise: 0 });
    return s.re;
  }, [f.compare, model, nWin]);
  const singleSpec = useMemo(() => {
    if (!f.compare) return null;
    const c = { ...model.comps[0], amplitude: 1 / model.comps.length };
    const sp = transformFid(synthesizeFid({ components: [c], dwell: model.acq.dwell, n: model.fid.n, noise: 0 }), { lbHz: f.lbHz, zeroFillTo: 2 * model.acq.n });
    const y = new Float64Array(sp.size); for (let i = 0; i < y.length; i += 1) y[i] = sp.re[i] / model.specMax; return y;
  }, [f.compare, f.lbHz, model]);
  const specY = useMemo(() => { const y = new Float64Array(model.spec.size); for (let i = 0; i < y.length; i += 1) y[i] = model.spec.re[i] / model.specMax; return y; }, [model]);
  const pSweep = win1 - sweepFrac * (win1 - win0);
  const revealFrom = useMemo(() => {
    if (!sweeping) return 0;
    // first index whose ppm >= pSweep (ppm ascending)
    let lo = 0; let hi = model.ppm.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (model.ppm[m] < pSweep) lo = m + 1; else hi = m; } return lo;
  }, [sweeping, pSweep, model]);
  const showFid = f.view !== "freq"; const showSpec = f.view !== "time";
  const specSeries = useMemo(() => {
    const from = sweeping ? revealFrom : 0;
    return { x: model.ppm.subarray(from), y: specY.subarray(from) };
  }, [sweeping, revealFrom, model, specY]);
  const probe = useMemo(() => {
    if (!sweeping) return null; const fHz = (pSweep - CARRIER_PPM) * op; const n = 500; const x = new Float64Array(n); const y = new Float64Array(n);
    for (let i = 0; i < n; i += 1) { const t = (i / (n - 1)) * windowMs; x[i] = t; y[i] = 0.9 * Math.cos(2 * Math.PI * fHz * (t / 1000)); } return { x, y };
  }, [sweeping, pSweep, op, windowMs]);
  const yMax = 1.15 + model.noise * 3;
  const areas = useMemo(() => model.comps.map((c) => integrateHz(model.spec, c.freqHz - Math.max(15, 5 * model.fwhmHz), c.freqHz + Math.max(15, 5 * model.fwhmHz))), [model]);
  const minArea = Math.min(...areas.map((x) => Math.abs(x))) || 1;

  const setComp = (i, ppm) => a.patch("fid", { preset: "custom", comps: f.comps.map((c, k) => (k === i ? { ...c, ppm } : c)) });
  const setPreset = (id) => a.patch("fid", { preset: id, comps: FID_PRESETS[id].comps.map((c) => ({ ...c })) });
  const transform = () => { a.patch("fid", { view: f.view === "time" ? "both" : f.view }); tl.jump(ACQ_END); a.setPlaying(true); };
  const back = () => { a.patch("fid", { view: "time" }); a.setPlaying(false); tl.jump(ACQ_END); };

  const text = tau <= 0
    ? "Press Play to acquire the signal. The receiver records the voltage from the coil as it varies with time: the free induction decay (FID)."
    : tau < ACQ_END
      ? `The FID is being recorded: ${model.comps.length === 1 ? "one damped oscillation" : `the sum of ${model.comps.length} damped oscillations, one per resonance`}. Frequency sets how fast it oscillates; T₂* = ${f.t2starMs} ms sets how fast it dies away.`
      : sweeping
        ? `Fourier transform: the computer tests the FID against oscillations of every frequency (probe at ${(pSweep).toFixed(2)} ppm). Where the FID contains that frequency the result is large, so a line appears.`
        : f.view === "time"
          ? "This is the time-domain signal. All the information is here, but the several frequencies are mixed together. Press Transform to Spectrum."
          : `The spectrum (real FFT of the sampled FID) shows ${model.comps.length} line${model.comps.length > 1 ? "s" : ""} at the frequencies present in the signal; line width ${model.fwhmHz.toFixed(1)} Hz. The transform reveals components already in the signal, it does not create molecular information.`;

  return (
    <>
      <div className="ss-signal" data-testid="signal-view" data-phase={sweeping ? "transform" : tau < ACQ_END ? "acquire" : "done"}>
        <div className="ss-signal-bar">
          <MiniSwitch ariaLabel="Domain shown" testId="domain-switch" value={f.view} onChange={(v) => a.patch("fid", { view: v })}
            options={[{ id: "time", label: "Time domain (FID)" }, { id: "freq", label: "Frequency domain (spectrum)" }, { id: "both", label: "Both" }]} />
          <span className="ss-sample-note">{model.comps.length} resonance{model.comps.length > 1 ? "s" : ""} · illustrative signal · {op.toFixed(1)} MHz</span>
        </div>
        {showFid && (
          <div className="ss-signal-plot" ref={fidRef} data-testid="fid-plot-box">
            <LinePlot
              width={fidSz.width} height={fidSz.height} xDomain={[0, nWin * model.acq.dwell * 1000]} yDomain={[-yMax, yMax]} xLabel="time t (ms)" yLabel="signal (relative)" testId="plot-fid"
              ariaLabel="Free induction decay: signal amplitude against time, an oscillation that decays" yTicks={[-1, -0.5, 0, 0.5, 1]}
              series={[
                { x: tms.subarray(0, nCut), y: model.fid.re.subarray(0, nCut), color: "#fcd34d", width: 1.4 },
                f.compare && single ? { x: tms.subarray(0, Math.min(nCut, single.length)), y: single.subarray(0, Math.min(nCut, single.length)), color: "#c7d2ea", width: 1.2, dash: "5 4", opacity: 0.9 } : null,
                probe ? { x: probe.x, y: probe.y, color: "#2dd4bf", width: 1, opacity: 0.55 } : null,
              ].filter(Boolean)}
              overlay={({ sx, sy }) => (
                <g>
                  <path d={Array.from({ length: 80 }, (_, i) => { const t = (i / 79) * nWin * model.acq.dwell; const env = model.comps.reduce((s, c) => s + c.amplitude * Math.exp(-t / c.t2star), 0); return `${i ? "L" : "M"}${sx(t * 1000).toFixed(1)},${sy(env).toFixed(1)}`; }).join("")} fill="none" stroke="var(--ss-orange)" strokeWidth="1.2" strokeDasharray="4 4" opacity="0.8" />
                  <text x={sx(nWin * model.acq.dwell * 1000 * 0.98)} y={sy(yMax * 0.85)} textAnchor="end" className="ss-svgtext ss-svgtext--sm" fill="#fdba74">dashed: decay envelope Σ A·e^(−t/T₂*)</text>
                </g>
              )}
            />
          </div>
        )}
        {showSpec && (
          <div className="ss-signal-plot" ref={specRef} data-testid="spec-plot-box">
            <LinePlot
              width={specSz.width} height={specSz.height} xDomain={[win0, win1]} yDomain={[-0.08, 1.25]} reverseX xLabel="chemical shift δ (ppm) — higher δ to the left" yLabel="intensity" testId="plot-spectrum"
              ariaLabel="Spectrum obtained by Fourier transform of the FID: one line for each resonance" yTicks={[0, 0.5, 1]}
              markers={sweeping ? [{ x: pSweep, color: "#2dd4bf", dash: "none" }] : []}
              series={[{ x: specSeries.x, y: specSeries.y, color: "#2dd4bf", width: 1.8, fillTo: 0 },
                f.compare && singleSpec && !sweeping ? { x: model.ppm, y: singleSpec, color: "#c7d2ea", width: 1.3, dash: "5 4", opacity: 0.9 } : null,
              ].filter(Boolean)}
              overlay={({ sx, sy }) => (!sweeping ? model.comps.map((c, i) => (
                <g key={i}>
                  <text x={sx(c.ppm)} y={sy(Math.min(1.18, 1.05))} textAnchor="middle" className="ss-svgtext" fill="#5eead4" data-testid={`peak-label-${i}`}>{c.ppm.toFixed(2)}</text>
                  {model.comps.length > 1 && <text x={sx(c.ppm)} y={sy(1.05) + 14} textAnchor="middle" className="ss-svgtext ss-svgtext--sm">area {(Math.abs(areas[i]) / minArea).toFixed(1)}</text>}
                </g>
              )) : null)}
            />
          </div>
        )}
        {!showSpec && <p className="ss-hint ss-signal-foot">Time-domain data: all frequencies are superimposed. Use <b>Transform to Spectrum</b> to separate them.</p>}
      </div>

      <Slot target={slots.controls}>
        <Group title="Signal" testId="grp-signal">
          <div className="ss-btnrow">
            <button type="button" className="sd-btn sd-btn--primary" onClick={transform} data-testid="btn-transform">Transform to Spectrum</button>
            <button type="button" className="sd-btn" onClick={back} data-testid="btn-back-fid" disabled={f.view === "time"}>Back to FID</button>
          </div>
          <MiniSwitch ariaLabel="Resonances" testId="preset-switch" fill value={f.preset === "custom" ? "" : f.preset} onChange={setPreset}
            options={Object.entries(FID_PRESETS).map(([id, p]) => ({ id, label: id === "single" ? "One" : id === "two" ? "Two" : "Three", title: p.label }))} />
          {f.comps.map((c, i) => (
            <SliderRow
              key={i} id={`ss-fid-f${i}`} label={f.comps.length === 1 ? "Signal frequency" : `Resonance ${i + 1}`} symbol="δ" value={c.ppm} min={0} max={10} step={0.05} onChange={(v) => setComp(i, v)}
              color="#fcd34d" badgeBg="#8a6a0c" badgeText={`${c.ppm.toFixed(2)} ppm`} minText="0" maxText="10" valueText={`${c.ppm.toFixed(2)} parts per million`} testId={`fid-f${i}`}
              note={`${(((c.ppm - CARRIER_PPM) * op)).toFixed(0)} Hz from the carrier at ${op.toFixed(1)} MHz${f.comps.length > 1 ? ` · amplitude ${c.amp}` : ""}`} noteTone="info"
            />
          ))}
          <SliderRow
            id="ss-fid-t2" label="Dephasing time" symbol="T₂*" value={f.t2starMs} min={10} max={1000} step={5} onChange={(v) => a.patch("fid", { t2starMs: v })} color="#fb923c" badgeBg="#9a4a0b"
            badgeText={`${f.t2starMs} ms`} minText="10" maxText="1000" valueText={`${f.t2starMs} milliseconds`} testId="fid-t2"
            note={`Line width = 1/(πT₂*) = ${lorentzianFwhmHz(f.t2starMs / 1000).toFixed(1)} Hz`} noteTone="info"
          />
          <SliderRow
            id="ss-fid-noise" label="Noise level" value={f.noisePct} min={0} max={50} step={1} onChange={(v) => a.patch("fid", { noisePct: v })} color="#a78bfa" badgeBg="#5b3fb0"
            badgeText={`${f.noisePct} %`} minText="0" maxText="50" valueText={`${f.noisePct} percent`} testId="fid-noise"
          />
          <SliderRow
            id="ss-fid-lb" label="Line broadening" symbol="apodisation" value={f.lbHz} min={0} max={10} step={0.5} onChange={(v) => a.patch("fid", { lbHz: v })} color="#38bdf8" badgeBg="#0b5d8f"
            badgeText={`${f.lbHz.toFixed(1)} Hz`} minText="0" maxText="10" valueText={`${f.lbHz} hertz`} testId="fid-lb"
          />
        </Group>
        <Group title="Display" testId="grp-fid-display">
          <MiniSwitch ariaLabel="Time window" testId="window-switch" fill value={f.windowMs} onChange={(v) => a.patch("fid", { windowMs: v })} options={WINDOWS} />
          <SettingToggle id="ss-fid-compare" label="Compare with one resonance" hint="Dashed: the first resonance alone" checked={f.compare} onChange={(v) => a.patch("fid", { compare: v })} testId="toggle-compare" />
          <SettingToggle id="ss-fid-zoom" label="Zoom the spectrum to the signals" checked={f.zoom} onChange={(v) => a.patch("fid", { zoom: v })} testId="toggle-zoom" />
        </Group>
        {mode === "student" && (
          <PredictBox
            testId="predict-fid" question="A FID contains three different frequencies. How many lines will its spectrum show?"
            options={[{ id: "1", label: "One" }, { id: "3", label: "Three" }, { id: "n", label: "One per proton" }]} correct="3"
            feedback={(id) => (id === "3" ? "Right: the Fourier transform separates the signal into its frequency components, one line per distinct resonance frequency." : "The transform only shows the frequencies present in the signal. Three frequencies give three lines, however many protons contribute to each.")}
          />
        )}
        <TeacherNote title="Teacher: what the Fourier transform does and does not do">
          <p>Each resonance contributes a damped oscillation e<sup>−t/T₂*</sup>cos(2πνt). Its transform is a Lorentzian line at ν with full width at half height 1/(πT₂*), and area proportional to the amplitude. The FT <b>reveals</b> frequency components already present in the measured signal; it does not create information about the molecule.</p>
          <p>The plotted spectrum is a real FFT of the {model.fid.n.toLocaleString("en-US")} sampled points (dwell {(model.acq.dwell * 1e6).toFixed(0)} µs, spectral width {(model.acq.sw / 1000).toFixed(1)} kHz = 20 ppm), first point halved, zero-filled ×2. Phase is set to zero by construction (an idealisation); real data are phased by the operator or software.</p>
        </TeacherNote>
      </Slot>
      <Slot target={slots.graph}>
        <Group title="Frequency components" testId="grp-components">
          <Stats columns={2} items={[
            { id: "sw", label: "Spectral width", value: (model.acq.sw / 1000).toFixed(1), unit: "kHz" },
            { id: "aq", label: "Acquisition time", value: model.acq.aq.toFixed(2), unit: "s" },
            { id: "dw", label: "Dwell time", value: (model.acq.dwell * 1e6).toFixed(0), unit: "µs" },
            { id: "res", label: "Digital resolution", value: (1 / model.acq.aq).toFixed(2), unit: "Hz/pt" },
          ]} />
          <ul className="ss-comp-list" data-testid="component-list">
            {model.comps.map((c, i) => (
              <li key={i}><b>δ {c.ppm.toFixed(2)} ppm</b> = {c.freqHz >= 0 ? "+" : "−"}{Math.abs(c.freqHz).toFixed(0)} Hz · FWHM {model.fwhmHz.toFixed(1)} Hz · area {(Math.abs(areas[i]) / minArea).toFixed(2)}</li>
            ))}
          </ul>
          <p className="ss-hint">Higher frequency (higher δ) appears to the left. Peak areas stay in the ratio of the amplitudes however the lines are broadened.</p>
        </Group>
      </Slot>
      <Explain slots={slots}>{text}</Explain>
    </>
  );
}
