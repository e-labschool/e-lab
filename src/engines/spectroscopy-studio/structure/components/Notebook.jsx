import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { NOTEBOOK_SECTIONS } from "../state/structureState.js";
import { useStructure } from "../state/StructureContext.jsx";
import useInvestigation from "./useInvestigation.js";

/** The Evidence Notebook: five editable sections, never filled with answers. Rendered by the workbench as a docked column / bottom section. */
export default function Notebook() {
  const { store, work, sampleId } = useInvestigation();
  const open = useStructure((s) => s.notebookOpen);
  if (!open) return null;
  return (
    <aside id="st-notebook" className="st-notebook" aria-label="Evidence Notebook" data-testid="notebook">
      <div className="st-nbhead">
        <h3 className="st-nbtitle"><BookOpen size={15} aria-hidden="true" /> Evidence Notebook</h3>
        <span className="st-nbsub">{sampleId}. Your own notes only.</span>
      </div>
      <div className="st-nbsections">
        {NOTEBOOK_SECTIONS.map((s) => (
          <label key={s.id} className="st-nbsec">
            <span className="st-nblabel">{s.label}</span>
            <textarea className="st-textarea" rows={3} value={work.notebook[s.id]} onChange={(e) => store.setNotebook(s.id, e.target.value)} data-testid={`notebook-${s.id}`} placeholder="Write your observations here" />
          </label>
        ))}
      </div>
    </aside>
  );
}

/** The button in the top row that opens / closes the notebook. */
export function NotebookToggle() {
  const { store } = useInvestigation();
  const open = useStructure((s) => s.notebookOpen);
  return (
    <button type="button" className="sim-btn st-tbtn" onClick={store.toggleNotebook} aria-expanded={open} aria-controls="st-notebook" data-testid="notebook-toggle" title={open ? "Collapse the Evidence Notebook" : "Open the Evidence Notebook"}>
      <BookOpen size={15} aria-hidden="true" /> <span>Evidence Notebook</span> {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
    </button>
  );
}
