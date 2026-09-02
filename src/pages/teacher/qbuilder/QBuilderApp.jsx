import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { QBuilderProvider, useQBuilder } from "./context/QBuilderContext.jsx";
import TopTabs from "./components/TopTabs.jsx";
import QuestionBankView from "./components/QuestionBankView.jsx";
import MyQuestionsView from "./components/MyQuestionsView.jsx";
import MyPapersView from "./components/MyPapersView.jsx";
import QuestionEditor from "./components/QuestionEditor.jsx";
import PaperWorkspace from "./components/PaperWorkspace.jsx";
import Container from "../../../components/ui/Container.jsx";

// Internal view-state machine, deliberately not extra routes (consistent
// with how other e-Lab engines — e.g. Electron Configuration Explorer,
// Explore Matter & States — manage their own step/scene state without
// adding router complexity for every screen).
function QBuilderWorkspace() {
  const { subject } = useOutletContext();
  const { addMyQuestion, updateMyQuestion, addToDraft, createEditableCopy, updateDraftQuestion, isInDraft } = useQBuilder();

  const [tab, setTab] = useState("bank"); // bank | my-questions | my-papers
  const [view, setView] = useState("list"); // list | editor | paper
  const [editorSource, setEditorSource] = useState(null); // question being edit-copied, or null for create
  const [editingExistingId, setEditingExistingId] = useState(null); // My Questions "Edit" (not a copy)

  function openCreateEditor() {
    setEditorSource(null);
    setEditingExistingId(null);
    setView("editor");
  }

  function openEditCopy(question) {
    setEditorSource(createEditableCopy(question));
    setEditingExistingId(null);
    setView("editor");
  }

  function openEditExisting(question) {
    setEditorSource(question);
    setEditingExistingId(question.id);
    setView("editor");
  }

  function handleSave(question) {
    if (editingExistingId) {
      updateMyQuestion(editingExistingId, question);
      if (isInDraft(editingExistingId)) updateDraftQuestion(editingExistingId, question);
    } else {
      addMyQuestion(question);
    }
    setView("list");
    setTab("my-questions");
  }

  function handleSaveAndAddToPaper(question) {
    if (editingExistingId) {
      updateMyQuestion(editingExistingId, question);
      if (isInDraft(editingExistingId)) updateDraftQuestion(editingExistingId, question);
      else addToDraft(question);
    } else {
      addMyQuestion(question);
      addToDraft(question);
    }
    setView("list");
    setTab("my-questions");
  }

  if (view === "editor") {
    return (
      <QuestionEditor
        sourceQuestion={editorSource}
        onBack={() => setView("list")}
        onSave={handleSave}
        onSaveAndAddToPaper={handleSaveAndAddToPaper}
      />
    );
  }

  if (view === "paper") {
    return (
      <PaperWorkspace
        onBack={() => setView("list")}
        onEditQuestion={openEditExisting}
        onSaved={() => {
          setView("list");
          setTab("my-papers");
        }}
      />
    );
  }

  return (
    <Container className="py-10">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Q Builder</p>
        <h1 className="mt-2 font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
          Build a {subject.label} question paper
        </h1>
      </div>

      <TopTabs activeTab={tab} onChangeTab={setTab} onCreateQuestion={openCreateEditor} />

      <div className="mt-8">
        {tab === "bank" && <QuestionBankView onEditCopy={openEditCopy} onViewPaper={() => setView("paper")} />}
        {tab === "my-questions" && <MyQuestionsView onEdit={openEditExisting} />}
        {tab === "my-papers" && <MyPapersView onOpenPaper={() => setView("paper")} />}
      </div>
    </Container>
  );
}

export default function QBuilderApp() {
  return (
    <QBuilderProvider>
      <QBuilderWorkspace />
    </QBuilderProvider>
  );
}
