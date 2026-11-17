// Hand-drawn SVG laboratory glassware and stands for the Mixture Separation Lab. Everything is drawn in code (no image files).
// Coordinate system of every scene: viewBox 0 0 640 480, bench surface at y = 430.
import { useId } from "react";

export const VB = { w: 640, h: 480, bench: 430 };

/** Shared gradients / filters. Render once at the top of each scene. */
export function Defs({ p }) {
  return (
    <defs>
      <linearGradient id={`${p}-metal`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#c3cadb" /><stop offset="0.45" stopColor="#8a93a8" /><stop offset="1" stopColor="#5d667b" /></linearGradient>
      <linearGradient id={`${p}-metalV`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#aab2c5" /><stop offset="1" stopColor="#5d667b" /></linearGradient>
      <linearGradient id={`${p}-glass`} x1="0" x2="1" y1="0" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity="0.75" /><stop offset="0.25" stopColor="#dbeaff" stopOpacity="0.18" /><stop offset="0.8" stopColor="#cfe0f8" stopOpacity="0.12" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.6" /></linearGradient>
      <linearGradient id={`${p}-bench`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d6deec" /><stop offset="1" stopColor="#bcc7da" /></linearGradient>
      <linearGradient id={`${p}-flameO`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#4f7bff" stopOpacity="0.95" /><stop offset="0.6" stopColor="#8fb2ff" stopOpacity="0.75" /><stop offset="1" stopColor="#d6e4ff" stopOpacity="0.1" /></linearGradient>
      <linearGradient id={`${p}-flameI`} x1="0" x2="0" y1="1" y2="0"><stop offset="0" stopColor="#1d3fd8" /><stop offset="1" stopColor="#5c86ff" stopOpacity="0.4" /></linearGradient>
      <linearGradient id={`${p}-ceramic`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fbfaf6" /><stop offset="1" stopColor="#d9d5c9" /></linearGradient>
      <radialGradient id={`${p}-shadow`}><stop offset="0" stopColor="#1b2540" stopOpacity="0.22" /><stop offset="1" stopColor="#1b2540" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

export function Bench({ p }) {
  return (
    <g aria-hidden="true">
      <rect x="0" y={VB.bench} width={VB.w} height={VB.h - VB.bench} fill={`url(#${p}-bench)`} />
      <rect x="0" y={VB.bench} width={VB.w} height="3" fill="#aab6cc" />
      <rect x="0" y={VB.bench + 3} width={VB.w} height="2" fill="#e9eef7" opacity="0.8" />
    </g>
  );
}

/** Soft contact shadow under an object standing at (cx, VB.bench). */
export const Shadow = ({ p, cx, w = 90 }) => <ellipse cx={cx} cy={VB.bench + 5} rx={w / 2} ry="6" fill={`url(#${p}-shadow)`} aria-hidden="true" />;

/** Numbered target ring marking where the NEXT part will go (it does not show the part, so it does not give the answer away). */
export function NextSlot({ x, y, n, w = 70, h = 70 }) {
  return (
    <g className="ms-slot" aria-hidden="true">
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx="14" fill="none" stroke="var(--ms-accent)" strokeWidth="2" strokeDasharray="6 5" />
      <circle cx={x - w / 2} cy={y - h / 2} r="11" fill="var(--ms-accent)" />
      <text x={x - w / 2} y={y - h / 2 + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">{n}</text>
    </g>
  );
}

/** A beaker whose rim is at (x, y) with width w, height h. Returns glass + optional liquid / solids. */
export function Beaker({ p, x, y, w = 90, h = 110, level = 0, liquid = "#6cb4ef", liquidOpacity = 0.7, children, turbid = 0, solids = null, tilt = 0, clip = "bk", label = null, spout = true }) {
  const id = `${p}-${clip}`;
  const r = 7; const inset = 5;
  const d = `M${x},${y} L${x + inset},${y + h - r} Q${x + inset},${y + h} ${x + inset + r},${y + h} L${x + w - inset - r},${y + h} Q${x + w - inset},${y + h} ${x + w - inset},${y + h - r} L${x + w},${y} `;
  const cx = x + w / 2; const cy = y + h;
  const liqY = y + h - Math.max(0, Math.min(1, level)) * (h - 10);
  return (
    <g transform={tilt ? `rotate(${tilt} ${cx} ${cy})` : undefined}>
      <clipPath id={id}><path d={`${d} Z`} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {level > 0.003 && (
          <>
            <rect x={x} y={liqY} width={w} height={y + h - liqY + 2} fill={liquid} opacity={liquidOpacity} />
            {turbid > 0 && <rect x={x} y={liqY} width={w} height={y + h - liqY + 2} fill="#b79a68" opacity={Math.min(0.55, turbid * 0.55)} />}
            <rect x={x} y={liqY} width={w} height="4" fill="#fff" opacity="0.45" />
          </>
        )}
        {solids}
        {children}
      </g>
      <path d={d} fill="none" stroke="var(--ms-glass-stroke)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={`${d} Z`} fill={`url(#${p}-glass)`} />
      {spout && <path d={`M${x - 3},${y} L${x + w + 3},${y}`} stroke="var(--ms-glass-stroke)" strokeWidth="2.4" strokeLinecap="round" />}
      <path d={`M${x + 11},${y + 8} L${x + 14},${y + h - 18}`} stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {label && <text x={cx} y={y + h + 18} textAnchor="middle" className="ms-svg-label">{label}</text>}
    </g>
  );
}

/** Round-bottomed flask: centre cx, neck top y0. Radius r. Level 0..1 of the sphere height. */
export function Flask({ p, cx, y0, r = 52, neckW = 24, neckH = 46, level = 0.5, liquid = "#6cb4ef", liquidOpacity = 0.7, boiling = false, children, clip = "fl", granules = false, solids = null, turbid = 0 }) {
  const id = `${p}-${clip}`;
  const cy = y0 + neckH + r - 2;
  const a = Math.asin(Math.min(0.98, neckW / 2 / r));
  const lx = cx - Math.sin(a) * r; const rx = cx + Math.sin(a) * r; const ly = cy - Math.cos(a) * r;
  const d = `M${cx - neckW / 2},${y0} L${cx - neckW / 2},${ly} A${r},${r} 0 1 0 ${cx + neckW / 2},${ly} L${cx + neckW / 2},${y0}`;
  void lx; void rx;
  const liqY = cy + r - level * 2 * r;
  return (
    <g>
      <clipPath id={id}><path d={`${d} Z`} /></clipPath>
      <g clipPath={`url(#${id})`}>
        {level > 0.003 && (
          <>
            <rect x={cx - r - 2} y={liqY} width={2 * r + 4} height={cy + r - liqY + 3} fill={liquid} opacity={liquidOpacity} />
            {turbid > 0 && <rect x={cx - r - 2} y={liqY} width={2 * r + 4} height={cy + r - liqY + 3} fill="#b79a68" opacity={Math.min(0.5, turbid * 0.5)} />}
            <rect x={cx - r - 2} y={liqY} width={2 * r + 4} height="4" fill="#fff" opacity="0.45" />
          </>
        )}
        {solids}
        {granules && [[-14, 36], [6, 41], [20, 30]].map(([dx, dy], i) => <rect key={i} x={cx + dx} y={cy + dy - 6} width="5" height="5" rx="1" fill="#c9a96b" stroke="#8a6f3d" strokeWidth="0.8" />)}
        {boiling && level > 0.05 && Array.from({ length: 7 }, (_, i) => <circle key={i} className="ms-bubble" style={{ animationDelay: `${i * 0.23}s` }} cx={cx - 26 + i * 9} cy={cy + r - 8} r={2 + (i % 3)} fill="#fff" opacity="0.8" />)}
        {children}
      </g>
      <path d={d} fill="none" stroke="var(--ms-glass-stroke)" strokeWidth="2.2" strokeLinecap="round" />
      <path d={`${d} Z`} fill={`url(#${p}-glass)`} />
      <path d={`M${cx - r * 0.62},${cy - r * 0.18} A${r * 0.66},${r * 0.66} 0 0 0 ${cx - r * 0.18},${cy + r * 0.62}`} fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
    </g>
  );
}

/** Evaporating basin / dish (shallow bowl, white ceramic). Rim at y, centre cx. */
export function Basin({ p, cx, y, w = 120, h = 36, level = 0, liquid = "#6cb4ef", liquidOpacity = 0.75, solid = null, solidFrac = 0, crystals = 0, clip = "bs", bubbling = false }) {
  const id = `${p}-${clip}`;
  const x = cx - w / 2;
  const d = `M${x},${y} Q${x + 8},${y + h} ${cx},${y + h} Q${x + w - 8},${y + h} ${x + w},${y}`;
  const liqY = y + h - Math.max(0, Math.min(1, level)) * (h - 4);
  return (
    <g>
      <clipPath id={id}><path d={`${d} Z`} /></clipPath>
      <path d={`${d} Z`} fill={`url(#${p}-ceramic)`} stroke="#8d8a7d" strokeWidth="2" />
      <g clipPath={`url(#${id})`}>
        {level > 0.003 && <rect x={x} y={liqY} width={w} height={y + h - liqY + 2} fill={liquid} opacity={liquidOpacity} />}
        {level > 0.003 && <rect x={x} y={liqY} width={w} height="3" fill="#fff" opacity="0.45" />}
        {bubbling && level > 0.03 && Array.from({ length: 6 }, (_, i) => <circle key={i} className="ms-bubble" style={{ animationDelay: `${i * 0.2}s` }} cx={cx - 40 + i * 16} cy={y + h - 6} r={2 + (i % 2)} fill="#fff" opacity="0.8" />)}
        {solidFrac > 0.005 && <path d={`M${x + 14},${y + h - 3} Q${cx},${y + h - 3 - solidFrac * 14} ${x + w - 14},${y + h - 3} Z`} fill={solid ?? "#e9e9ee"} stroke="#00000022" />}
        {crystals > 0.01 && Array.from({ length: Math.round(2 + crystals * 18) }, (_, i) => { const px = cx - 38 + ((i * 53) % 76); const py = y + h - 6 - ((i * 7) % 9); const s = 3 + (i % 3); return <path key={i} d={`M${px},${py} l${s},-${s * 0.7} l${s},${s * 0.2} l${-s * 0.3},${s} z`} fill="#bfe0ff" stroke="#3b7fcf" strokeWidth="0.7" />; })}
      </g>
      <path d={`M${x + 6},${y + 6} Q${x + 16},${y + h - 6} ${cx - 6},${y + h - 3}`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.8" />
    </g>
  );
}

export const BURNER_H = 70; // burner height; the gauze sits 36 px above its top so a medium flame touches it
export function Bunsen({ p, cx, base = VB.bench, heat = 0, on = true, h = BURNER_H }) {
  const f = on ? Math.max(0.12, Math.min(1, heat)) : 0;
  const top = base - h;
  return (
    <g>
      <Shadow p={p} cx={cx} w={96} />
      <path d={`M${cx - 38},${base} Q${cx - 38},${base - 12} ${cx - 14},${base - 14} L${cx + 14},${base - 14} Q${cx + 38},${base - 12} ${cx + 38},${base} Z`} fill={`url(#${p}-metalV)`} stroke="#4b5366" strokeWidth="1.6" />
      <rect x={cx - 9} y={top} width="18" height={h - 14} fill={`url(#${p}-metal)`} stroke="#4b5366" strokeWidth="1.5" />
      <rect x={cx - 11} y={base - 46} width="22" height="14" rx="2" fill="#3f475a" stroke="#2b3140" strokeWidth="1" />
      <rect x={cx - 12} y={top - 3} width="24" height="6" rx="2" fill="#4b5366" />
      <path d={`M${cx + 9},${base - 20} q22,-2 30,-14`} fill="none" stroke="#6b7388" strokeWidth="3" strokeLinecap="round" />
      {f > 0 && (
        <g transform={`translate(${cx} ${top - 3}) scale(${0.7 + f * 0.6} ${0.45 + f * 0.85}) translate(${-cx} ${-(top - 3)})`}><g className="ms-flame" style={{ transformOrigin: `${cx}px ${top - 3}px`, transformBox: "view-box" }}>
          <path d={`M${cx},${top - 3 - 46} C${cx + 11},${top - 3 - 27} ${cx + 12},${top - 3 - 6} ${cx},${top - 3} C${cx - 12},${top - 3 - 6} ${cx - 11},${top - 3 - 27} ${cx},${top - 3 - 46} Z`} fill={`url(#${p}-flameO)`} />
          <path d={`M${cx},${top - 3 - 24} C${cx + 6},${top - 3 - 15} ${cx + 6},${top - 3 - 5} ${cx},${top - 3} C${cx - 6},${top - 3 - 5} ${cx - 6},${top - 3 - 15} ${cx},${top - 3 - 24} Z`} fill={`url(#${p}-flameI)`} />
        </g></g>
      )}
    </g>
  );
}

/** Tripod with a gauze. Gauze top at y. */
export function Tripod({ p, cx, y, w = 150 }) {
  const lx = cx - w / 2 + 14; const rx = cx + w / 2 - 14;
  return (
    <g>
      <line x1={lx} y1={y + 4} x2={lx - 16} y2={VB.bench} stroke="#555e72" strokeWidth="5" strokeLinecap="round" />
      <line x1={rx} y1={y + 4} x2={rx + 16} y2={VB.bench} stroke="#555e72" strokeWidth="5" strokeLinecap="round" />
      <rect x={cx - w / 2} y={y} width={w} height="6" rx="3" fill={`url(#${p}-metalV)`} stroke="#444c5e" strokeWidth="1.3" />
      <rect x={cx - w / 2 + 10} y={y - 3} width={w - 20} height="4" rx="1" fill="#b8bdc9" stroke="#8d93a4" strokeWidth="0.8" />
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1={cx - w / 2 + 14 + i * ((w - 28) / 13)} y1={y - 3} x2={cx - w / 2 + 14 + i * ((w - 28) / 13)} y2={y + 1} stroke="#8d93a4" strokeWidth="0.8" />)}
    </g>
  );
}

export function HeatMat({ p, cx, w = 130 }) {
  return <g aria-hidden="true"><rect x={cx - w / 2} y={VB.bench - 6} width={w} height="7" rx="2" fill="#7b8398" stroke="#4b5366" strokeWidth="1.2" /><Shadow p={p} cx={cx} w={w + 20} /></g>;
}

/** Retort stand: rod at x from the bench up to yTop. Base plate to the right. */
export function Stand({ p, x, yTop, baseW = 120, baseSide = 1 }) {
  return (
    <g>
      <Shadow p={p} cx={x + (baseSide * baseW) / 3} w={baseW + 30} />
      <rect x={Math.min(x - 14, x - 14 + (baseSide > 0 ? 0 : -baseW + 28))} y={VB.bench - 10} width={baseW} height="10" rx="3" fill={`url(#${p}-metalV)`} stroke="#444c5e" strokeWidth="1.3" />
      <rect x={x - 4} y={yTop} width="8" height={VB.bench - yTop - 8} rx="3" fill={`url(#${p}-metal)`} stroke="#444c5e" strokeWidth="1.2" />
    </g>
  );
}

/** Clamp from the rod at (xRod, y) to a grip at (xGrip, y); the grip wraps a vertical neck of width gw. */
export function Clamp({ p, xRod, xGrip, y, gw = 26 }) {
  const dir = xGrip > xRod ? 1 : -1;
  return (
    <g>
      <rect x={Math.min(xRod, xGrip)} y={y - 3.5} width={Math.abs(xGrip - xRod)} height="7" rx="3" fill={`url(#${p}-metalV)`} stroke="#444c5e" strokeWidth="1.1" />
      <rect x={xRod - 8} y={y - 9} width="16" height="18" rx="3" fill="#4b5366" stroke="#2f3646" strokeWidth="1.1" />
      <path d={`M${xGrip - dir * 2},${y - 11} h${-dir * 6} q${-dir * 4},11 0,22 h${dir * 6}`} fill="none" stroke="#444c5e" strokeWidth="3.4" strokeLinecap="round" />
      <path d={`M${xGrip + dir * 2 + 0},${y - 11} h${dir * gw / 2} `} stroke="none" />
    </g>
  );
}

/** Thermometer with mercury column. x centre, top y, height h (tube), range tmin..tmax; reading t. */
export function Thermometer({ p, x, y, h = 150, t = 20, tmin = -10, tmax = 110, bulb = true, tilt = 0, showScale = true }) {
  const frac = Math.max(0, Math.min(1, (t - tmin) / (tmax - tmin)));
  const colH = 8 + frac * (h - 8);
  return (
    <g transform={tilt ? `rotate(${tilt} ${x} ${y + h})` : undefined}>
      <rect x={x - 5} y={y} width="10" height={h} rx="5" fill="#f4f8ff" fillOpacity="0.85" stroke="var(--ms-glass-stroke)" strokeWidth="1.8" />
      {showScale && Array.from({ length: 11 }, (_, i) => <line key={i} x1={x + 5} y1={y + 8 + (i * (h - 16)) / 10} x2={x + (i % 5 === 0 ? 11 : 8)} y2={y + 8 + (i * (h - 16)) / 10} stroke="#4b5366" strokeWidth="1" />)}
      <rect x={x - 2} y={y + h - colH} width="4" height={colH} rx="2" fill="#d6323a" />
      {bulb && <circle cx={x} cy={y + h + 6} r="8" fill="#d6323a" stroke="var(--ms-glass-stroke)" strokeWidth="1.8" />}
      <rect x={x - 5} y={y} width="10" height={h} rx="5" fill={`url(#${p}-glass)`} />
    </g>
  );
}

/** Liebig condenser along the line from (x1, y1) to (x2, y2): inner tube + water jacket + hose connections. wf 0..1 = water flow. */
export function Condenser({ p, x1, y1, x2, y2, w = 26, wf = 1, clipId = "cd" }) {
  const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy); const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <g transform={`translate(${x1} ${y1}) rotate(${ang})`}>
      <rect x="-6" y={-4} width={len + 12} height="8" rx="3" fill="#f4f8ff" fillOpacity="0.9" stroke="var(--ms-glass-stroke)" strokeWidth="1.6" />
      <rect x="22" y={-w / 2} width={len - 44} height={w} rx="6" fill="#bfe0ff" fillOpacity={0.35 + 0.35 * wf} stroke="var(--ms-glass-stroke)" strokeWidth="2" />
      <rect x="22" y={-w / 2} width={len - 44} height={w} rx="6" fill={`url(#${p}-glass)`} />
      <rect x="22" y="-4" width={len - 44} height="8" fill="#f4f8ff" fillOpacity="0.9" stroke="var(--ms-glass-stroke)" strokeWidth="1.4" />
      {wf > 0.02 && Array.from({ length: 5 }, (_, i) => <circle key={i} className="ms-flow" style={{ animationDelay: `${i * 0.32}s`, ["--ms-flow-len"]: `${len - 70}px` }} cx={len - 40 - i * 0.01} cy={-w / 4 + (i % 2) * (w / 2)} r="2.2" fill="#2d7fd6" />)}
    </g>
  );
}

/** Water hoses on the Liebig condenser's jacket, placed along the tube's axis (in at the LOWER end, out at the UPPER end). */
export function CondenserPorts({ x1, y1, x2, y2, w = 26, wf = 1 }) {
  const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy); const ux = dx / len; const uy = dy / len;
  let nx = -uy; let ny = ux; if (ny < 0) { nx = -nx; ny = -ny; } // n points "down" in the picture
  const inP = [x1 + ux * (len - 32) + nx * (w / 2), y1 + uy * (len - 32) + ny * (w / 2)];
  const outP = [x1 + ux * 36 - nx * (w / 2), y1 + uy * 36 - ny * (w / 2)];
  const hose = (P, sgn) => `M${P[0]},${P[1]} q${sgn * nx * 14 - ux * 6},${sgn * ny * 14 - uy * 6} ${sgn * nx * 30 - ux * 14},${sgn * ny * 30 - uy * 14}`;
  const inEnd = [inP[0] + nx * 30 - ux * 14, inP[1] + ny * 30 - uy * 14]; const outEnd = [outP[0] - nx * 30 - ux * 14, outP[1] - ny * 30 - uy * 14];
  return (
    <g aria-hidden="true">
      <path d={hose(inP, 1)} fill="none" stroke="#2d7fd6" strokeWidth="5" strokeLinecap="round" opacity={0.55 + 0.4 * wf} />
      <path d={hose(outP, -1)} fill="none" stroke="#2d7fd6" strokeWidth="5" strokeLinecap="round" opacity={0.55 + 0.4 * wf} />
      <text x={inEnd[0] - 6} y={inEnd[1] + 5} textAnchor="end" className="ms-svg-label" fill="#1d5fad">water in</text>
      <text x={outEnd[0] - 4} y={outEnd[1] - 6} textAnchor="middle" className="ms-svg-label" fill="#1d5fad">water out</text>
    </g>
  );
}

/** A hose with arrows: used for water in / out. */
export function WaterPort({ x, y, dir = "in", label }) {
  return (
    <g aria-hidden="true">
      <path d={`M${x},${y} q${dir === "in" ? -22 : 22},${dir === "in" ? 8 : -8} ${dir === "in" ? -36 : 36},${dir === "in" ? 30 : -30}`} fill="none" stroke="#2d7fd6" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      <text x={x + (dir === "in" ? -44 : 14)} y={y + (dir === "in" ? 42 : -30)} className="ms-svg-label" fill="#1d5fad">{label}</text>
    </g>
  );
}

export function Stream({ x1, y1, x2, y2, colour = "#6cb4ef", w = 4, on = true }) {
  if (!on) return null;
  return <path d={`M${x1},${y1} Q${(x1 + x2) / 2 + (x2 - x1) * 0.15},${y1 + (y2 - y1) * 0.25} ${x2},${y2}`} fill="none" stroke={colour} strokeWidth={w} strokeLinecap="round" opacity="0.85" className="ms-stream" />;
}

export function Wisps({ cx, y, n = 4, colour = "#9aa7bd", spread = 40, opacity = 0.5 }) {
  return (
    <g aria-hidden="true" opacity={opacity}>
      {Array.from({ length: n }, (_, i) => <path key={i} className="ms-wisp" style={{ animationDelay: `${i * 0.55}s` }} d={`M${cx - spread / 2 + (i * spread) / Math.max(1, n - 1)},${y} q8,-14 0,-26 q-8,-12 0,-24`} fill="none" stroke={colour} strokeWidth="3" strokeLinecap="round" />)}
    </g>
  );
}

/** Sand / powder drawn as a heap of small grains (decorative, deterministic) between x..x+w at the floor line yb. */
export function Grains({ x, yb, w, h, colour = "#d8b574", n = 60, seed = 3, dark = "#00000022" }) {
  const rnd = (i) => { const t = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return t - Math.floor(t); };
  return (
    <g aria-hidden="true">
      <path d={`M${x},${yb} Q${x + w / 2},${yb - h * 1.3} ${x + w},${yb} Z`} fill={colour} stroke={dark} strokeWidth="1" />
      {Array.from({ length: n }, (_, i) => { const px = x + 4 + rnd(i) * (w - 8); const t = (px - x) / w; const top = yb - Math.sin(t * Math.PI) * h * 0.95; const py = top + rnd(i + 99) * (yb - top - 1); return <circle key={i} cx={px} cy={py} r={1 + rnd(i + 7) * 1.4} fill={rnd(i + 3) > 0.5 ? "#ffffff55" : "#00000030"} />; })}
    </g>
  );
}

/** Safe unique prefix for ids in one scene. */
export function useScenePrefix() { return `ms${useId().replace(/[^a-zA-Z0-9]/g, "")}`; }
