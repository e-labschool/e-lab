import { GEOMETRIES, FRAGMENT_MOTION, lerp3, project } from "../scene/glyphs.js";
import AtomGlyph, { GlyphDefs } from "./AtomGlyph.jsx";
import { PATHWAY_BY_ID } from "../data/fragmentation.js";

const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const centroid = (pts) => pts.reduce((c, q) => [c[0] + q[0] / pts.length, c[1] + q[1] / pts.length, c[2] + q[2] / pts.length], [0, 0, 0]);

/** Stage 4: one fragmentation step. p = 0..1: shaking (excess energy) -> bond stretches -> the pieces separate; only the charged piece goes on to the analyser. */
export default function FragmentScene({ w, h, p, phase, pathId }) {
  const path = PATHWAY_BY_ID[pathId]; const mo = FRAGMENT_MOTION[pathId]; const gid = "frg";
  const pre = GEOMETRIES[mo.pre]; const cEnd = GEOMETRIES[mo.chargedEnd]; const nEnd = GEOMETRIES[mo.neutralEnd];
  const narrow = w < 520; const scale = Math.max(30, Math.min(70, h / 5.4, w / 8));
  const base = { x: w * (narrow ? 0.34 : 0.3), y: h * 0.5 };
  const sB = ease(seg(p, 0.32, 0.62)); const sC = ease(seg(p, 0.58, 1));
  const shake = p < 0.4 ? (0.6 + 0.4 * Math.min(1, p / 0.2)) * 0.05 : 0;
  const spin = phase * 0.55;
  const prePos = pre.atoms.map((a) => a.p);
  const nCentre0 = centroid(mo.neutral.map((i) => prePos[i]));
  const leave = mo.neutralLeaves; const dist = 1.2;
  const posC = mo.charged.map((i, k) => lerp3(prePos[i], cEnd.atoms[k].p, sB));
  const nCentre = [nCentre0[0] + leave[0] * dist * sB, nCentre0[1] + leave[1] * dist * sB, nCentre0[2] + leave[2] * dist * sB];
  const posN = mo.neutral.map((i, k) => lerp3(prePos[i], [nCentre[0] + nEnd.atoms[k].p[0], nCentre[1] + nEnd.atoms[k].p[1], nCentre[2] + nEnd.atoms[k].p[2]], sB));
  const wob = (k) => shake * scale * Math.sin(phase * 13 + k);
  const dC = { x: sC * Math.min(w * 0.36, 360), y: 0 }; const dN = { x: -sC * Math.min(w * 0.2, 150), y: -sC * Math.min(h * 0.2, 120) };
  const cC = { x: base.x + dC.x + wob(1), y: base.y + dC.y + wob(2) }; const cN = { x: base.x + dN.x + wob(3), y: base.y + dN.y + wob(4) };
  const split = sC > 0.15;
  const atomsC = mo.charged.map((_, k) => ({ el: pre.atoms[mo.charged[k]].el, p: posC[k] }));
  const atomsN = mo.neutral.map((_, k) => ({ el: pre.atoms[mo.neutral[k]].el, p: posN[k] }));
  const bondsOf = (list, groupIdx) => pre.bonds.filter(([i, j]) => groupIdx.includes(i) && groupIdx.includes(j)).map(([i, j]) => [groupIdx.indexOf(i), groupIdx.indexOf(j)]);
  const bondsC = bondsOf(pre.atoms, mo.charged); let bondsN = bondsOf(pre.atoms, mo.neutral);
  if (nEnd.bonds.length && !bondsN.length) bondsN = nEnd.bonds; // H2 has a bond only after it forms
  const cross = pre.bonds.filter(([i, j]) => (mo.charged.includes(i) && mo.neutral.includes(j)) || (mo.charged.includes(j) && mo.neutral.includes(i)));
  const radC = path.products.find((x) => x.charged);
  const neu = path.products.find((x) => !x.charged);
  const prePoint = (i) => { const k = mo.charged.indexOf(i); const q = project(k >= 0 ? posC[k] : posN[mo.neutral.indexOf(i)], spin, 0.4); const c = k >= 0 ? cC : cN; return { x: c.x + q.x * scale, y: c.y - q.y * scale }; };
  const showPre = p < 0.6;
  const charge = (s) => s.includes("•");
  const stageText = p < 0.3 ? `${path.from.label} has extra internal energy: its bonds vibrate strongly.` : p < 0.6 ? "One bond stretches until it breaks." : "Two pieces: only the charged one is accelerated on.";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-fragscene" role="img" aria-label={`Fragmentation: ${path.eq}. The charged fragment continues to the analyser; the neutral fragment is not detected.`} data-testid="fragment-svg" data-path={pathId} data-progress={p.toFixed(2)} data-split={split ? "1" : "0"}>
      <GlyphDefs id={gid} />
      <rect x="12" y="12" width={w - 24} height={h - 36} rx="14" className="ms-partbox is-chamber" />
      <text x="24" y="34" className="ms-scenelabel is-title">{w < 520 ? "One fragmentation step" : `Ion source: one ${path.secondary ? "further " : ""}fragmentation step (illustrative)`}</text>
      {cross.map(([i, j], k) => { const a = prePoint(i); const b = prePoint(j); return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fdba74" strokeWidth="3" strokeDasharray="6 6" opacity={Math.max(0, 1 - sC * 2)} />; })}
      <AtomGlyph id={gid} atoms={atomsC} bonds={bondsC} cx={cC.x} cy={cC.y} scale={scale} spin={spin} tilt={0.4} ion radical={charge(radC.label) || (!split && charge(path.from.label))} glow={p < 0.5 ? 0.4 + 0.3 * Math.sin(phase * 8) : 0.15} testId="charged-fragment" />
      <AtomGlyph id={gid} atoms={atomsN} bonds={bondsN} cx={cN.x} cy={cN.y} scale={scale} spin={spin} tilt={0.4} opacity={1} testId="neutral-fragment" />
      {showPre && <text x={base.x} y={base.y + scale * 2.3} textAnchor="middle" className="ms-scenelabel is-ion" data-testid="precursor-label">{path.from.label} · {path.from.kind}</text>}
      {split && (
        <>
          <text x={cC.x} y={cC.y + scale * 2.2} textAnchor="middle" className="ms-scenelabel is-ion" data-testid="charged-label">{radC.label} · charged (m/z {radC.mz})</text>
          <text x={cC.x} y={cC.y + scale * 2.2 + 17} textAnchor="middle" className="ms-scenelabel is-sm">{radC.kind}</text>
          <g opacity={ease(seg(p, 0.8, 1))}><line x1={cC.x + scale * 1.5} y1={cC.y} x2={Math.min(w - 40, cC.x + scale * 3.2)} y2={cC.y} stroke="#fb923c" strokeWidth="3" /><path d={`M ${Math.min(w - 40, cC.x + scale * 3.2)} ${cC.y} l -10 -6 v 12 z`} fill="#fb923c" /><text x={Math.min(w - 60, cC.x + scale * 1.6)} y={cC.y - 12} textAnchor="end" className="ms-scenelabel">to the analyser</text></g>
          <text x={cN.x} y={cN.y + scale * 1.7} textAnchor="middle" className="ms-scenelabel" data-testid="neutral-label">{neu.label} · neutral</text>
          <text x={cN.x} y={cN.y + scale * 1.7 + 17} textAnchor="middle" className="ms-scenelabel is-sm">{w < 520 ? "not detected" : "not accelerated, not detected"}</text>
        </>
      )}
      <text x={w / 2} y={h - 7} textAnchor="middle" className="ss-svgtext--sm" fontSize="12.5" data-testid="fragment-caption" aria-live="polite">{stageText}</text>
    </svg>
  );
}
