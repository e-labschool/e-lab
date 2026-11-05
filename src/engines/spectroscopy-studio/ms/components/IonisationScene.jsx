import { GEOMETRIES } from "../scene/glyphs.js";
import AtomGlyph, { GlyphDefs } from "./AtomGlyph.jsx";
import { ELECTRON_COLOR } from "./ui.jsx";

const ease = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const seg = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));

/** One electron: cyan ball with a minus sign and a fading trail. */
function Electron({ x, y, dx = 1, dy = 0, trail = 40, r = 8, label, labelDx = 0, labelDy = -16, opacity = 1, testId }) {
  return (
    <g opacity={opacity} data-testid={testId}>
      <line x1={x - dx * trail} y1={y - dy * trail} x2={x} y2={y} stroke={ELECTRON_COLOR} strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <circle cx={x} cy={y} r={r + 5} fill={ELECTRON_COLOR} opacity="0.2" />
      <circle cx={x} cy={y} r={r} fill="url(#ion-e)" stroke="#0369a1" strokeWidth="1.2" />
      <text x={x} y={y} textAnchor="middle" dy="0.34em" fontSize={r * 1.5} fontWeight="900" fill="#05283f">−</text>
      {label && <text x={x + labelDx} y={y + labelDy} textAnchor="middle" className="ms-scenelabel">{label}</text>}
    </g>
  );
}

/** Stage 3: electron ionisation of methane. p = 0..1 progress of the event; fired = the student pressed Ionize. */
export default function IonisationScene({ w, h, p, phase, fired }) {
  const gid = "ion"; const pad = 14; const top = 52;
  const ch = { x: pad, y: top, w: w - 2 * pad, h: h - top - pad - 24 };
  const by = ch.y + ch.h * 0.46; const narrow = w < 520;
  const gunX = ch.x + (narrow ? 30 : 44); const trapX = ch.x + ch.w - (narrow ? 30 : 44);
  const mx = ch.x + ch.w * 0.5; const my = by;
  const scale = Math.max(26, Math.min(64, ch.h / 5.2, ch.w / 9));
  const e1x = fired ? gunX + (mx - scale * 1.9 - gunX) * ease(seg(p, 0.04, 0.44)) : gunX + 4;
  const hit = fired && p >= 0.46;
  const dir1 = { x: Math.cos(-0.35), y: Math.sin(-0.35) }; const dir2 = { x: -0.5, y: -0.866 };
  const t2 = ease(seg(p, 0.46, 1)); const L1 = Math.min(ch.w * 0.26, 230); const L2 = Math.min(ch.h * 0.36, 130);
  const ionT = ease(seg(p, 0.5, 0.64)); const drift = ease(seg(p, 0.74, 1));
  const slitY = ch.y + ch.h; const iy = my + (slitY - my - scale * 1.2) * 0.62 * drift;
  const spin = phase * 0.6; const jig = fired && p > 0.46 ? 0 : 1;
  const mxx = mx + jig * 3 * Math.sin(phase * 2.1); const myy = iy + jig * 3 * Math.cos(phase * 1.7);
  const glow = hit ? 0.5 + 0.5 * Math.sin(phase * 6) : 0;
  const flash = fired ? seg(p, 0.46, 0.6) : 0;
  const g = GEOMETRIES.ch4;
  const stageText = !fired ? "Press Ionize: a fast electron will approach the methane molecule." : p < 0.44 ? "A high-energy electron approaches the neutral molecule." : p < 0.5 ? "The electron passes close to the molecule." : p < 0.66 ? "One electron is knocked out of the molecule." : "A positive molecular ion (radical cation) has formed.";
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-ionscene" role="img" aria-label="Electron ionisation of methane: a high-energy electron removes one electron from a CH4 molecule, forming the radical cation CH4+. and two electrons leave." data-testid="ionisation-svg" data-progress={p.toFixed(2)} data-fired={fired ? "1" : "0"} data-ion={hit ? "1" : "0"}>
      <GlyphDefs id={gid} />
      <rect x={ch.x} y={ch.y} width={ch.w} height={ch.h} rx="14" className="ms-partbox is-chamber" />
      <text x={ch.x + 12} y={ch.y + 20} className="ms-scenelabel is-title">Ionisation chamber (high vacuum)</text>
      <rect x={ch.x + 12} y={ch.y + 28} width={ch.w * 0.55} height="5" rx="2" fill="#fbbf24" opacity="0.8" />
      <text x={ch.x + 16 + ch.w * 0.55} y={ch.y + 33} className="ms-scenelabel is-sm">repeller plate (+)</text>
      {/* filament and trap */}
      <path d={`M ${gunX - 14} ${by - 16} q 7 -10 14 0 t 14 0 M ${gunX - 14} ${by + 6} q 7 -10 14 0 t 14 0`} fill="none" stroke="#fb923c" strokeWidth="3" transform={`translate(-3 ${5})`} />
      <text x={gunX} y={by + 38} textAnchor="middle" className="ms-scenelabel is-sm">hot filament</text>
      <text x={gunX} y={by + 52} textAnchor="middle" className="ms-scenelabel is-sm">{w < 520 ? "" : "(electron source)"}</text>
      <rect x={trapX - 6} y={by - 24} width="12" height="48" rx="3" fill="#475a8a" stroke="#94a3b8" />
      <text x={trapX} y={by + 42} textAnchor="middle" className="ms-scenelabel is-sm">electron trap</text>
      <line x1={gunX + 22} y1={by} x2={trapX - 10} y2={by} stroke={ELECTRON_COLOR} strokeWidth="1.5" strokeDasharray="3 7" opacity="0.4" />
      {/* exit slit */}
      <rect x={mx - 17} y={slitY - 3} width="34" height="7" fill="#0a1d45" />
      <path d={`M ${mx - 17} ${slitY} v 0 M ${mx + 17} ${slitY}`} stroke="none" />
      <text x={mx} y={slitY + 17} textAnchor="middle" className="ms-scenelabel is-sm">ions leave through the slit to the accelerating electrodes</text>
      {/* molecule: neutral and ion layered */}
      {flash > 0 && flash < 1 && <circle cx={mx} cy={my} r={scale * (0.8 + 1.8 * flash)} fill="none" stroke="#fff" strokeWidth="3" opacity={1 - flash} />}
      <AtomGlyph id={gid} atoms={g.atoms} bonds={g.bonds} cx={mxx} cy={myy} scale={scale} spin={spin} tilt={0.4} opacity={1 - ionT} testId="neutral-molecule" />
      {ionT > 0 && <AtomGlyph id={gid} atoms={g.atoms} bonds={g.bonds} cx={mxx} cy={myy} scale={scale} spin={spin} tilt={0.4} ion radical opacity={ionT} glow={glow} testId="molecular-ion" />}
      {(!fired || p < 0.5) && <text x={mxx} y={myy + scale * 1.9} textAnchor="middle" className="ms-scenelabel">CH₄ neutral molecule</text>}
      {ionT > 0.9 && <text x={mxx} y={myy + scale * 1.6} textAnchor="middle" className="ms-scenelabel is-ion">CH₄⁺• molecular ion (radical cation)</text>}
      {/* electrons */}
      <Electron x={e1x} y={by} trail={fired && !hit ? 46 : 14} label={fired && !hit ? "incoming e⁻ (high energy, about 70 eV)" : !fired ? "electron beam (idle)" : undefined} labelDy={-20} labelDx={0} opacity={hit ? 0 : fired ? 1 : 0.45} testId="electron-in" />
      {hit && <Electron x={mx + dir1.x * L1 * t2} y={my + dir1.y * L1 * t2} dx={dir1.x} dy={dir1.y} trail={26} r={7} label={t2 > 0.35 ? "slowed e⁻" : undefined} labelDy={-17} testId="electron-scattered" />}
      {hit && <Electron x={mx + dir2.x * L2 * t2} y={my + dir2.y * L2 * t2} dx={dir2.x} dy={dir2.y} trail={22} r={7} label={t2 > 0.35 ? "ejected e⁻" : undefined} labelDx={-6} labelDy={-17} testId="electron-ejected" />}
      <text x={w / 2} y={h - 7} textAnchor="middle" className="ss-svgtext--sm" fontSize="12.5" data-testid="ionisation-caption" aria-live="polite">{stageText}</text>
    </svg>
  );
}
