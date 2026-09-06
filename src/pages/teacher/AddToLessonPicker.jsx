import { useState } from "react";
import { X, Presentation, Sparkles, HelpCircle, FolderOpen, FileText, MessageSquare, ClipboardList, Upload, Image as ImageIcon, Link as LinkIcon, Box } from "lucide-react";
import { getLearnTree } from "../../lib/learn-tree.js";
import { getVisibleQuestions } from "../../data/questions/index.js";
import { getAllResources } from "../../data/resources-registry.js";
import Button from "../../components/ui/Button.jsx";

const FROM_ELAB = [
  { id: "elab_teach", label: "Teach", icon: Presentation, desc: "Curriculum-organised teaching support" },
  { id: "elab_interactive", label: "Interactive", icon: Sparkles, desc: "An existing e-Lab simulation or model" },
  { id: "question_bank", label: "Question Bank", icon: HelpCircle, desc: "A small set of questions for class use" },
  { id: "resource", label: "Resources", icon: FolderOpen, desc: "A worksheet or reference document" },
];
const MY_CONTENT = [
  { id: "text", label: "Text / Notes", icon: FileText },
  { id: "my_question", label: "My Question", icon: MessageSquare },
  { id: "activity", label: "Activity / Instructions", icon: ClipboardList },
  { id: "file", label: "Upload File", icon: Upload },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "link", label: "Link", icon: LinkIcon },
  { id: "custom", label: "Custom Block", icon: Box },
];

/**
 * onAdd receives { blockType, title, content, sourceType, sourceRef }
 * ready to pass straight to addLessonBlock. Every path here produces an
 * independent snapshot — nothing is a live reference back to its source.
 */
export default function AddToLessonPicker({ topicCode, onAdd, onClose }) {
  const [mode, setMode] = useState(null); // null | one of the FROM_ELAB/MY_CONTENT ids

  if (mode === "elab_teach") return <TeachPicker topicCode={topicCode} onAdd={onAdd} onBack={() => setMode(null)} onClose={onClose} />;
  if (mode === "elab_interactive") return <InteractivePicker onAdd={onAdd} onBack={() => setMode(null)} onClose={onClose} />;
  if (mode === "question_bank") return <QuestionBankPicker topicCode={topicCode} onAdd={onAdd} onBack={() => setMode(null)} onClose={onClose} />;
  if (mode === "resource") return <ResourcePicker onAdd={onAdd} onBack={() => setMode(null)} onClose={onClose} />;
  if (mode && MY_CONTENT.some((m) => m.id === mode)) return <MyContentForm kind={mode} onAdd={onAdd} onBack={() => setMode(null)} onClose={onClose} />;

  return (
    <Modal title="Add to Lesson" onClose={onClose}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">From e-Lab</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {FROM_ELAB.map((o) => (
          <button key={o.id} type="button" onClick={() => setMode(o.id)} className="rounded-md border border-[var(--color-line)] p-3 text-left hover:border-[var(--color-indigo)]">
            <o.icon size={17} className="text-[var(--color-indigo)]" />
            <p className="mt-1.5 text-sm font-semibold text-[var(--color-ink)]">{o.label}</p>
            <p className="text-[11px] text-[var(--color-ink-faint)]">{o.desc}</p>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">My Content</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MY_CONTENT.map((o) => (
          <button key={o.id} type="button" onClick={() => setMode(o.id)} className="flex flex-col items-center gap-1 rounded-md border border-[var(--color-line)] p-2.5 text-center hover:border-[var(--color-ink)]">
            <o.icon size={16} className="text-[var(--color-ink-soft)]" />
            <p className="text-[11px] font-medium text-[var(--color-ink)]">{o.label}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-ink)]">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function TeachPicker({ topicCode, onAdd, onBack, onClose }) {
  const tree = getLearnTree();
  const allSubtopics = tree.sections.flatMap((s) => s.topics.flatMap((t) => t.subtopics));
  // The Class Plan's own topic (if set) is prioritised to the top, per the
  // brief's "don't force re-navigating the whole syllabus" instruction —
  // but Teach content itself doesn't exist yet, so every entry is
  // necessarily the same honest placeholder for now.
  const ordered = topicCode ? [...allSubtopics].sort((a, b) => (a.code === topicCode ? -1 : b.code === topicCode ? 1 : 0)) : allSubtopics;

  return (
    <Modal title="Add from Teach" onClose={onClose}>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back</button>
      <div className="flex flex-col gap-1.5">
        {ordered.slice(0, 12).map((s) => (
          <button
            key={s.code} type="button"
            onClick={() => { onAdd({ blockType: "Explain", title: `${s.code} ${s.label}`, content: { placeholder: true }, sourceType: "elab_teach", sourceRef: s.code }); onClose(); }}
            className={`rounded-md border p-2.5 text-left text-sm ${s.code === topicCode ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}
          >
            <span className="font-medium text-[var(--color-ink)]">{s.code} {s.label}</span>
            <span className="ml-2 text-[11px] text-[var(--color-ink-faint)]">Teaching content coming soon</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function InteractivePicker({ onAdd, onBack, onClose }) {
  const interactives = getAllResources().filter((r) => r.audience === "teacher" || r.audience === "both");
  return (
    <Modal title="Add an Interactive" onClose={onClose}>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back</button>
      {interactives.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-faint)]">No interactives are available yet.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {interactives.map((r) => (
            <button key={r.id} type="button" onClick={() => { onAdd({ blockType: "Visualise", title: r.title, content: { interactiveId: r.id }, sourceType: "elab_interactive", sourceRef: r.id }); onClose(); }} className="rounded-md border border-[var(--color-line)] p-2.5 text-left text-sm">
              <span className="font-medium text-[var(--color-ink)]">{r.title}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

function QuestionBankPicker({ topicCode, onAdd, onBack, onClose }) {
  const [selected, setSelected] = useState([]);
  const questions = getVisibleQuestions().filter((q) => !topicCode || q.topicCode === topicCode).slice(0, 20);

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function confirm(blockType) {
    const picked = questions.filter((q) => selected.includes(q.id));
    onAdd({ blockType, title: `${picked.length} Question${picked.length === 1 ? "" : "s"}`, content: { questionIds: picked.map((q) => q.id) }, sourceType: "question_bank", sourceRef: picked.map((q) => q.id).join(",") });
    onClose();
  }

  return (
    <Modal title="Add from Question Bank" onClose={onClose}>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back</button>
      <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
        {questions.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">No matching questions found.</p>
        ) : questions.map((q) => (
          <label key={q.id} className="flex items-start gap-2 rounded-md border border-[var(--color-line)] p-2.5 text-sm">
            <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} className="mt-0.5" />
            <span className="text-[var(--color-ink)]">{q.questionText?.slice(0, 90)}{q.questionText?.length > 90 ? "\u2026" : ""}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={() => confirm("Check Understanding")}>Add as Check Understanding</Button>
          <Button size="sm" variant="secondary" onClick={() => confirm("Exit Ticket")}>Add as Exit Ticket</Button>
        </div>
      )}
    </Modal>
  );
}

function ResourcePicker({ onAdd, onBack, onClose }) {
  return (
    <Modal title="Add a Resource" onClose={onClose}>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back</button>
      <p className="mb-3 text-xs text-[var(--color-ink-faint)]">Resources open in Teacher Resources — reference one here by title.</p>
      <ResourceQuickAdd onAdd={onAdd} onClose={onClose} />
    </Modal>
  );
}
function ResourceQuickAdd({ onAdd, onClose }) {
  const [title, setTitle] = useState("");
  return (
    <div className="flex gap-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resource title" className="flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]" />
      <Button size="sm" disabled={!title.trim()} onClick={() => { onAdd({ blockType: "Activity", title, content: { note: "Reference — open in Teacher Resources" }, sourceType: "resource", sourceRef: null }); onClose(); }}>Add</Button>
    </div>
  );
}

function MyContentForm({ kind, onAdd, onBack, onClose }) {
  const meta = MY_CONTENT.find((m) => m.id === kind);
  const [title, setTitle] = useState(meta.label);
  const [body, setBody] = useState("");

  function submit(e) {
    e.preventDefault();
    onAdd({ blockType: "Custom", title: title || meta.label, content: { kind, body }, sourceType: "custom", sourceRef: null });
    onClose();
  }

  return (
    <Modal title={meta.label} onClose={onClose}>
      <button type="button" onClick={onBack} className="mb-3 text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">&larr; Back</button>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Block title" className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]" />
        {kind === "file" || kind === "image" ? (
          <p className="text-xs text-[var(--color-ink-faint)]">File/image upload isn't wired to storage yet \u2014 add a short description for now.</p>
        ) : null}
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder={kind === "link" ? "https://..." : "Content"} className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)]" />
        <Button type="submit">Add to Lesson</Button>
      </form>
    </Modal>
  );
}
