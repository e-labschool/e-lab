import { useMemo } from "react";
import LinePlot from "../../components/LinePlot.jsx";
import { useSize } from "../../components/useSize.js";
import { ease } from "../../components/useAnim.js";
import { EnvBadge } from "../molecular/components/SpectrumPlot.jsx";
import { buildSignals } from "../molecular/model/spectrum.js";
import { getMolecule } from "../molecular/model/molecules.js";
import { fidSeries, spectrumSeries } from "./signalData.js";

/**
 * THE graph of step 5. One box, two layers: the FID (time domain) and the spectrum (frequency domain, chemical shift). `morph` 0..1 is the
 * progress of the transform: the FID fades back while the spectrum (already computed by a real FFT) is revealed from left to right behind a scan line.
 */
export default function SignalGraph({ model, morph, moleculeId, nu0 }) {
  const [ref, size] = useSize();
  const fs = useMemo(() => fidSeries(model), [model]);
  const ss = useMemo(() => spectrumSeries(model), [model]);
  const marks = useMemo(() => (moleculeId ? buildSignals(getMolecule(moleculeId), { freqMHz: nu0, coupling: true }).map((s) => ({ id: s.envId, env: s.env, ppm: s.deltaPpm })) : []), [moleculeId, nu0]);
  const reveal = ease(morph); const scanning = morph > 0.01 && morph < 0.995;
  const w = size.width; const h = size.height;
  const fidOpacity = 1 - 0.92 * Math.min(1, reveal * 1.4);
  const specOpacity = Math.min(1, reveal * 3);
  const [lo, hi] = ss.window;
  return (
    <div className="ss-graphbox ss-graphbox--layers" ref={ref} data-testid="signal-graph" data-morph={morph.toFixed(2)} data-mode={morph < 0.02 ? "time" : morph > 0.98 ? "freq" : "transforming"}>
      <div className="ss-layer" style={{ opacity: fidOpacity }} aria-hidden={morph > 0.5 ? "true" : undefined} data-testid="layer-fid">
        <LinePlot
          width={w} height={h} series={[{ x: fs.x, y: fs.y, color: "var(--ss-mag)", width: 1.7 }]} xDomain={fs.window} yDomain={[-1.15, 1.15]} xLabel="time (ms)  ·  free induction decay (FID)" yLabel="signal (voltage)"
          xFormat={(v) => String(Math.round(v * 1000))} yFormat={() => ""} yTicks={[0]} margin={{ l: 40, r: 20, t: 10, b: 44 }} ariaLabel={`Free induction decay of ${model.label}: a decaying oscillation that is the sum of ${model.comps.length} frequencies`} testId="fid-plot"
        />
      </div>
      <div className="ss-layer" style={{ opacity: specOpacity, clipPath: `inset(0 ${((1 - reveal) * 100).toFixed(2)}% 0 0)` }} aria-hidden={morph < 0.5 ? "true" : undefined} data-testid="layer-spectrum">
        <LinePlot
          width={w} height={h} series={[{ x: ss.x, y: ss.y, color: "var(--ss-teal)", width: 2, fillTo: 0 }]} xDomain={[lo, hi]} yDomain={[-0.02, 1.2]} reverseX xLabel="chemical shift δ (ppm)  ·  higher δ on the left" yLabel="intensity" yFormat={() => ""} yTicks={[0]} margin={{ l: 40, r: 20, t: 10, b: 44 }}
          ariaLabel={`Spectrum of ${model.label} obtained by Fourier transform of the FID: ${model.comps.length} lines`} testId="spectrum-plot"
          overlay={({ sx, plot }) => (
            <g>
              {marks.map((m) => (m.ppm >= lo && m.ppm <= hi ? <g key={m.id} transform={`translate(${sx(m.ppm)} ${plot.t + 14})`} data-testid={`peak-mark-${m.id}`}><EnvBadge env={m.env} r={9} /></g> : null))}
              {scanning && <line x1={plot.l + reveal * plot.w} x2={plot.l + reveal * plot.w} y1={plot.t} y2={plot.t + plot.h} stroke="#fff" strokeWidth="2" strokeDasharray="4 3" data-testid="scan-line" />}
            </g>
          )}
        />
      </div>
    </div>
  );
}
