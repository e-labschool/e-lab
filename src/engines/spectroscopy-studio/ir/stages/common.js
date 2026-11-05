import { IR_STAGES } from "../state/irState.js";
import { getModeCatalog } from "../physics/modeCatalog.js";

export { IR_STAGES };
/** vib prop for MolStage from a catalog entry (or a group-mode object with {disp, wn}) */
export const vibOf = (mode, key) => (mode ? { disp: mode.disp, wn: mode.wn, key: key ?? mode.id } : null);
export const modeOf = (molId, modeId) => { const c = getModeCatalog(molId); return c.modes.find((m) => m.id === modeId) ?? c.modes[0]; };
export const SPEED_NOTE = "The vibration is slowed down by the same factor (about 10¹⁴) for every mode, so the frequencies keep their true ratios.";
export const MOL_LABEL = { hcl: "HCl", h2o: "H₂O", co2: "CO₂", ch4: "CH₄", ethanol: "Ethanol", n2: "N₂" };
export const molOptions = (ids) => ids.map((id) => ({ id, label: MOL_LABEL[id] }));
