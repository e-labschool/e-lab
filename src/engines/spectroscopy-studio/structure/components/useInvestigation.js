import { COMPOUNDS } from "../data/compounds.js";
import { getLevel, sampleId } from "../model/levels.js";
import { currentCompoundId, workOf } from "../state/structureState.js";
import { useStructure, useStructureStore } from "../state/StructureContext.jsx";

/** The unknown being investigated: { store, compound, level, work, sampleId }. All fields are stable references while nothing changed. */
export default function useInvestigation() {
  const store = useStructureStore();
  const cid = useStructure(currentCompoundId); const levelId = useStructure((s) => s.level); const idx = useStructure((s) => s.idx[s.level]);
  const work = useStructure(workOf);
  return { store, compound: COMPOUNDS[cid], level: getLevel(levelId), work, sampleId: sampleId(levelId, idx), index: idx };
}
