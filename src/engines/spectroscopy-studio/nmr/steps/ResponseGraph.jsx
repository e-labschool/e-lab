import { memo, useMemo } from "react";
import LinePlot from "../../components/LinePlot.jsx";
import { useSize } from "../../components/useSize.js";
import { CW_CAVEAT, CW_SPAN_HZ, CW_TITLE, CW_X_LABEL, cwAbsorption, cwCurve, cwFwhm, cwRegion } from "../physics/cwResponse.js";

const CURVE = cwCurve(CW_SPAN_HZ, 401);
const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x))}`;
const REGION_TEXT = { on: "On resonance: maximum response", near: "Near resonance: partial response", off: "Off resonance: little or no response" };
const REGION_SHORT = { on: "On resonance (maximum)", near: "Near resonance", off: "Off resonance" };
const REGION_COLOR = { on: "var(--ss-ok)", near: "var(--ss-warn)", off: "var(--ss-muted)" };

/**
 * Step 3 graph: the simplified continuous-wave resonance response, a Lorentzian of FINITE width (not a spike at one exact frequency), against the
 * offset of the RF from resonance. A vertical indicator follows the RF slider; 0 Hz is marked. Memoised: it only re-renders when the offset or size changes.
 */
function ResponseGraph({ off }) {
  const [ref, size] = useSize(); const width = size.width; const height = size.height;
  const fwhm = cwFwhm(); const abs = cwAbsorption(off); const region = cwRegion(off);
  const compact = height < 150 || width < 360;
  const ariaLabel = `${CW_TITLE}: a peak of finite width centred on 0 hertz. The RF is ${signed(off)} hertz from resonance, ${REGION_TEXT[region].toLowerCase()}, ${Math.round(abs * 100)} percent of the maximum.`;
  const series = useMemo(() => [{ x: CURVE.x, y: CURVE.y, color: "var(--ss-cyan)", width: 3, fillTo: 0 }], []);
  return (
    <div className="ss-graphcol" data-testid="cw-graph-col">
      <div className="ss-graphhead">
        <div className="ss-graphtitle">
          <b data-testid="cw-label">{CW_TITLE}</b>
          <span className="ss-graphstate" style={{ "--c": REGION_COLOR[region] }} data-testid="cw-state" data-region={region}>{REGION_SHORT[region]}</span>
        </div>
        <span data-testid="cw-caveat">{CW_CAVEAT}</span>
      </div>
      <div className="ss-graphplot" ref={ref}>
        <LinePlot
          width={width} height={height} series={series} xDomain={[-CW_SPAN_HZ, CW_SPAN_HZ]} yDomain={[0, 1.18]} xLabel={CW_X_LABEL} yLabel={["Relative excitation /", "absorption response"]}
          xFormat={signed} yFormat={(v) => (v === 0 ? "0" : v)} xTicks={[-100, -50, 0, 50, 100]} yTicks={[0, 0.5, 1]}
          margin={{ l: compact ? 56 : 66, r: 14, t: 22, b: 40 }} ariaLabel={ariaLabel} testId="cw-graph"
          overlay={({ sx, sy, plot }) => {
            const xi = sx(off); const x0 = sx(0); const yb = plot.t + plot.h;
            const edge = Math.abs(off) > CW_SPAN_HZ * 0.6;
            const right = (off >= 0) !== edge; // side of the indicator on which its label sits (towards the open space, flipped near the plot edges)
            return (
              <g data-testid="cw-overlay" data-offset={off} data-region={region} data-on-resonance={region === "on" ? "1" : "0"} data-fwhm={fwhm.toFixed(3)}>
                <rect x={sx(-fwhm / 2)} width={sx(fwhm / 2) - sx(-fwhm / 2)} y={plot.t} height={plot.h} fill="var(--ss-amber)" opacity={region === "on" ? 0.26 : 0.09} data-testid="cw-resonance-band" />
                <line x1={x0} x2={x0} y1={plot.t} y2={yb} stroke="var(--ss-amber)" strokeWidth="2" strokeDasharray="6 4" data-testid="cw-resonance-line" />
                <text x={x0} y={plot.t - 6} textAnchor="middle" className="ss-svgtext ss-svgtext--b" fill="var(--ss-amber)" data-testid="cw-resonance-label">resonance, 0 Hz</text>
                <g data-testid="cw-fwhm">
                  <line x1={sx(-fwhm / 2)} x2={sx(fwhm / 2)} y1={sy(0.5)} y2={sy(0.5)} stroke="var(--ss-ink)" strokeWidth="1.6" markerStart="url(#ss-gr-arr)" markerEnd="url(#ss-gr-arr)" />
                  {!compact && (right
                    ? <text x={sx(-fwhm / 2) - 8} y={sy(0.5) - 5} textAnchor="end" className="ss-svgtext ss-svgtext--sm" fill="var(--ss-ink)">{`linewidth (FWHM) ${fwhm.toFixed(0)} Hz`}</text>
                    : <text x={sx(fwhm / 2) + 8} y={sy(0.5) - 5} className="ss-svgtext ss-svgtext--sm" fill="var(--ss-ink)">{`linewidth (FWHM) ${fwhm.toFixed(0)} Hz`}</text>)}
                </g>
                <defs><marker id="ss-gr-arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker></defs>
                <line x1={xi} x2={xi} y1={plot.t} y2={yb} stroke="var(--ss-rf)" strokeWidth="2.6" data-testid="cw-indicator" data-x={xi.toFixed(2)} data-x0={x0.toFixed(2)} />
                <circle cx={xi} cy={sy(abs)} r={region === "on" ? 8 : 6} fill="var(--ss-rf)" stroke="#fff" strokeWidth="2.2" data-testid="cw-dot" data-y={abs.toFixed(4)} />
                <text x={xi + (right ? 12 : -12)} y={abs > 0.8 ? sy(abs) + 4 : sy(abs) - 9} textAnchor={right ? "start" : "end"} className="ss-svgtext ss-svgtext--b ss-halo" fill="var(--ss-rf)">{abs >= 0.995 ? "100 % (max)" : `${Math.round(abs * 100)} %`}</text>
              </g>
            );
          }}
        />
      </div>
    </div>
  );
}
export default memo(ResponseGraph);
