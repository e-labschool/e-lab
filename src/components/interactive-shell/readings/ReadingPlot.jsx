// The Readings scatter plot as a pure SVG component with LITERAL colours, so the same markup is drawn on screen and
// serialised (renderToStaticMarkup) for the PNG export. Student points are solid dots; theory is a dashed line only when asked.

export const PLOT_W = 420;
export const PLOT_H = 300;
const M = { l: 54, r: 14, t: 16, b: 46 };
export const PALETTE = Object.freeze({ ink: "#1e2a44", muted: "#4a5a82", grid: "#d5deef", point: "#1b5fd1", pointEdge: "#ffffff", theory: "#b4400b", fit: "#0b7a55" });

const tickText = (v) => {
  if (v === 0) return "0";
  const a = Math.abs(v);
  const t = a >= 1000 || a < 0.01 ? v.toExponential(1).replace("e+", "e") : String(Number(v.toPrecision(4)));
  return t.replace("-", "−");
};

export default function ReadingPlot({ plot, xLabel, yLabel, title, showTheory, showFit, width = PLOT_W, height = PLOT_H, ariaLabel, palette = PALETTE, exporting = false }) {
  const [x0, x1] = plot.xRange; const [y0, y1] = plot.yRange;
  const sx = (x) => M.l + ((x - x0) / (x1 - x0 || 1)) * (PLOT_W - M.l - M.r);
  const sy = (y) => PLOT_H - M.b - ((y - y0) / (y1 - y0 || 1)) * (PLOT_H - M.t - M.b);
  const theory = showTheory && plot.theory?.length ? plot.theory : null;
  const fit = showFit ? plot.fit : null;
  const clipId = exporting ? "rd-clip-export" : "rd-clip";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} width={width} height={height} role="img" aria-label={ariaLabel} data-testid="reading-plot" style={{ display: "block", maxWidth: "100%", height: "auto" }}>
      <defs><clipPath id={clipId}><rect x={M.l} y={M.t} width={PLOT_W - M.l - M.r} height={PLOT_H - M.t - M.b} /></clipPath></defs>
      {title && <text x={PLOT_W / 2} y={11} textAnchor="middle" fontSize="11" fontWeight="700" fill={palette.ink} fontFamily="system-ui, sans-serif">{title}</text>}
      {plot.yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={PLOT_W - M.r} y1={sy(t)} y2={sy(t)} stroke={palette.grid} strokeWidth="1" />
          <text x={M.l - 6} y={sy(t) + 3.5} textAnchor="end" fontSize="11" fill={palette.muted} fontFamily="system-ui, sans-serif">{tickText(t)}</text>
        </g>
      ))}
      {plot.xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={PLOT_H - M.b} stroke={palette.grid} strokeWidth="1" />
          <text x={sx(t)} y={PLOT_H - M.b + 14} textAnchor="middle" fontSize="11" fill={palette.muted} fontFamily="system-ui, sans-serif">{tickText(t)}</text>
        </g>
      ))}
      <rect x={M.l} y={M.t} width={PLOT_W - M.l - M.r} height={PLOT_H - M.t - M.b} fill="none" stroke={palette.muted} strokeWidth="1.2" />
      <g clipPath={`url(#${clipId})`}>
        {theory && <polyline points={theory.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ")} fill="none" stroke={palette.theory} strokeWidth="2" strokeDasharray="6 4" />}
        {fit && (() => {
          const a = fit.slope * x0 + fit.intercept; const b = fit.slope * x1 + fit.intercept;
          return <line x1={sx(x0)} y1={sy(a)} x2={sx(x1)} y2={sy(b)} stroke={palette.fit} strokeWidth="2" />;
        })()}
      </g>
      {plot.points.map((p) => (
        <circle key={p.id} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill={palette.point} stroke={palette.pointEdge} strokeWidth="1.5" data-testid="reading-point" />
      ))}
      <text x={(M.l + PLOT_W - M.r) / 2} y={PLOT_H - 6} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={palette.ink} fontFamily="system-ui, sans-serif">{xLabel}</text>
      <text transform={`translate(13 ${(M.t + PLOT_H - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fontWeight="600" fill={palette.ink} fontFamily="system-ui, sans-serif">{yLabel}</text>
      {plot.points.length === 0 && (
        <text x={(M.l + PLOT_W - M.r) / 2} y={(M.t + PLOT_H - M.b) / 2} textAnchor="middle" fontSize="12" fill={palette.muted} fontFamily="system-ui, sans-serif">No readings yet: press Record reading.</text>
      )}
      {(theory || fit) && (
        <g fontFamily="system-ui, sans-serif" fontSize="10.5" fill={palette.ink}>
          <g transform={`translate(${M.l + 8} ${M.t + 8})`}>
            <circle cx="5" cy="0" r="4" fill={palette.point} /><text x="14" y="3.5">your readings</text>
            {theory && <><line x1="0" x2="10" y1="14" y2="14" stroke={palette.theory} strokeWidth="2" strokeDasharray="4 3" /><text x="14" y="17.5">theory</text></>}
            {fit && <><line x1="0" x2="10" y1={theory ? 28 : 14} y2={theory ? 28 : 14} stroke={palette.fit} strokeWidth="2" /><text x="14" y={theory ? 31.5 : 17.5}>best fit</text></>}
          </g>
        </g>
      )}
    </svg>
  );
}
