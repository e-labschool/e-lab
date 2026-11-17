// The nine apparatus scenes. Each draws the set-up parts progressively (placed = number of set-up steps done) and, while running,
// reads the run model's `view` so the picture is always exactly what the model says.
import { Basin, Beaker, Bench, Bunsen, Clamp, Condenser, CondenserPorts, Defs, Flask, Grains, HeatMat, NextSlot, Shadow, Stand, Stream, Thermometer, Tripod, VB, WaterPort, Wisps, useScenePrefix } from "./kit.jsx";
import { liquidColour, solidColour, turbidity } from "../look.js";
import { SUBSTANCES } from "../../model/chem.js";
import { CHROMA } from "../../model/chromatography.js";
import { gramsOf } from "../../model/mixtures.js";

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** colour of a temperature: cool blue -> warm amber -> hot red */
export function tempColour(T) {
  const t = clamp((T - 20) / 280, 0, 1);
  const stops = [[0, [92, 160, 232]], [0.25, [120, 200, 170]], [0.5, [240, 200, 90]], [0.8, [236, 120, 60]], [1, [200, 50, 50]]];
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i]; const k = (t - t0) / (t1 - t0); return `rgb(${c0.map((v, j) => Math.round(lerp(v, c1[j], k))).join(",")})`; }
  return "rgb(200,50,50)";
}

function Root({ p, children, label, sample }) {
  const text = sample?.label ? `Sample: ${sample.label}` : null;
  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="ms-scene" role="img" aria-label={label} preserveAspectRatio="xMidYMid meet" data-testid="ms-scene">
      <Defs p={p} />
      <Bench p={p} />
      {text && <g aria-hidden="true"><rect x={VB.w - Math.round(text.length * 7.6 + 18) - 10} y="10" width={Math.round(text.length * 7.6 + 18)} height="26" rx="13" fill="#ffffff" stroke="#9aa9c9" /><text x={VB.w - Math.round(text.length * 7.6 + 18)} y="28" className="ms-svg-label" fontWeight="700">{text}</text></g>}
      {children}
    </svg>
  );
}
const show = (placed, i) => placed > i;
const Slot = ({ placed, stage, i, ...rest }) => (stage === "setup" && placed === i ? <NextSlot n={i + 1} {...rest} /> : null);
const Goggles = ({ x, y }) => (
  <g aria-hidden="true" transform="translate(0 0)"><rect x={x} y={y} width="46" height="22" rx="9" fill="#e6f1ff" fillOpacity="0.7" stroke="#2c3f66" strokeWidth="2.2" /><line x1={x + 23} y1={y} x2={x + 23} y2={y + 22} stroke="#2c3f66" strokeWidth="2" /><path d={`M${x},${y + 8} q-10,2 -12,10 M${x + 46},${y + 8} q10,2 12,10`} fill="none" stroke="#2c3f66" strokeWidth="2.2" /><text x={x + 23} y={y + 40} textAnchor="middle" className="ms-svg-label">goggles</text></g>
);

// ------------------------------------------------------------------------------------------------------------- filtration
export function FiltrationScene({ placed, stage, view, ctl, sample, label }) {
  const p = useScenePrefix();
  const lq = liquidColour(sample); const sc = solidColour(sample);
  const V = view.V || 0; const poured = view.poured ?? 0; const pouring = stage === "run" && ctl.pour > 0.02 && (V ? poured < V - 0.01 : view.cake < 1);
  const srcLevel = V ? 1 - poured / V : sample.parts.some((q) => q.form === "solid") ? 1 - (view.cake ?? 0) : 0;
  const cx = 360; const funnelTop = 160; const funnelBottom = 262; const stemEnd = 330;
  const lvl = clamp((view.level ?? 0) / 60, 0, 1);
  const filtrateLevel = V ? clamp((view.drained ?? 0) / V, 0, 1) * 0.62 : 0;
  const cake = view.cake ?? 0; const bypass = view.overflow;
  const turbF = bypass ? 0.5 : 0;
  const tilt = pouring ? 34 : 0;
  const innerY = (t) => lerp(funnelTop + 10, funnelBottom, t);
  const halfW = (y) => lerp(74, 5, clamp((y - funnelTop) / (funnelBottom - funnelTop), 0, 1));
  const liqTop = funnelBottom - lvl * (funnelBottom - funnelTop - 14);
  return (
    <Root p={p} label={label} sample={sample}>
      <Stand p={p} x={cx + 120} yTop={96} baseW={150} baseSide={-1} />
      {show(placed, 1) && <Clamp p={p} xRod={cx + 120} xGrip={cx + 66} y={196} />}
      {show(placed, 0) && <Beaker p={p} x={cx - 62} y={stemEnd - 6} w={124} h={VB.bench - stemEnd + 6} level={filtrateLevel / 0.62 * 0.62} liquid={lq.colour} liquidOpacity={lq.opacity} turbid={turbF} clip="fb" label="filtrate" />}
      {show(placed, 1) && (
        <g>
          <path d={`M${cx - 76},${funnelTop} L${cx - 6},${funnelBottom + 4} L${cx - 6},${stemEnd - 2} L${cx + 6},${stemEnd - 2} L${cx + 6},${funnelBottom + 4} L${cx + 76},${funnelTop}`} fill="#f4f8ff" fillOpacity="0.35" stroke="var(--ms-glass-stroke)" strokeWidth="2.2" strokeLinejoin="round" />
          {show(placed, 2) && (
            <g>
              <clipPath id={`${p}-fcone`}><path d={`M${cx - 70},${funnelTop + 4} L${cx - 3},${funnelBottom + 2} L${cx + 3},${funnelBottom + 2} L${cx + 70},${funnelTop + 4} Z`} /></clipPath>
              <path d={`M${cx - 70},${funnelTop + 4} L${cx - 3},${funnelBottom + 2} L${cx + 3},${funnelBottom + 2} L${cx + 70},${funnelTop + 4} Z`} fill={show(placed, 3) ? "#f3efe3" : "#fbf8ef"} stroke={show(placed, 3) ? "#b5ad98" : "#8d856f"} strokeWidth="1.6" />
              {show(placed, 3) && (
                <g clipPath={`url(#${p}-fcone)`}>
                  {lvl > 0.01 && <path d={`M${cx - halfW(liqTop)},${liqTop} L${cx + halfW(liqTop)},${liqTop} L${cx + 4},${funnelBottom + 2} L${cx - 4},${funnelBottom + 2} Z`} fill={lq.colour} opacity={lq.opacity} />}
                  {sc && cake > 0.01 && V > 0 && <path d={`M${cx - 20 - cake * 12},${funnelBottom - 1} Q${cx},${funnelBottom - 6 - cake * 26} ${cx + 20 + cake * 12},${funnelBottom - 1} Z`} fill={sc} stroke="#00000030" />}
                  {sc && view.dry && cake > 0.01 && <path d={`M${cx - 36},${funnelBottom - 2} Q${cx},${funnelBottom - 8 - cake * 18} ${cx + 36},${funnelBottom - 2} Z`} fill={sc} stroke="#00000030" />}
                  {Array.from({ length: 4 }, (_, i) => <line key={i} x1={cx - 52 + i * 35} y1={funnelTop + 6} x2={cx} y2={funnelBottom} stroke="#0000000f" strokeWidth="1" />)}
                </g>
              )}
              <path d={`M${cx - 70},${funnelTop + 4} L${cx + 70},${funnelTop + 4}`} stroke="#8d856f" strokeWidth="2" />
            </g>
          )}
          {show(placed, 1) && lvl > 0.01 && <Drip x={cx} y={stemEnd + 4} yEnd={VB.bench - 12 - filtrateLevel * 85} colour={lq.colour} />}
        </g>
      )}
      {Slot({ placed, stage, i: 0, x: cx, y: 385, w: 100, h: 70 })}
      {Slot({ placed, stage, i: 1, x: cx, y: 200, w: 180, h: 140 })}
      {Slot({ placed, stage, i: 2, x: cx, y: 210, w: 130, h: 80 })}
      {Slot({ placed, stage, i: 3, x: cx, y: 230, w: 110, h: 60 })}
      {/* the mixture to be filtered, held above and tilted to pour down a glass rod */}
      {(() => {
        const held = stage !== "setup";
        return (
          <g>
            <Beaker p={p} x={held ? 60 : 70} y={held ? 104 : 308} w={102} h={120} level={srcLevel * 0.85} liquid={lq.colour} liquidOpacity={lq.opacity} turbid={turbidity(sample) * 0.9} tilt={tilt} pivot={[162, 104]} clip="fs"
              solids={sc && !hasLiquidParts(sample) ? <Grains x={held ? 64 : 74} yb={held ? 220 : 424} w={92} h={22 + 12 * srcLevel} colour={sc} seed={5} /> : null} label={tilt ? null : "mixture"} />
            {held && <line x1={tilt ? 168 : 150} y1={tilt ? 106 : 100} x2={tilt ? 330 : 250} y2={tilt ? 170 : 160} stroke="#dde7f6" strokeWidth="5" strokeLinecap="round" opacity={stage === "run" ? 1 : 0.9} />}
            {pouring && V > 0 && <Stream x1={166} y1={116} x2={cx - 8 + (view.overflow ? 40 : 0)} y2={lvl > 0.01 ? liqTop : funnelBottom - 10} colour={lq.colour} w={4} />}
          </g>
        );
      })()}
      {view.overflow && stage === "run" && <text x={cx + 90} y={150} className="ms-svg-warn">too fast: overflow!</text>}
    </Root>
  );
}
const hasLiquidParts = (s) => s.parts.some((q) => q.form === "liquid");
const Drip = ({ x, y, yEnd, colour }) => (
  <g aria-hidden="true"><circle className="ms-drip" cx={x} cy={y} r="3.2" fill={colour} style={{ ["--ms-drip-len"]: `${Math.max(10, yEnd - y)}px` }} /></g>
);

// ------------------------------------------------------------------------------------------------- evaporation / crystallisation
export function BasinScene({ placed, stage, view, ctl, sample, method, label }) {
  const p = useScenePrefix();
  const lq = liquidColour(sample); const sc = solidColour(sample);
  const cx = 320; const gaugeY = 316; const basinY = gaugeY - 40;
  const heatOn = stage === "run" && !view.phase?.startsWith?.("cool") && !(method === "crystallisation" && ctl.stop);
  const flame = heatOn ? (ctl.heat ?? 0.5) : 0;
  const level = stage === "setup" ? (placed >= 3 ? 1 : 0) : view.liquid ?? 1;
  const resid = Object.entries(sample.parts.reduce((a, q) => { if (q.form !== "liquid") a[q.sub] = (a[q.sub] ?? 0) + q.g; return a; }, {}));
  const residueFrac = clamp((1 - (view.liquid ?? 1)) * 1.1, 0, 1);
  const hasSolid = resid.length > 0;
  const solidCol = hasSolid ? (SUBSTANCES[resid.sort((a, b) => b[1] - a[1])[0][0]]?.colour ?? "#e8e8ee") : null;
  const showCryst = method === "crystallisation" ? clamp((view.crystals ?? 0) / Math.max(1, sample.parts.filter((q) => SUBSTANCES[q.sub].solubility).reduce((a, q) => a + q.g, 0)), 0, 1) : 0;
  const solutionBlue = view.waterG != null ? clamp(view.waterG / Math.max(1, gramsOf(sample, "water")), 0.05, 1) : 1;
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, 0) && <HeatMat p={p} cx={cx} />}
      {show(placed, 0) && <Bunsen p={p} cx={cx} base={VB.bench - 6} heat={flame} on={flame > 0.001 || stage !== "run"} />}
      {show(placed, 0) && stage !== "run" && <g />}
      {show(placed, 1) && <Tripod p={p} cx={cx} y={gaugeY} w={170} />}
      {show(placed, 2) && <Basin p={p} cx={cx} y={basinY} w={150} h={40} level={placed >= 3 || stage !== "setup" ? level * 0.9 : 0} liquid={lq.colour} liquidOpacity={clamp(lq.opacity * (0.55 + 0.45 * solutionBlue), 0.3, 0.9)} bubbling={view.boiling} solid={solidCol} solidFrac={hasSolid ? residueFrac : 0} crystals={showCryst} />}
      {stage === "run" && (view.boiling || view.vapour > 0.05) && <Wisps cx={cx} y={basinY - 8} n={4} spread={90} opacity={clamp(view.vapour * 1.4 + 0.2, 0.2, 0.7)} />}
      {method === "crystallisation" && show(placed, 3) && (
        <g aria-hidden="true">
          <line x1={cx + 20} y1={basinY - 54} x2={cx + 96} y2={basinY - 6} stroke="#dbe7f7" strokeWidth="6" strokeLinecap="round" />
          <line x1={cx + 20} y1={basinY - 54} x2={cx + 96} y2={basinY - 6} stroke="#8aa0c4" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
          {view.rod && <g><circle cx={cx + 20} cy={basinY - 54} r="5" fill="#bfe0ff" stroke="#3b7fcf" /><text x={cx + 30} y={basinY - 62} className="ms-svg-label">crystals on the rod: stop heating</text></g>}
        </g>
      )}
      {(method === "evaporation" ? show(placed, 3) : show(placed, 4)) && <Goggles x={520} y={396} />}
      {view.flash && <g><ellipse cx={cx} cy={basinY - 40} rx="120" ry="90" fill="#ff8a1c" opacity="0.4" className="ms-flash" /><text x={cx} y={basinY - 130} textAnchor="middle" className="ms-svg-warn">flammable vapour has caught fire!</text></g>}
      {view.phase === "cool" && <text x={cx} y={basinY + 80} textAnchor="middle" className="ms-svg-label">cooling: crystals growing</text>}
      {Slot({ placed, stage, i: 0, x: cx, y: 400, w: 110, h: 54 })}
      {Slot({ placed, stage, i: 1, x: cx, y: gaugeY + 14, w: 190, h: 50 })}
      {Slot({ placed, stage, i: 2, x: cx, y: basinY + 22, w: 170, h: 64 })}
      {Slot({ placed, stage, i: 3, x: method === "evaporation" ? 543 : cx + 60, y: method === "evaporation" ? 408 : basinY - 30, w: method === "evaporation" ? 80 : 110, h: method === "evaporation" ? 60 : 90 })}
      {method === "crystallisation" && Slot({ placed, stage, i: 4, x: 543, y: 408, w: 80, h: 60 })}
    </Root>
  );
}

// ----------------------------------------------------------------------------------------------------------- distillation
function Conical({ p, x, y, w = 78, h = 92, level = 0, liquid, opacity = 0.75, clip, active, label, small = false }) {
  const id = `${p}-${clip}`; const nw = w * 0.32; const cx = x + w / 2;
  const d = `M${cx - nw / 2},${y} L${cx - nw / 2},${y + h * 0.34} L${x},${y + h - 6} Q${x},${y + h} ${x + 6},${y + h} L${x + w - 6},${y + h} Q${x + w},${y + h} ${x + w},${y + h - 6} L${cx + nw / 2},${y + h * 0.34} L${cx + nw / 2},${y}`;
  const liqY = y + h - clamp(level, 0, 1) * (h * 0.78);
  return (
    <g opacity={active === false ? 0.82 : 1}>
      <clipPath id={id}><path d={`${d} Z`} /></clipPath>
      <g clipPath={`url(#${id})`}>{level > 0.003 && <><rect x={x} y={liqY} width={w} height={y + h - liqY + 2} fill={liquid} opacity={opacity} /><rect x={x} y={liqY} width={w} height="3" fill="#fff" opacity="0.5" /></>}</g>
      <path d={d} fill="none" stroke={active ? "var(--ms-accent)" : "var(--ms-glass-stroke)"} strokeWidth={active ? 3 : 2.2} strokeLinecap="round" strokeLinejoin="round" />
      <path d={`${d} Z`} fill={`url(#${p}-glass)`} />
      <line x1={cx - nw / 2 - 3} y1={y} x2={cx + nw / 2 + 3} y2={y} stroke="var(--ms-glass-stroke)" strokeWidth="2.4" strokeLinecap="round" />
      {label && <text x={cx} y={y + h + (small ? 14 : 18)} textAnchor="middle" className="ms-svg-label" fontWeight={active ? 700 : 400}>{label}</text>}
    </g>
  );
}

export function DistillationScene({ placed, stage, view, ctl, sample, method, run, label }) {
  const p = useScenePrefix();
  const frac = method === "fractional-distillation";
  const lq = liquidColour(sample); const turb = turbidity(sample);
  const fx = 140; const gaugeY = 316; const r = 44; const neckH = 34; const flaskBottom = gaugeY - 2;
  const cy = flaskBottom - r; const neckTop = cy - r + 2 - neckH;
  const colTop = neckTop - 84; const headY = frac ? colTop - 14 : neckTop - 14;
  const flame = stage === "run" && !run.done ? ctl.heat ?? 0.7 : 0;
  const level = stage === "setup" ? (placed >= 2 ? 0.46 : 0) : clamp(0.1 + (view.liquid ?? 1) * 0.46, 0.04, 0.6);
  const Tpot = view.Tpot ?? 20; const Thead = view.Thead ?? 20;
  const boiling = !!view.boiling;
  const steps = frac ? { burner: 0, flask: 1, clamp: 2, column: 3, head: 4, condenser: 5, receiver: 6 } : { burner: 0, flask: 1, clamp: 2, head: 3, condenser: 4, receiver: 5 };
  const sx = 70; // stand rod
  const sideY = headY + 2; const cStart = [fx + 34, sideY + 8]; const cEnd = [fx + 300, VB.bench - 92 - 30];
  const rcx = cEnd[0] + 4; const rcvY = VB.bench - 92; const rW = 74;
  const colStops = (view.stageT && view.stageT.length ? view.stageT : [Tpot]).slice();
  const stops = [Tpot, ...colStops, colStops[colStops.length - 1]];
  const mlNow = (view.receiverMl ?? [0])[view.receiver ?? 0] ?? 0;
  const totalMl = sample.parts.filter((q) => q.form === "liquid").reduce((a, q) => a + q.g / (SUBSTANCES[q.sub].density || 1), 0) || 100;
  const dripOn = stage === "run" && (view.flow ?? 0) > 0.03;
  const receivers = view.receiverMl ?? [0];
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, steps.burner) && <HeatMat p={p} cx={fx} w={120} />}
      {show(placed, steps.burner) && <Bunsen p={p} cx={fx} base={VB.bench - 6} heat={flame} on={flame > 0.001 || stage !== "run"} />}
      {show(placed, steps.burner) && <Tripod p={p} cx={fx} y={gaugeY} w={130} />}
      {show(placed, steps.clamp) && <Stand p={p} x={sx} yTop={neckTop - (frac ? 40 : 10)} baseW={130} baseSide={1} />}
      {show(placed, steps.clamp) && <Clamp p={p} xRod={sx} xGrip={fx - 12} y={neckTop + 24} />}
      {show(placed, steps.flask) && <Flask p={p} cx={fx} y0={neckTop} r={r} neckH={neckH} level={level} liquid={lq.colour} liquidOpacity={lq.opacity} boiling={boiling} granules clip="df" turbid={turb * 0.8} solids={sample.parts.some((q) => q.form === "solid") ? <Grains x={fx - 30} yb={cy + r - 2} w={60} h={10} colour={solidColour(sample) ?? "#d8b574"} n={24} seed={2} /> : null} />}
      {frac && show(placed, steps.column) && (
        <g>
          <clipPath id={`${p}-col`}><rect x={fx - 14} y={colTop} width="28" height={neckTop - colTop + 2} rx="4" /></clipPath>
          <linearGradient id={`${p}-colg`} x1="0" x2="0" y1="1" y2="0">{stops.map((T, i) => <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={stage === "run" ? tempColour(T) : "#e8f0fb"} stopOpacity={stage === "run" ? 0.75 : 0.5} />)}</linearGradient>
          <rect x={fx - 14} y={colTop} width="28" height={neckTop - colTop + 2} rx="4" fill={`url(#${p}-colg)`} />
          <g clipPath={`url(#${p}-col)`}>{Array.from({ length: 22 }, (_, i) => <circle key={i} cx={fx - 8 + ((i * 7) % 17)} cy={colTop + 6 + i * 5} r="3.2" fill="#fff" fillOpacity="0.7" stroke="#8aa0c4" strokeWidth="0.9" />)}</g>
          <rect x={fx - 14} y={colTop} width="28" height={neckTop - colTop + 2} rx="4" fill="none" stroke="var(--ms-glass-stroke)" strokeWidth="2.2" />
          <rect x={fx - 14} y={colTop} width="28" height={neckTop - colTop + 2} rx="4" fill={`url(#${p}-glass)`} />
          {stage === "run" && <text x={fx - 24} y={colTop + 20} textAnchor="end" className="ms-svg-label">top: {Math.round(view.stageT?.[view.stageT.length - 1] ?? Thead)} °C</text>}
          {stage === "run" && <text x={fx - 24} y={neckTop - 6} textAnchor="end" className="ms-svg-label">bottom: {Math.round(Tpot)} °C</text>}
        </g>
      )}
      {show(placed, steps.head) && (
        <g>
          <path d={`M${fx - 12},${headY + 14} L${fx - 12},${headY + 4} Q${fx - 12},${headY - 2} ${fx - 4},${headY - 2} L${fx + 6},${headY - 2} Q${fx + 12},${headY - 2} ${fx + 14},${headY + 4} L${fx + 34},${headY + 8}`} fill="none" stroke="var(--ms-glass-stroke)" strokeWidth="2.4" strokeLinecap="round" />
          <path d={`M${fx - 12},${headY + 14} L${fx - 12},${neckTop + 2}`} stroke="var(--ms-glass-stroke)" strokeWidth="2.4" />
          <path d={`M${fx + 12},${headY + 14} L${fx + 12},${neckTop + 2}`} stroke="var(--ms-glass-stroke)" strokeWidth="2.4" />
          <rect x={fx - 10} y={headY - 14} width="20" height="12" rx="3" fill="#7a6a58" stroke="#4a3d30" />
          <Thermometer p={p} x={fx} y={headY - 80} h={80} t={Thead} tmin={0} tmax={frac ? 320 : 120} bulb={false} />
          <circle cx={fx} cy={headY + 12} r="6" fill="#d6323a" stroke="var(--ms-glass-stroke)" strokeWidth="1.5" />
                    <g aria-hidden="true"><rect x={fx + 20} y={headY - 82} width="84" height="26" rx="6" fill="#142040" /><text x={fx + 62} y={headY - 64} textAnchor="middle" className="ms-lcd">{Thead.toFixed(1)} °C</text></g>
        </g>
      )}
      {show(placed, steps.condenser) && (
        <g>
          <Condenser p={p} x1={cStart[0]} y1={cStart[1]} x2={cEnd[0]} y2={cEnd[1]} wf={stage === "run" ? 1 : 0.2} />
          <CondenserPorts x1={cStart[0]} y1={cStart[1]} x2={cEnd[0]} y2={cEnd[1]} />
          {stage === "run" && boiling && <path d={`M${cStart[0] - 18},${cStart[1] - 2} L${cEnd[0] - 20},${cEnd[1] - 8}`} stroke="#fff" strokeWidth="3" strokeDasharray="4 12" className="ms-vapour" opacity="0.9" />}
          {dripOn && <Drip x={cEnd[0] + 6} y={cEnd[1] + 6} yEnd={rcvY + 74 - clamp(mlNow / totalMl, 0, 1) * 62} colour={lq.colour} />}
        </g>
      )}
      {show(placed, steps.receiver) && (
        <g>
          <Conical p={p} x={rcx - rW / 2} y={rcvY} w={rW} h={92} level={clamp(mlNow / (totalMl * 0.9), 0, 1)} liquid={lq.colour} opacity={lq.opacity} clip="rv" active label={receivers.length > 1 || (view.receiver ?? 0) > 0 ? `flask ${(view.receiver ?? 0) + 1}` : "receiver"} />
          {receivers.length > 1 && receivers.map((ml, i) => i < (view.receiver ?? 0) && <Conical key={i} p={p} x={rcx + 62 + (i % 3) * 38} y={VB.bench - 52} w={34} h={52} level={clamp(ml / (totalMl * 0.9), 0, 1)} liquid={lq.colour} opacity={lq.opacity} clip={`rq${i}`} label={`${i + 1}`} small active={false} />)}
        </g>
      )}
      {Slot({ placed, stage, i: steps.burner, x: fx, y: 392, w: 150, h: 70 })}
      {Slot({ placed, stage, i: steps.flask, x: fx, y: cy + 10, w: 130, h: 150 })}
      {Slot({ placed, stage, i: steps.clamp, x: (sx + fx) / 2, y: neckTop + 24, w: 90, h: 50 })}
      {frac && Slot({ placed, stage, i: steps.column, x: fx, y: (colTop + neckTop) / 2, w: 64, h: 150 })}
      {Slot({ placed, stage, i: steps.head, x: fx, y: headY - 20, w: 70, h: 110 })}
      {Slot({ placed, stage, i: steps.condenser, x: (cStart[0] + cEnd[0]) / 2, y: (cStart[1] + cEnd[1]) / 2, w: 230, h: 120 })}
      {Slot({ placed, stage, i: steps.receiver, x: rcx, y: rcvY + 46, w: 100, h: 110 })}
    </Root>
  );
}

// -------------------------------------------------------------------------------------------------------- chromatography
export function ChromatographyScene({ placed, stage, view, sample, solvent, run, label }) {
  const p = useScenePrefix();
  const bx = 190; const bw = 190; const rimY = 112; const bottom = 420;
  const px = bx + bw / 2; const pw = 78; const yOf = (cm) => 400 - 20 * cm;
  const gram = run.gram; const front = view.front; const frontDist = view.frontDist;
  const solventLevel = yOf(CHROMA.solventLine - 0.1); // solvent surface just under the baseline
  const solventCol = solvent === "ethanol" ? "#d3eadd" : "#a8d3f5";
  const baselineY = yOf(CHROMA.baseline);
  const wet = stage === "run" || stage === "done" ? yOf(front) : yOf(CHROMA.solventLine);
  const ruler = [...Array(10)].map((_, i) => i);
  return (
    <Root p={p} label={label} sample={sample}>
      <Beaker p={p} x={bx} y={rimY} w={bw} h={bottom - rimY} level={show(placed, 2) ? (400 - solventLevel + 18) / (bottom - rimY - 10) : 0} liquid={solventCol} liquidOpacity={0.6} clip="cb" label={null} />
      {show(placed, 3) && (
        <g>
          <line x1={bx - 8} y1={rimY + 20} x2={bx + bw + 8} y2={rimY + 20} stroke="#8a93a8" strokeWidth="5" strokeLinecap="round" />
          <rect x={px - pw / 2} y={yOf(12)} width={pw} height={400 - yOf(12)} fill="#f8f5ec" stroke="#b9b29c" strokeWidth="1.6" />
          {(stage === "run" || stage === "done") && <rect x={px - pw / 2 + 1} y={wet} width={pw - 2} height={400 - wet} fill={solvent === "ethanol" ? "#cfe3d4" : "#cfe4f7"} opacity="0.85" />}
          {stage === "run" || stage === "done" ? <line x1={px - pw / 2} x2={px + pw / 2} y1={wet} y2={wet} stroke="#2a5fa8" strokeWidth="2" strokeDasharray="5 3" /> : null}
        </g>
      )}
      {show(placed, 0) && <line x1={px - pw / 2 + 4} y1={baselineY} x2={px + pw / 2 - 4} y2={baselineY} stroke="#4b4f58" strokeWidth="1.8" />}
      {show(placed, 1) && <Spots gram={gram} view={view} px={px} baselineY={baselineY} yOf={yOf} running={stage === "run" || stage === "done"} />}
      {show(placed, 4) && <g aria-hidden="true"><ellipse cx={bx + bw / 2} cy={rimY - 4} rx={bw / 2 + 6} ry="7" fill="#e9f1ff" fillOpacity="0.8" stroke="var(--ms-glass-stroke)" strokeWidth="2" /><rect x={bx + bw / 2 - 9} y={rimY - 20} width="18" height="10" rx="4" fill="#9db4d6" stroke="var(--ms-glass-stroke)" /></g>}
      {/* ruler measured from the baseline */}
      <g aria-hidden="true">
        <rect x={bx + bw + 28} y={baselineY - 9 * 20 - 16} width="24" height={9 * 20 + 22} rx="3" fill="#f6efc9" stroke="#b9a95a" />
        {ruler.map((i) => <g key={i}><line x1={bx + bw + 28} x2={bx + bw + 40} y1={baselineY - i * 20} y2={baselineY - i * 20} stroke="#6b5f1e" strokeWidth="1.2" /><text x={bx + bw + 58} y={baselineY - i * 20 + 4} className="ms-svg-label">{i}</text></g>)}
        <text x={bx + bw + 40} y={baselineY - 9 * 20 - 22} textAnchor="middle" className="ms-svg-label">cm</text>
        <text x={bx + bw + 40} y={baselineY + 20} textAnchor="middle" className="ms-svg-label">0 = baseline</text>
      </g>
      {(stage === "run" || stage === "done") && frontDist > 0.1 && (
        <g aria-hidden="true">
          <line x1={px + pw / 2} x2={bx + bw + 30} y1={yOf(front)} y2={yOf(front)} stroke="#2a5fa8" strokeWidth="1.2" strokeDasharray="3 3" />
          <text x={bx - 14} y={yOf(front) + 4} textAnchor="end" className="ms-svg-label" fill="#1d5fad">solvent front</text>
          {view.spots.map((s) => s.dist > 0.05 && <line key={s.sub} x1={px} x2={bx + bw + 30} y1={baselineY - s.dist * 20} y2={baselineY - s.dist * 20} stroke={SUBSTANCES[s.sub].colour} strokeWidth="1.2" strokeDasharray="2 3" />)}
        </g>
      )}
      <text x={bx - 14} y={baselineY + 4} textAnchor="end" className="ms-svg-label">baseline</text>
      {Slot({ placed, stage, i: 0, x: px, y: baselineY, w: 110, h: 34 })}
      {Slot({ placed, stage, i: 1, x: px, y: baselineY - 2, w: 60, h: 40 })}
      {Slot({ placed, stage, i: 2, x: px, y: solventLevel + 20, w: 150, h: 44 })}
      {Slot({ placed, stage, i: 3, x: px, y: 250, w: 110, h: 220 })}
      {Slot({ placed, stage, i: 4, x: px, y: rimY - 10, w: 220, h: 54 })}
    </Root>
  );
}
function Spots({ gram, view, px, baselineY, yOf, running }) {
  if (!gram.spots.length && !gram.invisible.length) return <g><circle cx={px} cy={baselineY - 2} r="3" fill="#5a5f6b" /></g>;
  if (!running) return <g>{gram.spots.map((s, i) => <circle key={s.sub} cx={px - 6 + i * 6} cy={baselineY - 2} r="4.2" fill={s.colour} opacity="0.92" />)}{!gram.spots.length && <circle cx={px} cy={baselineY - 2} r="3" fill="#b9bdc8" />}</g>;
  return (
    <g>
      {view.spots.map((s, i) => { const dist = Math.max(0, s.dist); const y = baselineY - dist * 20; const stretch = 1 + Math.min(1.6, dist * 0.22); return <ellipse key={s.sub} cx={px + (i - (view.spots.length - 1) / 2) * 0} cy={y - 2} rx={6 + (s.rf > 0 ? 3 : 0)} ry={4.5 * stretch} fill={SUBSTANCES[s.sub].colour} opacity="0.9" />; })}
    </g>
  );
}

// ----------------------------------------------------------------------------------------------------------------- magnetic
export function MagneticScene({ placed, stage, view, sample, label }) {
  const p = useScenePrefix();
  const iron = gramsOf(sample, "iron") > 0; const otherSub = sample.parts.find((q) => q.form === "solid" && !SUBSTANCES[q.sub].magnetic)?.sub;
  const otherCol = otherSub ? SUBSTANCES[otherSub].colour : "#e5cf2a";
  const mx = 130 + (view.sweeping ? view.sweep : view.passes % 2 ? 1 : 0) * 300;
  const tray = { x: 110, y: 372, w: 340, h: 48 };
  const col = view.collected ?? 0;
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, 0) && (
        <g>
          <Shadow p={p} cx={tray.x + tray.w / 2} w={tray.w + 40} />
          <path d={`M${tray.x},${tray.y} L${tray.x + 10},${tray.y + tray.h} L${tray.x + tray.w - 10},${tray.y + tray.h} L${tray.x + tray.w},${tray.y} Z`} fill="#e4e9f4" stroke="#7d8aa6" strokeWidth="2" />
          <Grains x={tray.x + 30} yb={tray.y + tray.h - 6} w={150} h={26} colour={otherCol} n={50} seed={4} />
          {Array.from({ length: 34 }, (_, i) => { const t = (i * 37) % 100; const px = tray.x + 24 + (t / 100) * (tray.w - 48); const py0 = tray.y + tray.h - 8 - ((i * 13) % 24); const under = view.sweeping && Math.abs(px - (mx + 0)) < 64 && (i % 5 !== 0); const py = under ? py0 - (py0 - 330) * 0.78 : py0; const stay = i / 34 >= col * 0.98; return stay && iron ? <rect key={i} x={px} y={py} width="4.5" height="3" rx="0.8" fill="#4f5360" transform={`rotate(${(i * 47) % 90} ${px} ${py})`} /> : null; })}
        </g>
      )}
      {show(placed, 1) && (
        <g transform={`translate(${mx} ${view.sweeping ? 318 : 300})`}>
                    <rect x="-38" y="-9" width="38" height="24" rx="4" fill="#d9363f" /><rect x="0" y="-9" width="38" height="24" rx="4" fill="#9aa3b5" />
          <text x="-19" y="8" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">N</text><text x="19" y="8" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1d2640">S</text>
          {iron && Array.from({ length: Math.round(col * 26) }, (_, i) => <rect key={i} x={-34 + ((i * 11) % 70)} y={19 + (i % 3) * 3} width="4.5" height="3" rx="0.8" fill="#4f5360" />)}
        </g>
      )}
      {show(placed, 2) && <g><path d="M486,412 Q486,432 506,432 L570,432 Q590,432 590,412 Z" fill="#fbfaf6" stroke="#8d8a7d" strokeWidth="2" /><text x="538" y="456" textAnchor="middle" className="ms-svg-label">dish for iron</text>{iron && col > 0.4 && stage === "done" && Array.from({ length: Math.round(col * 22) }, (_, i) => <rect key={i} x={498 + (i * 17) % 82} y={418 + (i % 3)} width="4.5" height="3" rx="0.8" fill="#4f5360" />)}</g>}
      {Slot({ placed, stage, i: 0, x: 280, y: 396, w: 380, h: 70 })}
      {Slot({ placed, stage, i: 1, x: 175, y: 306, w: 110, h: 60 })}
      {Slot({ placed, stage, i: 2, x: 538, y: 418, w: 130, h: 60 })}
    </Root>
  );
}

// ------------------------------------------------------------------------------------------------------ separating funnel
function funnelColours(sample) {
  const liquids = sample.parts.filter((q) => q.form === "liquid");
  const polar = liquids.filter((q) => SUBSTANCES[q.sub].polar); const non = liquids.filter((q) => !SUBSTANCES[q.sub].polar);
  const col = (list, fb) => (list.length ? liquidColour({ parts: list }).colour : fb);
  const dens = (list) => list.reduce((a, q) => a + q.g, 0) / Math.max(1e-9, list.reduce((a, q) => a + q.g / (SUBSTANCES[q.sub].density || 1), 0));
  const polarLower = !polar.length || !non.length ? true : dens(polar) > dens(non);
  const pc = col(polar, "#79b9ee"); const nc = col(non, "#e6b422");
  return polarLower ? [pc, nc] : [nc, pc];
}
export function FunnelScene({ placed, stage, view, ctl, sample, run, label }) {
  const p = useScenePrefix();
  const cx = 300; const topY = 96; const bulbMid = 200;
  const [lowerCol, upperCol] = funnelColours(sample);
  const total = view.total || 1; const drained = view.drained ?? 0;
  const lowerRem = Math.max(0, view.lowerG - drained); const upperRem = view.upperG - Math.max(0, drained - view.lowerG);
  const H = 200; const base = 328;
  const hLower = (H * lowerRem) / total; const hUpper = (H * Math.max(0, upperRem)) / total;
  const liquidsShown = stage !== "setup" || placed >= 3;
  const tapOpen = (ctl.tap ?? 0) > 0.02 && stage === "run";
  const beakerLevel = clamp(drained / total, 0, 1) * 0.7;
  const funnelPath = `M${cx - 8},${topY + 12} C${cx - 78},${topY + 40} ${cx - 82},${bulbMid + 30} ${cx - 44},${bulbMid + 70} L${cx - 7},${base} L${cx - 7},${base + 28} L${cx + 7},${base + 28} L${cx + 7},${base} L${cx + 44},${bulbMid + 70} C${cx + 82},${bulbMid + 30} ${cx + 78},${topY + 40} ${cx + 8},${topY + 12} Z`;
  const interfaceY = base - hLower;
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, 0) && (
        <g>
          <Stand p={p} x={cx + 130} yTop={110} baseW={190} baseSide={-1} />
          <Clamp p={p} xRod={cx + 130} xGrip={cx + 56} y={bulbMid + 54} />
          <ellipse cx={cx} cy={bulbMid + 56} rx="62" ry="7" fill="none" stroke="#4b5366" strokeWidth="4" />
          <clipPath id={`${p}-sf`}><path d={funnelPath} /></clipPath>
          <g clipPath={`url(#${p}-sf)`}>
            {liquidsShown && hLower > 0.5 && <rect x={cx - 100} y={base - hLower} width="200" height={hLower + 30} fill={lowerCol} opacity="0.78" />}
            {liquidsShown && hUpper > 0.5 && <rect x={cx - 100} y={base - hLower - hUpper} width="200" height={hUpper} fill={upperCol} opacity="0.78" />}
            {liquidsShown && hLower > 0.5 && hUpper > 0.5 && <rect x={cx - 100} y={base - hLower - 1.5} width="200" height="3" fill="#fff" opacity="0.7" />}
          </g>
          <path d={funnelPath} fill="none" stroke="var(--ms-glass-stroke)" strokeWidth="2.4" strokeLinejoin="round" />
          <path d={funnelPath} fill={`url(#${p}-glass)`} />
          <path d={`M${cx - 46},${topY + 54} C${cx - 62},${topY + 90} ${cx - 62},${bulbMid + 10} ${cx - 44},${bulbMid + 36}`} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
          <rect x={cx - 24} y={topY - 4} width="48" height="18" rx="5" fill="#f4f8ff" fillOpacity="0.85" stroke="var(--ms-glass-stroke)" strokeWidth="2" />
          {/* stopcock: horizontal handle when closed, vertical when open */}
          <g transform={`translate(${cx} ${base + 8}) rotate(${tapOpen ? 0 : 90})`}><rect x="-5" y="-4" width="10" height="9" fill="#555e72" /><rect x="-30" y="-3" width="30" height="6" rx="3" fill="#d9363f" stroke="#7f1d22" /></g>
          {stage === "run" && view.two && liquidsShown && hLower > 4 && hUpper > 4 && <g aria-hidden="true"><line x1={cx + 70} x2={cx + 100} y1={interfaceY} y2={interfaceY} stroke="#1d2640" strokeWidth="1.6" /><text x={cx + 102} y={interfaceY + 4} className="ms-svg-label">boundary</text></g>}
          {show(placed, 3) ? <g transform={`translate(${cx + 34} ${topY - 30}) rotate(24)`}><path d="M-12,0 L12,0 L9,20 L-9,20 Z" fill="#7a6a58" stroke="#4a3d30" /></g> : <g><path d={`M${cx - 12},${topY - 14} L${cx + 12},${topY - 14} L${cx + 9},${topY + 6} L${cx - 9},${topY + 6} Z`} fill="#7a6a58" stroke="#4a3d30" /></g>}
        </g>
      )}
      {show(placed, 1) && <Beaker p={p} x={cx - 56} y={base + 40} w={112} h={VB.bench - base - 40} level={beakerLevel / 0.7 * 0.7} liquid={lowerCol} liquidOpacity={0.78} clip="sb" label={null}>
        {view.drained > view.lowerG + 0.1 && <rect x={cx - 56} y={VB.bench - 12 - clamp((view.drained - view.lowerG) / total, 0, 1) * 90} width="112" height="90" fill={upperCol} opacity="0.6" />}
      </Beaker>}
      {tapOpen && drained < total && <Stream x1={cx} y1={base + 28} x2={cx} y2={VB.bench - 12 - beakerLevel * 80} colour={drained <= view.lowerG ? lowerCol : upperCol} w={4} />}
      {Slot({ placed, stage, i: 0, x: cx, y: 210, w: 170, h: 250 })}
      {Slot({ placed, stage, i: 1, x: cx, y: 395, w: 140, h: 80 })}
      {Slot({ placed, stage, i: 2, x: cx, y: 200, w: 150, h: 200 })}
      {Slot({ placed, stage, i: 3, x: cx + 4, y: topY - 4, w: 70, h: 50 })}
    </Root>
  );
}

// ---------------------------------------------------------------------------------------------------------------- decanting
export function DecantScene({ placed, stage, view, ctl, sample, label }) {
  const p = useScenePrefix();
  const lq = liquidColour(sample); const sc = solidColour(sample) ?? "#d8b574";
  const settle = view.settle ?? 0; const poured = view.pouredFrac ?? 0; const tilt = view.tilt ?? 0;
  const mode = view.mode; const turb = mode === "sediment" ? (1 - settle) * 0.9 : 0;
  const lvl = 0.82 - 0.7 * clamp(poured, 0, 1) * (mode === "sediment" ? 0.92 : 0.55);
  const sed = mode === "sediment" ? sc : null;
  // the beaker rests on the bench and tips about its bottom right corner; the lip follows
  const piv = [280, 430]; const ang = (tilt * 30 * Math.PI) / 180;
  const lip = [piv[0] + 230 * Math.sin(ang), piv[1] - 230 * Math.cos(ang)];
  const rcx = 432;
  return (
    <Root p={p} label={label} sample={sample}>
      <Shadow p={p} cx={228} w={150} />
      <Beaker p={p} x={176} y={200} w={104} h={230} level={lvl} liquid={lq.colour} liquidOpacity={lq.opacity} turbid={turb} tilt={tilt * 30} pivot={piv} clip="dc1"
        solids={<>{sed && <Grains x={180} yb={426} w={96} h={30 * (1 - 0.1 * poured)} colour={sed} n={70} seed={9} />}{mode === "sediment" && settle < 0.95 && Array.from({ length: 22 }, (_, i) => <circle key={i} className="ms-fall" style={{ animationDelay: `${(i * 0.17) % 2}s` }} cx={186 + ((i * 37) % 84)} cy={230 + ((i * 53) % 150)} r="2.6" fill={sed} />)}{mode === "layers" && <rect x={176} y={430 - 0.4 * 215 - 8} width="104" height="3" fill="#fff" opacity="0.6" />}</>} label="mixture" />
      {show(placed, 2) && <line x1={lip[0] - 22} y1={lip[1] + 2} x2={lip[0] + 34} y2={lip[1] + 22} stroke="#dde7f6" strokeWidth="5" strokeLinecap="round" />}
      {show(placed, 1) && <Beaker p={p} x={rcx - 52} y={330} w={104} h={100} level={clamp(poured, 0, 1) * 0.8} liquid={lq.colour} liquidOpacity={lq.opacity} clip="dc2" label="receiving beaker" turbid={view.carry > 0.3 ? 0.4 : 0} />}
      {tilt > 0.5 && poured < 1 && <Stream x1={lip[0] + 8} y1={lip[1] + 14} x2={rcx} y2={402 - clamp(poured, 0, 1) * 66} colour={lq.colour} w={4} />}
      {Slot({ placed, stage, i: 0, x: 228, y: 320, w: 134, h: 250 })}
      {Slot({ placed, stage, i: 1, x: rcx, y: 384, w: 124, h: 116 })}
      {Slot({ placed, stage, i: 2, x: 300, y: 214, w: 100, h: 56 })}
    </Root>
  );
}

// -------------------------------------------------------------------------------------------------------------- sublimation
export function SublimationScene({ placed, stage, view, ctl, sample, label }) {
  const p = useScenePrefix();
  const cx = 320; const gaugeY = 316; const dishY = gaugeY - 36;
  const flame = stage === "run" ? ctl.heat ?? 0.1 : 0;
  const iod = gramsOf(sample, "iodine"); const sandCol = solidColour(sample) ?? "#d8b574";
  const total = Math.max(0.1, iod);
  const subl = clamp((view.sublimed ?? 0) / total, 0, 1);
  const leftIod = clamp(1 - subl - (view.escaped ?? 0) / total, 0, 1);
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, 0) && <HeatMat p={p} cx={cx} />}
      {show(placed, 0) && <Bunsen p={p} cx={cx} base={VB.bench - 6} heat={flame} on={flame > 0.001 || stage !== "run"} />}
      {show(placed, 0) && <Tripod p={p} cx={cx} y={gaugeY} w={170} />}
      {show(placed, 1) && <Basin p={p} cx={cx} y={dishY} w={140} h={36} level={0} clip="sbd" solid={sandCol} solidFrac={0.9}>{null}</Basin>}
      {show(placed, 1) && iod > 0 && <g aria-hidden="true"><path d={`M${cx - 36},${dishY + 30} Q${cx - 6},${dishY + 6 + (1 - leftIod) * 18} ${cx + 30},${dishY + 30} Z`} fill={sandCol} opacity="0" />{leftIod > 0.03 && Array.from({ length: Math.round(2 + leftIod * 12) }, (_, i) => <rect key={i} x={cx - 40 + ((i * 29) % 78)} y={dishY + 20 - ((i * 7) % 10)} width="4.5" height="3.6" rx="1" fill="#3b2352" transform={`rotate(${i * 31} ${cx} ${dishY})`} />)}</g>}
      {show(placed, 2) && (
        <g>
          <path d={`M${cx - 86},${dishY - 4} L${cx - 10},${dishY - 78} L${cx - 10},${dishY - 128} L${cx + 10},${dishY - 128} L${cx + 10},${dishY - 78} L${cx + 86},${dishY - 4}`} fill="#f4f8ff" fillOpacity="0.28" stroke="var(--ms-glass-stroke)" strokeWidth="2.2" strokeLinejoin="round" />
          <rect x={cx - 11} y={dishY - 134} width="22" height="14" rx="6" fill="#fff" stroke="#c9c9d3" strokeWidth="1.4" />
          {stage === "run" && view.vapour > 0 && <g className="ms-purple" aria-hidden="true">{Array.from({ length: 4 }, (_, i) => <path key={i} className="ms-wisp" style={{ animationDelay: `${i * 0.5}s` }} d={`M${cx - 46 + i * 30},${dishY - 8} q10,-16 0,-30 q-10,-14 0,-30`} fill="none" stroke="#7a3fb0" strokeWidth="5" strokeLinecap="round" opacity="0.55" />)}</g>}
          {subl > 0.01 && Array.from({ length: Math.round(subl * 26) }, (_, i) => { const t = (i % 13) / 13; const side = i % 2 ? 1 : -1; const y = dishY - 12 - t * 62; const x = cx + side * (lerp(78, 12, t)) * 0.92; return <rect key={i} x={x - 2.4} y={y} width="5" height="3.6" rx="1" fill="#3b2352" transform={`rotate(${i * 25} ${x} ${y})`} />; })}
        </g>
      )}
      {show(placed, 3) && <g aria-hidden="true"><path d={`M${cx - 80},${dishY - 70} Q${cx - 60},${dishY - 110} ${cx - 14},${dishY - 98} L${cx - 10},${dishY - 78} Z`} fill="#8fc0ea" opacity="0.8" stroke="#3c78b5" strokeWidth="1.4" /><path d={`M${cx + 80},${dishY - 70} Q${cx + 60},${dishY - 110} ${cx + 14},${dishY - 98} L${cx + 10},${dishY - 78} Z`} fill="#8fc0ea" opacity="0.8" stroke="#3c78b5" strokeWidth="1.4" /><text x={cx} y={dishY - 150} textAnchor="middle" className="ms-svg-label">cold damp cloth</text></g>}
      {view.melted && stage === "run" && <text x={cx} y={dishY - 166} textAnchor="middle" className="ms-svg-warn">too hot: the iodine is melting</text>}
      {Slot({ placed, stage, i: 0, x: cx, y: 392, w: 150, h: 70 })}
      {Slot({ placed, stage, i: 1, x: cx, y: dishY + 20, w: 160, h: 56 })}
      {Slot({ placed, stage, i: 2, x: cx, y: dishY - 70, w: 190, h: 130 })}
      {Slot({ placed, stage, i: 3, x: cx, y: dishY - 106, w: 220, h: 50 })}
    </Root>
  );
}

// ------------------------------------------------------------------------------------------------------------------ dissolve
export function DissolveScene({ placed, stage, view, ctl, sample, label }) {
  const p = useScenePrefix();
  const lq = liquidColour({ parts: [{ sub: "water", form: "liquid", g: 1 }, ...sample.parts] }); const prog = view.progress ?? 0;
  const sol = sample.parts.filter((q) => q.form === "solid");
  const dissolvable = sol.filter((q) => SUBSTANCES[q.sub].solubility); const insol = sol.filter((q) => !SUBSTANCES[q.sub].solubility);
  const cx = 320; const stirOn = stage === "run" && view.stirring;
  return (
    <Root p={p} label={label} sample={sample}>
      {show(placed, 0) && (
        <Beaker p={p} x={cx - 90} y={190} w={180} h={240} level={show(placed, 1) ? 0.62 : 0} liquid={lq.colour} liquidOpacity={clamp(lq.opacity - prog * 0.0, 0.5, 0.8)} clip="ds"
          solids={<>
            {insol.length > 0 && show(placed, 1) && <Grains x={cx - 78} yb={424} w={90} h={18} colour={SUBSTANCES[insol[0].sub].colour} n={40} seed={6} />}
            {dissolvable.length > 0 && show(placed, 1) && <Grains x={cx - 8} yb={424} w={86} h={16 * (1 - prog)} colour={SUBSTANCES[dissolvable[0].sub].colour} n={34 * (1 - prog) + 4} seed={8} />}
          </>} />
      )}
      {show(placed, 2) && <g style={{ transformOrigin: `${cx + 56}px 230px` }} className={stirOn ? "ms-stir" : undefined}><line x1={cx + 56} y1="120" x2={cx + 10} y2="400" stroke="#dde7f6" strokeWidth="6" strokeLinecap="round" /><line x1={cx + 56} y1="120" x2={cx + 10} y2="400" stroke="#8aa0c4" strokeWidth="1.2" opacity="0.7" /></g>}
      {show(placed, 1) && <text x={cx} y={176} textAnchor="middle" className="ms-svg-label">{prog > 0.05 ? `${Math.round(prog * 100)} % dissolved` : "water added"}</text>}
      {Slot({ placed, stage, i: 0, x: cx, y: 320, w: 220, h: 260 })}
      {Slot({ placed, stage, i: 1, x: cx, y: 300, w: 170, h: 120 })}
      {Slot({ placed, stage, i: 2, x: cx + 34, y: 250, w: 90, h: 300 })}
    </Root>
  );
}

export const SCENES = {
  dissolve: DissolveScene, decanting: DecantScene, filtration: FiltrationScene, evaporation: BasinScene, crystallisation: BasinScene,
  "simple-distillation": DistillationScene, "fractional-distillation": DistillationScene, chromatography: ChromatographyScene,
  magnetic: MagneticScene, "separating-funnel": FunnelScene, sublimation: SublimationScene,
};
