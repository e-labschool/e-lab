import { Zap } from "lucide-react";
import MsFrame from "./common.jsx";
import { Equation, Scene } from "../components/ui.jsx";
import IonisationScene from "../components/IonisationScene.jsx";
import { Badge } from "../../components/ui.jsx";
import { usePhase, useTransition } from "../../components/useAnim.js";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { IONISATION } from "../data/fragmentation.js";

/** Stage 3: electron ionisation. "Ionize" fires an energetic electron at a methane molecule: one electron is removed and a radical cation forms. */
export default function Stage3Ionise() {
  const a = useMsActions(); const fired = useMs((s) => s.s3.fired);
  const p = useTransition({ id: "ms-s3-ion", target: fired ? 1 : 0, seconds: 8, from: 0 });
  const phase = usePhase();
  const viz = (
    <div className="ms-boxfill" data-testid="ionise-view" data-fired={fired ? "1" : "0"} data-progress={p.toFixed(2)}>
      <Scene>{({ w, h }) => <IonisationScene w={w} h={h} p={p} phase={phase} fired={fired} />}</Scene>
      <Equation testId="ion-equation" className="ms-eq--over" parts={[{ t: "CH₄ + e⁻", on: !fired || p < 0.5 }, { t: " → " }, { t: "CH₄⁺• + 2e⁻", on: fired && p >= 0.5 ? true : false }]} />
      <Badge className="ss-badge--tr" testId="ion-label"><b>Illustrative model.</b> Orange = positive ion · blue = electron</Badge>
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <button type="button" className="sim-btn sim-btn--primary ss-bigbtn" onClick={() => a.patch("s3", { fired: true })} disabled={fired} data-testid="ionize"><Zap size={18} aria-hidden="true" /> Ionize</button>
      <span className="ss-stripnote" data-testid="ionise-status">{fired ? "Use Replay (below) to watch it again." : "Press Ionize to fire the electron."}</span>
    </div>
  );
  const teacher = (
    <>
      <p><b>Energies.</b> The electrons are usually accelerated to 70 eV. The first ionisation energy of methane is about {IONISATION.ionisationEnergyEv} eV (typical value), so the electron needs only a part of its energy; the rest of the energy that the molecule takes up as internal energy is what makes the molecular ion fragment (next stage).</p>
      <p><b>No proton attachment.</b> {IONISATION.note}</p>
      <p><b>Notation.</b> The superscript + is the charge; the dot • marks the unpaired electron left behind, so CH₄⁺• is a <i>radical cation</i>. The mass of the ion is that of the molecule less one electron (0.00055 u), so m/z stays at 16.</p>
      <p><b>Species names.</b> The neutral molecule is M; the molecular ion is M⁺•. The incoming electron is slowed (it gives up energy) and the removed electron is one of the molecule's own.</p>
    </>
  );
  return (
    <MsFrame stage={3} viz={viz} strip={strip} teacher={teacher} ribbon="ionisation" vizClass="ss-viz--ms-inst">
      <p data-testid="s3-text">A beam of <b>fast electrons</b> passes through the gas. When an electron passes close to a methane molecule it <b>knocks one electron out</b>, leaving a <b>positive molecular ion</b> with one unpaired electron: a <b>radical cation</b>.</p>
      <Equation testId="ion-equation-panel" className="ms-eq--block" parts={[{ t: "CH₄ + e⁻ → CH₄⁺• + 2e⁻" }]} />
      <p className="ss-note">Electron ionisation can also make the ion fragment: next stage.</p>
    </MsFrame>
  );
}
