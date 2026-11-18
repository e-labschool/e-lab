import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import StageFrame from "../StageFrame.jsx";
import { Choice, Pick, Caption } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import { BellJar } from "../../scene/Equipment.jsx";
import { STAGE4_IDS, STAGE4_AMOUNTS, optionLabel, stage4Info, compareTrio, labelOf, formulaOf, MOLECULES_PER_MOL } from "../../engine/labConfig.js";
import { molarMass } from "../../engine/substances.js";
import { gasLabState, GAS_LIMITS, idealValidity, RTP_CONVENTION } from "../../engine/gasLab.js";
import { parseNumberInput, toQuanta, fmtFixed, fmtMol } from "../../engine/numeric.js";
import { celsiusToKelvin } from "../../engine/gas.js";
import { Fallback2D } from "../parts.jsx";
import { getSubstance } from "../../engine/substances.js";

const speedOf = (id) => 0.55 + 0.45 * Math.sqrt(2.016 / molarMass(id)); // lighter molecules move faster (qualitative; v ~ 1/sqrt(M))

export default function Stage4({ shell }) {
  const [gas, setGas] = useState("O2"); const [n, setN] = useState(1); const [view, setView] = useState("three");
  const [tC, setTC] = useState("25"); const [pK, setPK] = useState("101.325");
  const rtp = useMemo(() => stage4Info(gas, n), [gas, n]);
  const adv = useMemo(() => {
    const t = parseNumberInput(tC, { allowNegative: true, min: -273.15, label: "Temperature" }); const p = parseNumberInput(pK, { label: "Pressure", allowZero: false });
    if (!t.ok) return { error: t.error }; if (!p.ok) return { error: p.error };
    const tK = celsiusToKelvin(t.value); if (tK < GAS_LIMITS.tMinK || tK > GAS_LIMITS.tMaxK) return { error: `Use ${GAS_LIMITS.tMinK - 273} to ${GAS_LIMITS.tMaxK - 273} °C in this lab.` };
    if (p.value < GAS_LIMITS.pMinKPa || p.value > GAS_LIMITS.pMaxKPa) return { error: `Use ${GAS_LIMITS.pMinKPa} to ${GAS_LIMITS.pMaxKPa} kPa in this lab.` };
    const v = idealValidity(gas, tK, p.value * 1000); if (!v.valid) return { error: v.message };
    return { state: gasLabState({ model: "ideal", nQ: toQuanta(n), gasId: gas, tK, pPa: p.value * 1000 }) };
  }, [tC, pK, gas, n]);
  const gases = view === "three" ? compareTrio(gas) : [gas];
  const dec = (v) => fmtFixed(v, 1);
  const per = gases.length; const spacing = 5.2;
  const jarH = 0.38 + 2.6 * (rtp.volumeDm3 / 24) + 1.2 + 1.6;
  const bounds = { w: Math.max(6.6, per * spacing + 0.4), h: jarH + 0.6, cx: 0, cy: jarH / 2 - 0.2, depth: 1 };
  const fb = gases.map(() => ({ substanceId: gas, fraction: Math.min(1, n), formula: labelOf(gas), text: `${fmtMol(n)} mol, ${dec(rtp.volumeDm3)} dm³` }));
  const line = view === "three" ? `${fmtMol(n)} mol of each gas = ${dec(rtp.volumeDm3)} dm³ at RTP: the volume does not depend on which gas it is.` : rtp.line;
  return (
    <StageFrame stage={4} title="Gas Volume"
      controls={<>
        <Pick label="Gas" value={gas} options={STAGE4_IDS.map((v) => ({ value: v, label: optionLabel(v) }))} onChange={setGas} testId="ml-substance" />
        <Choice label="Amount" value={n} options={STAGE4_AMOUNTS} onChange={setN} format={(v) => `${v.toFixed(2)} mol`} testId="ml-amount" />
        <Choice label="View" value={view} options={["three", "one"]} onChange={setView} format={(v) => (v === "three" ? "Compare 3 gases" : "One gas")} testId="ml-view" />
        <span className="ml-chipinfo" data-testid="ml-conditions">RTP: 25 °C (298 K) | 1 atm (101.3 kPa)</span>
      </>}
      caption={<Caption line={line} testId="ml-line" more={<>
        <p>At the same temperature and pressure, equal amounts of an ideal gas occupy equal volumes. The approximate value 24 dm³ mol⁻¹ applies at the RTP convention used here (about 25 °C and 1 atm); it is not universal.</p>
        <p>The molecules drawn are representative ({MOLECULES_PER_MOL} per mole for every gas, so the picture's density is the same for all gases); lighter molecules are drawn moving faster.</p>
        <details data-testid="ml-advanced"><summary>Advanced: PV = nRT</summary>
          <div className="ml-adv"><label htmlFor="ml-t">Temperature (°C)</label><input id="ml-t" className="ml-input" inputMode="decimal" value={tC} onChange={(e) => setTC(e.target.value)} data-testid="ml-temp" />
            <label htmlFor="ml-p">Pressure (kPa)</label><input id="ml-p" className="ml-input" inputMode="decimal" value={pK} onChange={(e) => setPK(e.target.value)} data-testid="ml-press" /></div>
          <p data-testid="ml-adv-out" role="status">{adv.error ?? `V = nRT / P = ${fmtFixed(adv.state.volumeDm3, 2)} dm³ for ${fmtMol(n)} mol (Vm = ${fmtFixed(adv.state.vm, 2)} dm³ mol⁻¹ at ${fmtFixed(adv.state.tK, 1)} K, ${fmtFixed(adv.state.pKPa, 1)} kPa). The 24 dm³ mol⁻¹ convention gives ${dec(rtp.volumeDm3)} dm³.`}</p>
        </details></>} />}
      aside={<div className="ml-bigpill" data-testid="ml-bigpill">{view === "three" ? `${fmtMol(n)} mol = ${dec(rtp.volumeDm3)} dm³ at RTP` : "1 mol = 24 dm³ at RTP"}</div>}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${line} Glass gas jars.`}
        fallback="WebGL is not available, so a 2D picture is shown." noGL={<Fallback2D items={fb} title={line} note={`Each jar holds ${fmtMol(n)} mol = ${dec(rtp.volumeDm3)} dm³.`} />}>
        {gases.map((g, i) => (
          <BellJar key={g} gasId={g} volumeDm3={rtp.volumeDm3} molecules={Math.round(MOLECULES_PER_MOL * n)} label={`${formulaOf(g)}(g)`} display={`${dec(rtp.volumeDm3)} dm³`} highlight={view === "three" && g === gas}
            dark={shell.dark} reduced={shell.reduced} position={[(i - (per - 1) / 2) * spacing, 0, 0]} speedFactor={speedOf(g)} />
        ))}
        <Html position={[0, -0.1, 1.2]} center style={{ pointerEvents: "none" }}><span /></Html>
      </LabCanvas>
    </StageFrame>
  );
}
export { RTP_CONVENTION, getSubstance };
