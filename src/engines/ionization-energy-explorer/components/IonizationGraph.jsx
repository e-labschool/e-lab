import { useState } from "react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";

const W = 720;
const H = 260;
const PAD_L = 56;
const PAD_B = 34;
const PAD_T = 16;
const PAD_R = 16;

/** Full-width successive-ionization-energy graph. `values` is the
 * COMPLETE, never-truncated dataset for the current element (same array
 * the data table shows). `currentStep` (1-based) is highlighted in both
 * modes. Y-axis uses a log scale (labelled as such) since successive IEs
 * for a single element span orders of magnitude -- values shown in
 * tooltips/labels are always the real kJ/mol number, never a percentage. */
export default function IonizationGraph({ element, values, currentStep, removalOrder }) {
  const [mode, setMode] = useState("bar");
  const [hovered, setHovered] = useState(null);
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = values.length;

  const logValues = values.map((v) => Math.log10(v));
  const minLog = Math.min(...logValues);
  const maxLog = Math.max(...logValues);
  const yFor = (v) => H - PAD_B - ((Math.log10(v) - minLog) / (maxLog - minLog || 1)) * plotH;
  const xFor = (i) => PAD_L + ((i + 0.5) / n) * plotW;
  const barW = Math.max(4, (plotW / n) * 0.6);

  const yTicks = 5;
  const ticks = Array.from({ length: yTicks }, (_, i) => {
    const log = minLog + (i / (yTicks - 1)) * (maxLog - minLog || 1);
    return Math.round(10 ** log);
  });

  return (
    <div className="rounded-md border border-[#1c2740] bg-[#0a0f1e] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8fb4e0]">Successive Ionization Energy Graph &mdash; {element.name}</h3>
        <div className="flex overflow-hidden rounded-md border border-[#274063]">
          <button
            type="button"
            aria-label="Show bar graph"
            aria-pressed={mode === "bar"}
            onClick={() => setMode("bar")}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium ${mode === "bar" ? "bg-[#173257] text-[#eaf6ff]" : "text-[#7fa8d9]"}`}
          >
            <BarChart3 size={12} /> Bar Graph
          </button>
          <button
            type="button"
            aria-label="Show line graph"
            aria-pressed={mode === "line"}
            onClick={() => setMode("line")}
            className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium ${mode === "line" ? "bg-[#173257] text-[#eaf6ff]" : "text-[#7fa8d9]"}`}
          >
            <LineChartIcon size={12} /> Line Graph
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full text-[#7fa8d9]" role="img" aria-label={`${element.name} successive ionization energy ${mode} graph, log scale`}>
        {ticks.map((t, i) => {
          const y = yFor(t);
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#1c2740" strokeWidth="1" />
              <text x={PAD_L - 8} y={y + 3} fontSize="9" textAnchor="end" fill="#7fa8d9">{t.toLocaleString()}</text>
            </g>
          );
        })}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke="#3a5a86" strokeWidth="1.5" />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="#3a5a86" strokeWidth="1.5" />

        {mode === "bar" && values.map((v, i) => {
          const step = i + 1;
          const isCurrent = step === currentStep;
          const x = xFor(i) - barW / 2;
          const y = yFor(v);
          return (
            <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))} tabIndex={0} role="img" aria-label={`IE${step}: ${v.toLocaleString()} kJ per mol`}>
              <rect x={x} y={y} width={barW} height={H - PAD_B - y} fill={isCurrent ? "#5ad1ff" : "#2f6fb3"} opacity={hovered === i || isCurrent ? 1 : 0.75} rx="1.5" />
              <text x={xFor(i)} y={H - PAD_B + 12} fontSize="8.5" textAnchor="middle" fill="#7fa8d9">{step}</text>
            </g>
          );
        })}

        {mode === "line" && (
          <>
            <path d={values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ")} fill="none" stroke="#5ad1ff" strokeWidth="1.75" />
            {values.map((v, i) => {
              const step = i + 1;
              const isCurrent = step === currentStep;
              return (
                <g key={i} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered((h) => (h === i ? null : h))} tabIndex={0} role="img" aria-label={`IE${step}: ${v.toLocaleString()} kJ per mol`}>
                  <circle cx={xFor(i)} cy={yFor(v)} r={isCurrent ? 4.5 : 3} fill={isCurrent ? "#ffd166" : "#5ad1ff"} />
                  <text x={xFor(i)} y={H - PAD_B + 12} fontSize="8.5" textAnchor="middle" fill="#7fa8d9">{step}</text>
                </g>
              );
            })}
          </>
        )}

        {hovered != null && (
          <g transform={`translate(${Math.min(Math.max(xFor(hovered), PAD_L + 60), W - PAD_R - 60)}, ${Math.max(yFor(values[hovered]) - 34, PAD_T + 12)})`}>
            <rect x={-58} y={-14} width={116} height={hovered != null && removalOrder?.[hovered] ? 40 : 26} rx="4" fill="#0d1a33" stroke="#3a5a86" />
            <text x={0} y={0} fontSize="9.5" textAnchor="middle" fill="#eaf6ff" fontWeight="600">IE{hovered + 1} &middot; {values[hovered].toLocaleString()} kJ mol&#8315;&#185;</text>
            {removalOrder?.[hovered] && <text x={0} y={13} fontSize="8.5" textAnchor="middle" fill="#7fa8d9">electron removed from {removalOrder[hovered]}</text>}
          </g>
        )}

        <text x={(PAD_L + W - PAD_R) / 2} y={H - 4} fontSize="9.5" textAnchor="middle" fill="#7fa8d9">Ionization step</text>
        <text x={14} y={PAD_T + plotH / 2} fontSize="9.5" textAnchor="middle" fill="#7fa8d9" transform={`rotate(-90 14 ${PAD_T + plotH / 2})`}>IE / kJ mol&#8315;&#185; (log scale)</text>
      </svg>
    </div>
  );
}
