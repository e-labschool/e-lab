import { createContext, useContext, useEffect, useState } from "react";
import { getVisibleQuestions } from "../../../../data/questions/index.js";
import {
  loadMyQuestions,
  saveMyQuestions,
  loadMyPapers,
  saveMyPapers,
  loadDraftPaper,
  saveDraftPaper,
} from "../lib/storage.js";
import { calcTotalMarks, generateCustomId, generatePaperId } from "../lib/paperUtils.js";

const QBuilderContext = createContext(null);

export function QBuilderProvider({ children }) {
  const [myQuestions, setMyQuestions] = useState(() => loadMyQuestions());
  const [myPapers, setMyPapers] = useState(() => loadMyPapers());
  const [draft, setDraft] = useState(() => loadDraftPaper());

  useEffect(() => saveMyQuestions(myQuestions), [myQuestions]);
  useEffect(() => saveMyPapers(myPapers), [myPapers]);
  useEffect(() => saveDraftPaper(draft), [draft]);

  // The central e-Lab Practice Questions bank (reviewed/published only —
  // drafts are excluded from this default view; see status filter in
  // FilterBar for reviewing drafts) plus the teacher's own questions.
  const sampleQuestions = getVisibleQuestions();
  const allQuestions = [...sampleQuestions, ...myQuestions];

  function getQuestionById(id) {
    return allQuestions.find((q) => q.id === id) ?? draft.questions.find((q) => q.id === id) ?? null;
  }

  // ---- My Questions ----

  function addMyQuestion(question) {
    setMyQuestions((prev) => [...prev, question]);
  }

  function updateMyQuestion(id, patch) {
    setMyQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function deleteMyQuestion(id) {
    setMyQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function createEditableCopy(sourceQuestion) {
    return {
      ...sourceQuestion,
      id: generateCustomId(sourceQuestion.id),
      isCustom: true,
      sourceId: sourceQuestion.id,
    };
  }

  // ---- Draft paper ("My Paper") ----

  function isInDraft(questionId) {
    return draft.questions.some((q) => q.id === questionId);
  }

  function addToDraft(question) {
    if (isInDraft(question.id)) return; // no accidental duplicate addition
    setDraft((prev) => ({ ...prev, questions: [...prev.questions, question] }));
  }

  function removeFromDraft(questionId) {
    setDraft((prev) => ({ ...prev, questions: prev.questions.filter((q) => q.id !== questionId) }));
  }

  function updateDraftQuestion(id, patch) {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function reorderDraft(fromIndex, toIndex) {
    setDraft((prev) => {
      const next = [...prev.questions];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, questions: next };
    });
  }

  function clearDraft() {
    setDraft((prev) => ({ ...prev, questions: [] }));
  }

  function updateDraftDetails(patch) {
    setDraft((prev) => ({ ...prev, details: { ...prev.details, ...patch } }));
  }

  // ---- My Papers ----

  function saveCurrentPaper(title) {
    const paper = {
      id: generatePaperId(),
      title: title || draft.details.assessmentTitle || "Untitled paper",
      createdAt: new Date().toISOString(),
      questions: draft.questions,
      details: draft.details,
    };
    setMyPapers((prev) => [paper, ...prev]);
    return paper;
  }

  function updateSavedPaper(id, patch) {
    setMyPapers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function deleteSavedPaper(id) {
    setMyPapers((prev) => prev.filter((p) => p.id !== id));
  }

  function duplicateSavedPaper(id) {
    setMyPapers((prev) => {
      const source = prev.find((p) => p.id === id);
      if (!source) return prev;
      const copy = { ...source, id: generatePaperId(), title: `${source.title} (copy)`, createdAt: new Date().toISOString() };
      return [copy, ...prev];
    });
  }

  function loadPaperIntoDraft(id) {
    const paper = myPapers.find((p) => p.id === id);
    if (!paper) return;
    setDraft({ questions: paper.questions, details: paper.details });
  }

  const value = {
    sampleQuestions,
    myQuestions,
    myPapers,
    draft,
    draftTotalMarks: calcTotalMarks(draft.questions),
    allQuestions,
    getQuestionById,
    addMyQuestion,
    updateMyQuestion,
    deleteMyQuestion,
    createEditableCopy,
    isInDraft,
    addToDraft,
    removeFromDraft,
    updateDraftQuestion,
    reorderDraft,
    clearDraft,
    updateDraftDetails,
    saveCurrentPaper,
    updateSavedPaper,
    deleteSavedPaper,
    duplicateSavedPaper,
    loadPaperIntoDraft,
  };

  return <QBuilderContext.Provider value={value}>{children}</QBuilderContext.Provider>;
}

export function useQBuilder() {
  const ctx = useContext(QBuilderContext);
  if (!ctx) throw new Error("useQBuilder must be used within a QBuilderProvider");
  return ctx;
}
