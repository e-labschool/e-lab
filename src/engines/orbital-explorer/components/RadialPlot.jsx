import { useMemo } from "react";
import { radialCurve, radialFeatures } from "../lib/radial.js";

const W = 220; const H = 120; const PAD = { l: 8, r: 8, t: 8, b: 26 };

/** Radial probability distribution P(r) = r^2 R^2 for the selected orbital (hydrogen, a0). Peaks and radial nodes are
 * marked and listed as text so the information does not depend on colour. */
const rMaxFor = (n, l) => { const feat = radialFeatures(n, l); const last = feat.peaks.length ? feat.peaks[feat.peaks.length - 1].r : n * n; return Math.ceil((last * 1.9 + 2) / 2) * 2; };

/** `compare` (optional) = { n, l, label } draws a second, dashed curve on the SAME axes so that sizes can be read against each other (OE-06). */
export default function RadialPlot({ n, l, color, label, compare }) {
  const cn = compare?.n; const cl = compare?.l;
  const { path, comparePath, peaks, comparePeaks, nodes, rMax } = useMemo(() => {
    const feat = radialFeatures(n, l);
    const cfeat = compare ? radialFeatures(cn, cl) : null;
    const rMax = Math.max(rMaxFor(n, l), compare ? rMaxFor(cn, cl) : 0);
    const curve = radialCurve(n, l, rMax, 240);
    const ccurve = compare ? radialCurve(cn, cl, rMax, 240) : null;
    const pMax = Math.max(...curve.map((c) => c.p), ...(ccurve ? ccurve.map((c) => c.p) : [0])) * 1.08;
    const x = (r) => PAD.l + (r / rMax) * (W - PAD.l - PAD.r);
    const y = (p) => H - PAD.b - (p / pMax) * (H - PAD.b - PAD.t);
    const toPath = (c) => c.map((q, i) => `${i ? "L" : "M"}${x(q.r).toFixed(1)} ${y(q.p).toFixed(1)}`).join(" ");
    return { path: toPath(curve), comparePath: ccurve ? toPath(ccurve) : null, rMax, peaks: feat.peaks.map((p) => ({ ...p, x: x(p.r), y: y(p.p) })), comparePeaks: cfeat ? cfeat.peaks : [], nodes: feat.nodes.map((q) => ({ ...q, x: x(q.r) })) };
  }, [n, l, cn, cl, compare]);
  const fmt = (v) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));
  const ticks = [0, rMax / 2, rMax];
  return (
    <div data-testid="radial-plot">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Radial probability distribution for ${n}${"spd"[l]}${compare ? ` compared with ${compare.label}` : ""}. Most probable radius ${peaks.length ? fmt(peaks.reduce((a, b) => (b.p > a.p ? b : a)).r) : "none"} Bohr radii; ${nodes.length} radial node${nodes.length === 1 ? "" : "s"}.`}>
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--color-ink-faint)" strokeWidth="1" />
        {comparePath && <path d={comparePath} fill="none" stroke="var(--color-ink-soft)" strokeWidth="2" strokeDasharray="5 3" data-testid="radial-compare-curve" />}
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {nodes.map((q, i) => <line key={i} x1={q.x} y1={PAD.t + 6} x2={q.x} y2={H - PAD.b} stroke="var(--color-ink-faint)" strokeDasharray="3 3" strokeWidth="1" />)}
        {peaks.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="var(--color-paper-raised)" strokeWidth="1" />)}
        {ticks.map((tv, i) => (
          <text key={i} x={PAD.l + (tv / rMax) * (W - PAD.l - PAD.r)} y={H - PAD.b + 12} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"} fontSize="11" fill="var(--color-ink-soft)">{tv}</text>
        ))}
        <text x={W / 2} y={H - 2} textAnchor="middle" fontSize="11" fill="var(--color-ink-soft)">r / a{"₀"}</text>
      </svg>
      {compare && (
        <p className="mt-0.5 text-[11px] text-[var(--color-ink-soft)]" data-testid="radial-compare-legend">
          <span className="font-semibold" style={{ color }}>{"\u2501"} {label ?? `${n}${"spd"[l]}`}</span>{" "}
          <span className="font-semibold">{"\u254C\u254C"} {compare.label}</span>: the {comparePeaks.length ? `${compare.label} peak${comparePeaks.length > 1 ? "s are" : " is"} at ${comparePeaks.map((p) => (p.r >= 10 ? p.r.toFixed(1) : p.r.toFixed(2))).join(", ")} a\u2080` : "curve has no peak in range"}. Larger n puts the electron, on average, further from the nucleus.
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-soft)]">
        P(r) = r{"²"}|R|{"²"}: probability per unit radius. {peaks.length > 1 ? `Peaks at ${peaks.map((p) => fmt(p.r)).join(", ")} a₀ (the highest is most probable).` : `Peak at ${peaks.length ? fmt(peaks[0].r) : "-"} a₀.`}{" "}
        {nodes.length ? `Radial node${nodes.length > 1 ? "s" : ""} (dashed) at ${nodes.map((q) => fmt(q.r)).join(", ")} a₀.` : "No radial nodes."}
      </p>
    </div>
  );
}
