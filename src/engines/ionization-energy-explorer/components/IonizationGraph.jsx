import { useState } from "react";
import { BarChart3, LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import { useSimulationPresentation } from "../../../components/interactive-shell/SimulationPresentation.js";
import { FIRST_IE_TREND } from "../lib/ionizationData.js";

const W = 720;
const H = 260;
const PAD_L = 62;
const PAD_B = 36;
const PAD_T = 16;
const PAD_R = 16;
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷" };
const sup = (n) => String(n).split("").map((d) => SUP[d] ?? d).join("");

// What a student should be able to say about each dip in the first-IE trend (S1.3.8 HL).
const DIPS = {
  5: "B < Be: the 2p electron is higher in energy than a 2s electron and is shielded by the 2s electrons.",
  8: "O < N: in 2p⁴ two electrons share one orbital and repel each other, so one is removed more easily than from 2p³.",
  13: "Al < Mg: the 3p electron is higher in energy than a 3s electron and shielded by the 3s electrons.",
  16: "S < P: in 3p⁴ two electrons share one orbital and repel each other, as with O and N.",
};

/** Two views. (1) Successive IEs of the chosen element on a LOG axis whose baseline is a whole decade below the smallest value,
 * so the first bar is visible; ticks are decades (10^3, 10^4, ...); the value of the current/hovered bar is printed. Only revealed
 * steps are drawn unless `showAll`. (2) First IE against atomic number H-Kr (S1.3.8): clickable points, the B/Al and O/S dips annotated. */
export default function IonizationGraph({ element, values, currentStep, removalOrder, revealedUpTo = Infinity, showAll = false, onSelectZ, selectableZ = () => false }) {
  const { isViewport } = useSimulationPresentation();
  const [view, setView] = useState("successive");
  const [mode, setMode] = useState("bar");
  const [hovered, setHovered] = useState(null);
  const [trendSel, setTrendSel] = useState(null);

  const tabBtn = (id, label, Icon, active, onClick) => (
    <button key={id} type="button" aria-pressed={active} onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium ${active ? "bg-[#2f67c2] text-white" : "text-[#b4d0f3]"}`}><Icon size={12} aria-hidden="true" /> {label}</button>
  );

  return (
    <div className={isViewport ? "sim-surface-dark flex h-full min-h-0 flex-col rounded-md border border-[#1c2740] bg-[#0a0f1e] p-2.5" : "sim-surface-dark rounded-md border border-[#1c2740] bg-[#0a0f1e] p-4"}>
      <div className={isViewport ? "mb-1.5 flex shrink-0 flex-wrap items-center justify-between gap-2" : "mb-3 flex flex-wrap items-center justify-between gap-2"}>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#a9c5ea]">{view === "successive" ? `Successive Ionization Energies — ${element.name}` : "First Ionization Energy, H to Kr"}</h3>
        <div className="flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-md border border-[var(--sim-btn-border)]" role="group" aria-label="Graph view">
            {tabBtn("s", "Successive", BarChart3, view === "successive", () => setView("successive"))}
            {tabBtn("t", "First IE trend", TrendingUp, view === "trend", () => setView("trend"))}
          </div>
          {view === "successive" && (
            <div className="flex overflow-hidden rounded-md border border-[var(--sim-btn-border)]" role="group" aria-label="Chart type">
              {tabBtn("b", "Bar", BarChart3, mode === "bar", () => setMode("bar"))}
              {tabBtn("l", "Line", LineChartIcon, mode === "line", () => setMode("line"))}
            </div>
          )}
        </div>
      </div>

      {view === "successive" ? <Successive {...{ element, values, currentStep, removalOrder, revealedUpTo, showAll, mode, hovered, setHovered }} /> : (
        <Trend {...{ trendSel, setTrendSel, currentZ: element.atomicNumber, onSelectZ, selectableZ, isViewport }} />
      )}
    </div>
  );
}

function Successive({ element, values, currentStep, removalOrder, revealedUpTo, showAll, mode, hovered, setHovered }) {
  const { isViewport } = useSimulationPresentation();
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const visible = showAll ? values.length : Math.min(values.length, revealedUpTo);
  const n = values.length;
  const shown = values.slice(0, visible);
  // baseline: a whole decade BELOW the smallest value; top: a decade boundary above the largest of ALL values (the axis does not change as steps are revealed)
  const lo = Math.floor(Math.log10(Math.min(...values))) - 0; const loDecade = Math.max(2, lo);
  const hiDecade = Math.ceil(Math.log10(Math.max(...values)));
  const yFor = (v) => H - PAD_B - ((Math.log10(v) - (loDecade - 0.0)) / (hiDecade - loDecade || 1)) * plotH;
  const xFor = (i) => PAD_L + ((i + 0.5) / n) * plotW;
  const barW = Math.max(5, (plotW / n) * 0.6);
  const decades = []; for (let d = loDecade; d <= hiDecade; d += 1) decades.push(d);
  const active = hovered ?? (currentStep - 1 < visible ? currentStep - 1 : visible - 1);

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className={isViewport ? "w-full min-h-0 flex-1 text-[#9db8dc]" : "w-full text-[#9db8dc]"} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${element.name} successive ionization energies, bar or line graph on a log axis; ${visible} of ${n} values shown`} data-testid="ie-graph-successive">
        {decades.map((d) => (
          <g key={d}>
            <line x1={PAD_L} y1={yFor(10 ** d)} x2={W - PAD_R} y2={yFor(10 ** d)} stroke="#2a3b5c" strokeWidth="1" />
            <text x={PAD_L - 8} y={yFor(10 ** d) + 4} fontSize="12" textAnchor="end" fill="#b4d0f3">10{sup(d)}</text>
          </g>
        ))}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#4d73a6" strokeWidth="1.5" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#4d73a6" strokeWidth="1.5" />
        {mode === "bar" && shown.map((v, i) => {
          const step = i + 1; const isCurrent = step === currentStep; const x = xFor(i) - barW / 2; const y = yFor(v);
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} tabIndex={0} role="img" aria-label={`IE${step}: ${v.toLocaleString()} kilojoules per mole`}>
              <rect x={x} y={y} width={barW} height={Math.max(1, H - PAD_B - y)} fill={isCurrent ? "#5ad1ff" : "#3d82cc"} opacity={hovered === i || isCurrent ? 1 : 0.85} rx="1.5" />
            </g>
          );
        })}
        {mode === "line" && shown.length > 0 && (
          <>
            <path d={shown.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ")} fill="none" stroke="#5ad1ff" strokeWidth="1.75" />
            {shown.map((v, i) => (
              <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} tabIndex={0} role="img" aria-label={`IE${i + 1}: ${v.toLocaleString()} kilojoules per mole`}>
                <circle cx={xFor(i)} cy={yFor(v)} r={i + 1 === currentStep ? 5 : 3.5} fill={i + 1 === currentStep ? "#ffd166" : "#5ad1ff"} />
              </g>
            ))}
          </>
        )}
        {values.map((_, i) => <text key={i} x={xFor(i)} y={H - PAD_B + 14} fontSize="11" textAnchor="middle" fill="#b4d0f3">{i + 1}</text>)}
        {active != null && active >= 0 && shown[active] != null && (
          <g transform={`translate(${Math.min(Math.max(xFor(active), PAD_L + 70), W - PAD_R - 70)}, ${Math.max(yFor(shown[active]) - 30, PAD_T + 14)})`} pointerEvents="none">
            <rect x={-68} y={-14} width={136} height={removalOrder?.[active] ? 42 : 26} rx="4" fill="#0d1a33" stroke="#4d73a6" />
            <text x={0} y={0} fontSize="12" textAnchor="middle" fill="#eaf6ff" fontWeight="600">IE{active + 1} · {shown[active].toLocaleString()} kJ mol⁻¹</text>
            {removalOrder?.[active] && <text x={0} y={16} fontSize="11" textAnchor="middle" fill="#b4d0f3">electron removed from {removalOrder[active]}</text>}
          </g>
        )}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 3} fontSize="12" textAnchor="middle" fill="#b4d0f3">Ionization step (number of electrons removed)</text>
        <text x={15} y={PAD_T + plotH / 2} fontSize="12" textAnchor="middle" fill="#b4d0f3" transform={`rotate(-90 15 ${PAD_T + plotH / 2})`}>IE / kJ mol⁻¹ (log scale)</text>
      </svg>
      {!showAll && visible < n && <p className="shrink-0 text-[11px] text-[#9db8dc]">Later steps appear as you predict and remove electrons (or tick “Show all values”).</p>}
    </>
  );
}

function Trend({ trendSel, setTrendSel, currentZ, onSelectZ, selectableZ, isViewport }) {
  const plotW = W - PAD_L - PAD_R; const plotH = H - PAD_T - PAD_B;
  const max = 2500;
  const xFor = (z) => PAD_L + ((z - 0.5) / 36) * plotW;
  const yFor = (v) => H - PAD_B - (v / max) * plotH;
  const pts = FIRST_IE_TREND;
  const sel = trendSel ? pts[trendSel - 1] : pts[currentZ - 1];
  const dip = DIPS[sel.z];
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className={isViewport ? "w-full min-h-0 flex-1 text-[#9db8dc]" : "w-full text-[#9db8dc]"} preserveAspectRatio="xMidYMid meet" role="group" aria-label="First ionization energy against atomic number, hydrogen to krypton" data-testid="ie-graph-trend">
        {[0, 500, 1000, 1500, 2000, 2500].map((v) => (
          <g key={v}><line x1={PAD_L} y1={yFor(v)} x2={W - PAD_R} y2={yFor(v)} stroke="#2a3b5c" /><text x={PAD_L - 8} y={yFor(v) + 4} fontSize="12" textAnchor="end" fill="#b4d0f3">{v.toLocaleString()}</text></g>
        ))}
        {[2, 10, 18, 36].map((z) => <text key={z} x={xFor(z)} y={H - PAD_B + 14} fontSize="11" textAnchor="middle" fill="#b4d0f3">{pts[z - 1].symbol}</text>)}
        <path d={pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.z)} ${yFor(p.ie)}`).join(" ")} fill="none" stroke="#3d82cc" strokeWidth="1.25" opacity="0.7" />
        {pts.map((p) => {
          const isCur = p.z === currentZ; const isSel = sel.z === p.z; const isDip = !!DIPS[p.z]; const can = selectableZ(p.z);
          return (
            <g key={p.z} role="button" tabIndex={0} aria-label={`${p.symbol}, atomic number ${p.z}, first ionization energy ${p.ie} kilojoules per mole${isDip ? ", a dip in the trend" : ""}`}
              onClick={() => { setTrendSel(p.z); if (can) onSelectZ?.(p.z); }} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTrendSel(p.z); if (can) onSelectZ?.(p.z); } }} className="cursor-pointer outline-none focus-visible:[&>circle]:stroke-white">
              <circle cx={xFor(p.z)} cy={yFor(p.ie)} r={isSel || isCur ? 6 : isDip ? 5 : 3.5} fill={isCur ? "#ffd166" : isDip ? "#ff8a73" : "#5ad1ff"} stroke={isSel ? "#fff" : "none"} strokeWidth="1.5" />
            </g>
          );
        })}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 3} fontSize="12" textAnchor="middle" fill="#b4d0f3">Atomic number Z (H = 1 … Kr = 36)</text>
        <text x={15} y={PAD_T + plotH / 2} fontSize="12" textAnchor="middle" fill="#b4d0f3" transform={`rotate(-90 15 ${PAD_T + plotH / 2})`}>First IE / kJ mol⁻¹</text>
      </svg>
      <p className="shrink-0 text-[12px] text-[#d3e4fb]" data-testid="ie-trend-readout" aria-live="polite">
        <strong>{sel.symbol}</strong> (Z = {sel.z}): {sel.ie.toLocaleString()} kJ mol⁻¹. {dip ?? "Across a period the nuclear charge rises while shielding barely changes, so IE1 rises; down a group the outer electron is farther away and more shielded, so IE1 falls."}
        {!selectableZ(sel.z) && <span className="text-[#9db8dc]"> (Successive data are available for H–Ca.)</span>}
      </p>
    </>
  );
}
