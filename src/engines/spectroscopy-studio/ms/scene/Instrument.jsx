import { SECTOR } from "../physics/sector.js";
import { sectorPath } from "../model/analyser.js";
import { shapePath } from "../components/shapes.js";

export const ACTIVE_BY_STAGE = { 1: ["inlet"], 2: ["ionisation"], 3: ["fragmentation"], 4: ["acceleration", "analyser"], 5: ["analyser", "detector"], 6: ["detector", "analyser"] };

/** The instrument body in world units. Stage decides which regions are emphasised (the others are drawn faint = contextual emphasis, not a different picture). */
export default function Instrument({ world: w, stage, k, V, B, exp, cat, analyser, showLabels = true, arcs = true, selMz = null, showFocus = null }) {
  const act = new Set(ACTIVE_BY_STAGE[stage] ?? []);
  const fs = (px) => px / k; const sw = (px) => px / k;
  const reg = (id, extra = {}) => ({ className: `ms-region${act.has(id) ? " is-active" : ""}`, "data-region": id, ...extra });
  const label = (x, y, txt, cls = "", anchor = "middle", px = 12) => <text x={x} y={y} textAnchor={anchor} fontSize={fs(px)} className={`ms-scenelabel ${cls}`}>{txt}</text>;
  const { chamber: C, reservoir: R, preZone: P, fragZone: F } = w;
  return (
    <g data-testid="instrument" data-analyser={analyser} data-active={[...act].join(" ")}>
      {/* sample reservoir, valve, capillary */}
      <g {...reg("inlet")}>
        <rect x={R.x0} y={R.y0} width={R.x1 - R.x0} height={R.y1 - R.y0} rx={14} className="ms-partbox" strokeWidth={sw(1.6)} />
        {label((R.x0 + R.x1) / 2, R.y0 - fs(6), "Sample reservoir", "", "middle")}
        <line x1={R.x1} y1={w.yc} x2={C.x0} y2={w.yc} className="ms-pipe" strokeWidth={sw(7)} />
        <rect x={w.valveX - fs(6)} y={w.yc - fs(11)} width={fs(12)} height={fs(22)} rx={fs(2)} className="ms-valve" />
        {showLabels && label(w.valveX + fs(8), w.yc - fs(18), "inlet valve", "is-sm", "middle", 11)}
      </g>
      {/* ion source housing */}
      <g>
        <rect x={C.x0} y={C.y0} width={C.x1 - C.x0} height={C.y1 - C.y0} rx={12} className="ms-partbox is-chamber" strokeWidth={sw(1.8)} />
        <g {...reg("ionisation")}>
          <rect x={P.x0 - 6} y={C.y0 + 2} width={w.beamX - P.x0 - 6 + 20} height={C.y1 - C.y0 - 4} rx={10} className="ms-zone" />
          {label((P.x0 + w.beamX) / 2, C.y0 - fs(8) , "Ionization region", "", "middle")}
        </g>
        <g {...reg("fragmentation")}>
          <rect x={w.beamX + 22} y={C.y0 + 2} width={F.x1 - w.beamX - 14} height={C.y1 - C.y0 - 4} rx={10} className="ms-zone" />
          {label((F.x0 + F.x1) / 2, C.y0 - fs(8), "Fragmentation region", "", "middle")}
        </g>
        {/* electron beam: filament below, trap above */}
        <g {...reg("ionisation")} data-testid="electron-beam">
          <rect x={w.beamX - 7} y={w.trapY} width={14} height={w.filamentY - w.trapY} rx={7} className="ms-ebeam" />
          <path d={`M${w.beamX - 11} ${w.filamentY + 3} q5 -9 11 0 q5 9 11 0`} className="ms-filament" strokeWidth={sw(2.4)} fill="none" />
          <rect x={w.beamX - 12} y={w.trapY - fs(7)} width={24} height={fs(7)} className="ms-trap" />
          {showLabels && label(w.beamX + 18, w.filamentY + fs(14), "filament: electron beam source (e⁻)", "is-sm", "start", 11)}
          {showLabels && label(w.beamX + 18, w.trapY - fs(9), "electron trap", "is-sm", "start", 11)}
        </g>
        <g aria-hidden="true">
          <path d={`M${w.pump.x} ${C.y1} V${w.pump.y - 8}`} className="ms-pipe" strokeWidth={sw(6)} fill="none" />
          <path d={`M${w.pump.x - 7} ${w.pump.y - 8} L${w.pump.x} ${w.pump.y + 2} L${w.pump.x + 7} ${w.pump.y - 8} Z`} fill="#7da2e6" />
          {showLabels && label(w.pump.x + 14, w.pump.y + 4, "to vacuum pump: neutral species leave here", "is-sm", "start", 11)}
        </g>
      </g>
      {/* extraction slit, acceleration plates */}
      <g {...reg("acceleration")} data-testid="accel-plates">
        <path d={`M${w.slit.x} ${C.y0} V${w.yc - 8} M${w.slit.x} ${w.yc + 8} V${C.y1}`} className="ms-plate" strokeWidth={sw(4)} />
        {[w.accel.x0, w.accel.x1].map((x, i) => (
          <path key={x} d={`M${x} ${w.yc - 54} V${w.yc - 7} M${x} ${w.yc + 7} V${w.yc + 54}`} className={`ms-plate ${i ? "is-gnd" : "is-hv"}`} strokeWidth={sw(5)} />
        ))}
        <text x={w.accel.x0} y={w.yc - 60} textAnchor="middle" fontSize={fs(13)} className="ms-scenelabel is-volt">+{V} V</text>
        <text x={w.accel.x1} y={w.yc - 60} textAnchor="middle" fontSize={fs(13)} className="ms-scenelabel is-volt">0 V</text>
        {[-30, 30].map((dy) => <path key={dy} d={`M${w.accel.x0 + 14} ${w.yc + dy} H${w.accel.x1 - 14} m-${fs(7)} -${fs(4)} l${fs(7)} ${fs(4)} l-${fs(7)} ${fs(4)}`} className="ms-efield" strokeWidth={sw(1.6)} fill="none" />)}
        {showLabels && label((w.accel.x0 + w.accel.x1) / 2, w.yc + 74, "electric field", "is-sm", "middle", 11)}
        {showLabels && label((w.accel.x0 + w.accel.x1) / 2, w.yc + 88, "accelerates + ions only", "is-sm", "middle", 11)}
      </g>
      {analyser === "sector" ? <Sector w={w} act={act} k={k} V={V} B={B} exp={exp} cat={cat} arcs={arcs} showLabels={showLabels} selMz={selMz} showFocus={showFocus} stage={stage} /> : <Tof w={w} act={act} k={k} showLabels={showLabels} />}
    </g>
  );
}

function Sector({ w, act, k, V, B, exp, cat, arcs, showLabels, selMz, showFocus, stage }) {
  const fs = (px) => px / k; const sw = (px) => px / k; const sx = w.sector; const xy = w.sectorXY;
  const dots = []; for (let a = 0.03; a < SECTOR.W; a += 0.045) for (let b = 0.03; b < SECTOR.H; b += 0.045) dots.push(xy(a, b));
  const arc = (r, end) => `M${w.plateX} ${w.yc} A${r * sx.s} ${r * sx.s} 0 0 1 ${end.x} ${end.y}`;
  const keys = exp ? [...new Set(exp.detector.map((d) => d.mz))] : [];
  const paths = arcs ? keys.map((mz) => ({ mz, ...sectorPath(mz, V, B) })) : [];
  const bx = w.plateX; const by0 = w.yc - 44; const by1 = w.yc + sx.boxH + 16;
  return (
    <g data-testid="sector-body">
      <g {...{ className: `ms-region${act.has("analyser") ? " is-active" : ""}`, "data-region": "analyser" }}>
        <rect x={bx} y={w.yc} width={sx.boxW} height={sx.boxH} className="ms-field" strokeWidth={sw(1.5)} />
        {dots.map((p, i) => <g key={i} opacity="0.5"><circle cx={p.x} cy={p.y} r={4.2} fill="none" stroke="#7dd3fc" strokeWidth={sw(1)} /><circle cx={p.x} cy={p.y} r={1.4} fill="#7dd3fc" /></g>)}
        <path d={`M${bx} ${by0} V${w.yc - 5} M${bx} ${w.yc + 5} V${by1}`} className="ms-plate" strokeWidth={sw(5)} />
        {showLabels && <text x={bx + sx.boxW / 2} y={by1 + fs(14)} textAnchor="middle" fontSize={fs(12)} className="ms-scenelabel">magnetic sector: B out of the page (⊙)</text>}
        {showLabels && <text x={bx - 8} y={w.yc - 8} textAnchor="end" fontSize={fs(11)} className="ms-scenelabel is-sm">entry slit</text>}
        {/* the detector slit sits at the tuned radius */}
        <path d={arc(SECTOR.R_DET, xy(2 * SECTOR.R_DET, 0))} fill="none" className="ms-focusarc" strokeWidth={sw(1.4)} />
      </g>
      <g {...{ className: `ms-region${act.has("detector") ? " is-active" : ""}`, "data-region": "detector" }} data-testid="detector">
        <rect x={bx - 36} y={w.detector.y - 15} width={30} height={30} rx={5} className="ms-detbox" strokeWidth={sw(1.8)} />
        <rect x={bx - 6} y={w.detector.y - 3} width={7} height={6} className="ms-detslit" />
        {showLabels && <text x={bx - 42} y={w.detector.y + 4} textAnchor="end" fontSize={fs(12)} className="ms-scenelabel is-ok">detector</text>}
        {showLabels && <text x={bx - 42} y={w.detector.y + 4 + fs(14)} textAnchor="end" fontSize={fs(11)} className="ms-scenelabel is-sm">to computer ↓</text>}
      </g>
      {paths.map((p) => {
        const ion = cat?.[p.mz]; const col = ion?.color ?? "#94a3b8"; const sel = selMz === p.mz;
        const e2 = p.outcome === "wall" ? xy(p.end.x, p.end.y) : xy(2 * p.r, 0);
        const d = arc(p.r, e2);
        return (
          <g key={p.mz} data-testid={`arc-${p.mz}`} data-outcome={p.outcome} opacity={sel || !selMz ? 1 : 0.5}>
            <path d={d} fill="none" stroke={col} strokeWidth={sw(sel ? 3 : 1.6)} strokeDasharray={p.outcome === "detector" ? undefined : `${6 / k} ${5 / k}`} opacity={p.outcome === "detector" ? 0.95 : 0.55} />
            {p.outcome === "wall" ? <text x={e2.x} y={e2.y} textAnchor="middle" dy="0.35em" fontSize={fs(14)} fontWeight="900" fill="#fca5a5">✕</text> : <circle cx={e2.x} cy={e2.y} r={fs(3.6)} fill={col} />}
          </g>
        );
      })}
      {void stage}{void showFocus}
    </g>
  );
}

function Tof({ w, act, k, showLabels }) {
  const fs = (px) => px / k; const sw = (px) => px / k; const T = w.tof;
  return (
    <g data-testid="tof-body">
      <g {...{ className: `ms-region${act.has("analyser") ? " is-active" : ""}`, "data-region": "analyser" }}>
        <path d={`M${w.plateX} ${w.yc - 54} V${w.yc - T.h / 2} M${w.plateX} ${w.yc + T.h / 2} V${w.yc + 54}`} className="ms-plate" strokeWidth={sw(4)} />
        <rect x={w.plateX} y={w.yc - T.h / 2} width={T.L} height={T.h} rx={10} className="ms-tube" strokeWidth={sw(1.6)} />
        {showLabels && <text x={w.plateX + T.L / 2} y={w.yc - T.h / 2 - fs(8)} textAnchor="middle" fontSize={fs(12)} className="ms-scenelabel">field-free flight tube, L = 1 m (drawn shorter, not to scale)</text>}
      </g>
      <g {...{ className: `ms-region${act.has("detector") ? " is-active" : ""}`, "data-region": "detector" }} data-testid="detector">
        <rect x={w.detector.x} y={w.yc - T.h / 2 + 2} width={16} height={T.h - 4} rx={4} className="ms-detbox" strokeWidth={sw(1.8)} />
        {showLabels && <text x={w.detector.x + 8} y={w.yc + T.h / 2 + fs(16)} textAnchor="middle" fontSize={fs(12)} className="ms-scenelabel is-ok">detector</text>}
        {showLabels && <text x={w.detector.x + 8} y={w.yc + T.h / 2 + fs(30)} textAnchor="middle" fontSize={fs(11)} className="ms-scenelabel is-sm">to computer ↓</text>}
      </g>
    </g>
  );
}
export { shapePath };
