import { GEOMETRIES } from "../scene/glyphs.js";
import AtomGlyph, { GlyphDefs } from "./AtomGlyph.jsx";
import { MS_PARTS } from "../data/instrument.js";

const WEIGHT = { inlet: 1.6, ionisation: 1.8, accelerator: 0.95, analyser: 1.1, detector: 0.85, computer: 0.95 };
export function layoutParts(w, h) {
  const horizontal = w >= 640; const pad = 14; const gap = horizontal ? 24 : 20;
  const total = MS_PARTS.reduce((s, p) => s + WEIGHT[p.id], 0); const rects = {};
  if (horizontal) {
    const avail = w - 2 * pad - gap * (MS_PARTS.length - 1); let x = pad; const bh = Math.min(h * 0.62, 260); const y = h * 0.5 - bh / 2 - 6;
    for (const p of MS_PARTS) { const bw = (avail * WEIGHT[p.id]) / total; rects[p.id] = { x, y, w: bw, h: bh }; x += bw + gap; }
  } else {
    const avail = h - 2 * pad - gap * (MS_PARTS.length - 1); let y = pad + 4;
    for (const p of MS_PARTS) { const bh = (avail * WEIGHT[p.id]) / total; rects[p.id] = { x: pad + 104, y, w: w - 2 * pad - 114, h: bh }; y += bh + gap; }
  }
  return { horizontal, rects };
}
const wrap = (text, max) => { const words = text.split(" "); const lines = []; let cur = ""; for (const wd of words) { if ((cur + " " + wd).trim().length > max && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); } if (cur) lines.push(cur); return lines; };

/** Stage 2: the whole simplified instrument; inlet and ionisation chamber emphasised; methane molecules flow from the sample reservoir through the inlet into the chamber. */
export default function InstrumentScene({ w, h, phase, release, released, active = ["inlet", "ionisation"] }) {
  const { horizontal, rects } = layoutParts(w, h);
  const A = new Set(active); const R = rects; const gid = "inst";
  const inlet = R.inlet; const ch = R.ionisation;
  // path of a molecule: vial -> valve -> capillary -> chamber entrance -> its own spot
  const N = 9;
  const vialBox = horizontal ? { x: inlet.x + inlet.w * 0.08, y: inlet.y + inlet.h * 0.3, w: inlet.w * 0.46, h: inlet.h * 0.5 } : { x: inlet.x + inlet.w * 0.08, y: inlet.y + inlet.h * 0.2, w: inlet.w * 0.4, h: inlet.h * 0.6 };
  const vialAt = (i) => ({ x: vialBox.x + vialBox.w * (0.2 + 0.3 * (i % 3)), y: vialBox.y + vialBox.h * (0.17 + 0.33 * Math.floor(i / 3)) });
  const valve = horizontal ? { x: inlet.x + inlet.w * 0.78, y: inlet.y + inlet.h * 0.5 } : { x: inlet.x + inlet.w * 0.6, y: inlet.y + inlet.h * 0.5 };
  const entry = horizontal ? { x: ch.x + 6, y: ch.y + ch.h * 0.5 } : { x: ch.x + ch.w * 0.5, y: ch.y + 6 };
  const spot = (i) => { const r1 = ((i * 0.6180339) % 1); const r2 = ((i * 0.3819660 + 0.17) % 1); return { x: ch.x + ch.w * (0.16 + 0.68 * r1), y: ch.y + ch.h * (0.22 + 0.58 * r2) }; };
  const scale = Math.max(5, Math.min(10, vialBox.w / 9));
  const mols = Array.from({ length: N }, (_, i) => {
    const d = i * 0.075; const s = Math.min(1, Math.max(0, (release - d) / 0.5)); const home = spot(i); const vial = vialAt(i);
    const wob = (k) => 0.7 * scale * Math.sin(phase * (0.9 + 0.13 * i) + i * 1.7 + k);
    let pos;
    if (!released || release <= d) pos = { x: vial.x + 0.12 * scale * Math.sin(phase * 1.1 + i * 2.1), y: vial.y + 0.12 * scale * Math.cos(phase * 0.9 + i * 1.3), inChamber: false };
    else if (s < 0.4) { const u = s / 0.4; pos = { x: vial.x + (valve.x - vial.x) * u, y: vial.y + (valve.y - vial.y) * u, inChamber: false }; }
    else if (s < 0.75) { const u = (s - 0.4) / 0.35; pos = { x: valve.x + (entry.x - valve.x) * u, y: valve.y + (entry.y - valve.y) * u, inChamber: false }; }
    else { const u = (s - 0.75) / 0.25; const e = u * u * (3 - 2 * u); pos = { x: entry.x + (home.x - entry.x) * e + (s >= 1 ? wob(0) : 0), y: entry.y + (home.y - entry.y) * e + (s >= 1 ? wob(2) : 0), inChamber: s >= 0.75 }; }
    return { i, ...pos, spin: phase * (0.5 + 0.06 * i) + i };
  });
  const inChamber = mols.filter((m) => m.inChamber).length;
  const line = (a, b, dim) => <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ss-axis)" strokeWidth="2" strokeDasharray="5 5" opacity={dim ? 0.4 : 0.9} />;
  const mid = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const pipe = (p, q) => (horizontal ? line({ x: R[p].x + R[p].w, y: mid(R[p]).y }, { x: R[q].x, y: mid(R[q]).y }, !(A.has(p) && A.has(q))) : line({ x: mid(R[p]).x, y: R[p].y + R[p].h }, { x: mid(R[q]).x, y: R[q].y }, !(A.has(p) && A.has(q))));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-instr" role="img" aria-label="Simplified labelled mass spectrometer: sample inlet, ionisation chamber, accelerating electrodes, analyser, detector and computer. Methane molecules enter through the inlet into the ionisation chamber." data-testid="instrument-svg" data-released={released ? "1" : "0"} data-in-chamber={inChamber}>
      <GlyphDefs id={gid} />
      {MS_PARTS.slice(0, -1).map((p, i) => <g key={`pipe${p.id}`}>{pipe(p.id, MS_PARTS[i + 1].id)}</g>)}
      {MS_PARTS.map((p) => {
        const r = R[p.id]; const on = A.has(p.id); const lines = wrap(p.label, Math.max(8, Math.floor((horizontal ? r.w : r.w * 0.5) / 7.2)));
        const lx = horizontal ? r.x + r.w / 2 : r.x + r.w / 2; const ly = horizontal ? r.y + r.h + 20 : r.y + 18;
        return (
          <g key={p.id} className={`ms-part${on ? " is-active" : ""}`} data-part={p.id} opacity={on ? 1 : 0.5}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="12" className="ms-partbox" />
            {p.id === "analyser" && <path d={`M ${r.x + r.w * 0.2} ${r.y + r.h * 0.75} A ${r.w * 0.3} ${r.w * 0.3} 0 0 1 ${r.x + r.w * 0.8} ${r.y + r.h * 0.75}`} fill="none" stroke="#a78bfa" strokeWidth="3" />}
            {p.id === "accelerator" && <><rect x={r.x + r.w * 0.32} y={r.y + r.h * 0.18} width="6" height={r.h * 0.64} fill="#fbbf24" /><rect x={r.x + r.w * 0.64} y={r.y + r.h * 0.18} width="6" height={r.h * 0.64} fill="#94a3b8" /><text x={r.x + r.w * 0.35} y={r.y + r.h * 0.12} textAnchor="middle" className="ss-svgtext--sm" fontSize="12">+V</text><text x={r.x + r.w * 0.67} y={r.y + r.h * 0.12} textAnchor="middle" className="ss-svgtext--sm" fontSize="12">0</text></>}
            {p.id === "detector" && <><rect x={r.x + r.w * 0.3} y={r.y + r.h * 0.3} width={r.w * 0.4} height={r.h * 0.4} rx="4" fill="#0f2557" stroke="#38bdf8" strokeWidth="2" /><path d={`M ${r.x + r.w * 0.38} ${r.y + r.h * 0.62} L ${r.x + r.w * 0.5} ${r.y + r.h * 0.38} L ${r.x + r.w * 0.62} ${r.y + r.h * 0.62}`} fill="none" stroke="#38bdf8" strokeWidth="2" /></>}
            {p.id === "computer" && <><rect x={r.x + r.w * 0.2} y={r.y + r.h * 0.2} width={r.w * 0.6} height={r.h * 0.5} rx="4" fill="#0f2557" stroke="#f472b6" strokeWidth="2" />{[0.32, 0.42, 0.5, 0.6].map((u, k) => <line key={k} x1={r.x + r.w * (0.28 + 0.1 * k)} x2={r.x + r.w * (0.28 + 0.1 * k)} y1={r.y + r.h * 0.64} y2={r.y + r.h * (0.64 - [0.16, 0.34, 0.2, 0.08][k])} stroke="#f472b6" strokeWidth="3" />)}</>}
            {p.id === "inlet" && (
              <>
                <rect x={vialBox.x} y={vialBox.y} width={vialBox.w} height={vialBox.h} rx="8" fill="rgba(125,211,252,0.12)" stroke="#7dd3fc" strokeWidth="2" />
                <text x={vialBox.x + vialBox.w / 2} y={vialBox.y - 8} textAnchor="middle" className="ss-svgtext--sm" fontSize="12">sample (gas)</text>
                <rect x={vialBox.x + vialBox.w} y={mid(inlet).y - 5} width={inlet.x + inlet.w - vialBox.x - vialBox.w} height="10" fill="#475a8a" />
                <g transform={`translate(${valve.x} ${valve.y})`}><circle r="9" fill={released ? "#22c55e" : "#ef4444"} stroke="#fff" strokeWidth="1.5" /><text y="26" textAnchor="middle" className="ss-svgtext--sm" fontSize="12">{released ? "open" : "closed"}</text></g>
              </>
            )}
            {p.id === "ionisation" && <><text x={r.x + r.w / 2} y={r.y + 18} textAnchor="middle" className="ss-svgtext--sm" fontSize="12">gas-phase sample · EI source</text></>}
            {horizontal ? lines.map((t, k) => <text key={k} x={lx} y={ly + k * 15} textAnchor="middle" className={`ms-partlabel${on ? " is-on" : ""}`}>{t}</text>) : wrap(p.label, 13).map((t, k, arr) => <text key={k} x={r.x - 8} y={r.y + r.h / 2 + 4 + (k - (arr.length - 1) / 2) * 14} textAnchor="end" className={`ms-partlabel${on ? " is-on" : ""}`}>{t}</text>)}
          </g>
        );
      })}
      {mols.map((m) => <AtomGlyph key={m.i} id={gid} atoms={GEOMETRIES.ch4.atoms} bonds={GEOMETRIES.ch4.bonds} cx={m.x} cy={m.y} scale={scale} spin={m.spin} tilt={0.4} />)}
      <text x={w / 2} y={h - 8} textAnchor="middle" className="ss-svgtext--sm" fontSize="12.5">{inChamber} of {N} molecules in the ionisation chamber · illustrative, not to scale</text>
    </svg>
  );
}
