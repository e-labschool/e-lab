import { niceTicks } from "../../components/LinePlot.jsx";

/** Heights for a build-up animation: peak i grows during its own slice of progress p (0..1), in order of m/z. */
export function staggerHeights(peaks, p) {
  const sorted = [...peaks].sort((a, b) => a.mz - b.mz); const n = sorted.length; const out = {};
  sorted.forEach((pk, i) => { const k = Math.min(1, Math.max(0, p * (n + 1.2) - i)); const e = k * k * (3 - 2 * k); out[pk.mz] = pk.rel * e; });
  return out;
}
const roleOf = (pk) => (pk.role === "M" ? "M" : pk.role === "M+2" ? "M2" : pk.role === "isotope" ? "iso" : "frag");

/**
 * Stick mass spectrum (SVG, pixel sized). peaks [{mz, rel, label, role}], x-axis m/z, y-axis relative intensity (%), tallest = 100.
 *   heights    optional {mz: height} overriding rel (animation / detector build-up)
 *   colorBy    "role" (molecular ion orange, fragments cyan, isotope partners violet) | "plain"
 *   labels     "mz" | "ion" (formulas where there is room) | "none"
 *   marks      write "M⁺•" / "base peak" tags (never in the unknown-compound stage)
 *   selected / onSelect   click or keyboard on a peak; `selected` can be one m/z or an array
 *   picked     m/z values to outline as the student's answers
 */
export default function MsSpectrum({
  width, height, peaks, heights = null, xRange = null, colorBy = "role", labels = "mz", marks = false, selected = null, onSelect = null, picked = [],
  ariaLabel, testId = "ms-spectrum", colors = null, yLabel = "Relative intensity (%)", compact = false, baseMz = null, mMz = null, yMax = 100,
}) {
  const narrow = width < 460 || compact;
  const m = { l: narrow ? 36 : 48, r: 12, t: marks ? 30 : 18, b: narrow ? 30 : 38 };
  const W = Math.max(120, width); const H = Math.max(110, height);
  const pw = W - m.l - m.r; const ph = H - m.t - m.b;
  const mzs = peaks.map((p) => p.mz);
  const [x0, x1] = xRange ?? [Math.max(0, Math.min(...mzs) - 2), Math.max(...mzs) + 2];
  const sx = (v) => m.l + ((v - x0) / (x1 - x0)) * pw; const sy = (v) => m.t + (1 - v / yMax) * ph;
  const barW = Math.max(3, Math.min(compact ? 8 : 14, (pw / (x1 - x0)) * 0.5));
  const sel = Array.isArray(selected) ? selected : selected === null ? [] : [selected];
  const xt = niceTicks(x0, x1, Math.max(3, Math.floor(pw / (narrow ? 60 : 80)))).filter((t) => Number.isInteger(t));
  const yt = [0, 25, 50, 75, 100].filter((v) => v <= yMax);
  const sorted = [...peaks].sort((a, b) => a.mz - b.mz);
  const minGap = sorted.slice(1).reduce((g, p, i) => Math.min(g, sx(p.mz) - sx(sorted[i].mz)), Infinity);
  const showIon = labels === "ion" && minGap >= (narrow ? 62 : 74);
  const fs = narrow ? 11 : 12.5;
  const baseTag = baseMz ?? null; const mTag = mMz ?? null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={ariaLabel} data-testid={testId} className="ms-spec" data-peaks={peaks.length}>
      <rect x={m.l} y={m.t} width={pw} height={ph} className="ss-plot-bg" />
      {yt.map((v) => <line key={`gy${v}`} x1={m.l} x2={m.l + pw} y1={sy(v)} y2={sy(v)} className="ss-grid" />)}
      {yt.map((v) => <text key={`ty${v}`} x={m.l - 6} y={sy(v) + 4} textAnchor="end" className="ss-tick">{v}</text>)}
      {xt.map((v) => <g key={`tx${v}`}><line x1={sx(v)} x2={sx(v)} y1={m.t + ph} y2={m.t + ph + 4} className="ss-axis" /><text x={sx(v)} y={m.t + ph + 17} textAnchor="middle" className="ss-tick">{v}</text></g>)}
      <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" className="ss-axis" />
      <text x={m.l + pw / 2} y={H - 3} textAnchor="middle" className="ss-axis-label">m/z</text>
      <text transform={`translate(11 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ss-axis-label">{yLabel}</text>
      {sel.length > 0 && sel.filter((v) => peaks.some((p) => p.mz === v)).map((v) => <line key={`cur${v}`} x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + ph} className="ms-cursor" />)}
      {sorted.map((pk) => {
        const h = heights ? heights[pk.mz] ?? 0 : pk.rel; const x = sx(pk.mz); const y = sy(h);
        const isSel = sel.includes(pk.mz); const isPicked = picked.includes(pk.mz); const role = colorBy === "role" ? roleOf(pk) : "plain";
        const tag = marks && h > 0.5 ? (pk.mz === mTag && pk.mz === baseTag ? "M⁺• = base peak" : pk.mz === mTag ? "M⁺•" : pk.mz === baseTag ? "base peak" : null) : null;
        const labelY = Math.max(m.t + 11, y - 5);
        return (
          <g key={pk.mz} className={`ms-peak${isSel ? " is-sel" : ""}${onSelect ? " is-click" : ""}`} data-testid={`peak-${pk.mz}`} data-mz={pk.mz} data-rel={h.toFixed(2)} data-role={role} data-selected={isSel ? "1" : "0"}
            role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={onSelect ? `Peak at m/z ${pk.mz}, ${Math.round(pk.rel)} percent` : undefined} aria-pressed={onSelect ? isSel : undefined}
            onClick={onSelect ? () => onSelect(pk.mz) : undefined} onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(pk.mz); } } : undefined}>
            {onSelect && <rect x={x - Math.max(barW / 2 + 6, 9)} y={m.t} width={Math.max(barW + 12, 18)} height={ph} className="ms-hit" />}
            <rect x={x - barW / 2} y={y} width={barW} height={Math.max(0, m.t + ph - y)} className={`ms-bar ms-bar--${role}`} style={colors?.[pk.mz] ? { fill: colors[pk.mz] } : undefined} rx="1.5" />
            {isPicked && <rect x={x - barW / 2 - 3} y={Math.max(m.t, y - 3)} width={barW + 6} height={Math.max(0, m.t + ph - y + 3)} className="ms-picked" rx="3" />}
            {labels !== "none" && h > 0.5 && (
              <text x={x} y={labelY} textAnchor="middle" className={`ms-peaklabel${isSel ? " is-sel" : ""}`} fontSize={fs}>
                {showIon && pk.label ? <><tspan fontWeight="800">{pk.mz}</tspan><tspan dx="3" className="ms-peakion">{pk.label}</tspan></> : pk.mz}
              </text>
            )}
            {tag && <text x={x} y={Math.max(m.t - 12, labelY - fs - 3)} textAnchor="middle" className="ms-peaktag">{tag}</text>}
          </g>
        );
      })}
    </svg>
  );
}
