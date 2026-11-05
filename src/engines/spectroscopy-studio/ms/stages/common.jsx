import StepFrame from "../../components/StepFrame.jsx";
import { MS_STAGES } from "../state/msState.js";
import Ribbon from "../components/Ribbon.jsx";

export { MS_STAGES };
/** The stage frame of the MS tab: StepFrame with the 13 stage titles. `ribbon` = part of the instrument to emphasise at the top of the animation area. */
export default function MsFrame({ stage, viz, strip, teacher, children, ribbon, analyser, vizClass = "" }) {
  const body = ribbon ? (<div className="ms-vizcol"><Ribbon active={ribbon} analyser={analyser} /><div className="ms-vizmain">{viz}</div></div>) : viz;
  return <StepFrame step={stage} steps={MS_STAGES} viz={body} strip={strip} teacher={teacher} vizClass={`ss-viz--ms ${vizClass}`}>{children}</StepFrame>;
}
export const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
