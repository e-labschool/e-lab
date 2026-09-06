import { createContext, useContext, useEffect, useState } from "react";
import { getVisibleQuestions } from "../../../../data/questions/index.js";
import { getPublishedQuestionsForBuilder } from "../lib/supabaseQuestions.js";
import {
  resolveLatestVersionId, getDraftPaper, listSavedPapers, createPaper, updatePaperMeta,
  deletePaper, duplicatePaper, getPaperItems, addItem, removeItem, reorderItems, updateItemMarksOverride,
} from "../lib/paperService.js";
import { loadMyQuestions, saveMyQuestions, loadDraftDetails, saveDraftDetails } from "../lib/storage.js";
import { calcTotalMarks, generateCustomId } from "../lib/paperUtils.js";

const QBuilderContext = createContext(null);

export function QBuilderProvider({ children }) {
  const [myQuestions, setMyQuestions] = useState(() => loadMyQuestions());
  const [myPapers, setMyPapers] = useState([]);
  // The paper metadata form (school/class/date/subject) has no matching
  // columns in question_papers (title/paper/level only) — rather than
  // invent new columns without approval, this piece stays localStorage-
  // backed exactly as before; only paper QUESTIONS/ITEMS move to Supabase,
  // which is what this change is actually about.
  const [draftDetails, setDraftDetails] = useState(() => loadDraftDetails());
  const [draftPaperId, setDraftPaperId] = useState(null);
  const [draftQuestions, setDraftQuestions] = useState([]);
  const [draftItems, setDraftItems] = useState([]); // raw rows, needed for position/removal
  const [supabaseQuestions, setSupabaseQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadingPaper, setLoadingPaper] = useState(true);
  const [paperError, setPaperError] = useState(null);

  useEffect(() => saveMyQuestions(myQuestions), [myQuestions]);
  useEffect(() => saveDraftDetails(draftDetails), [draftDetails]);

  useEffect(() => {
    getPublishedQuestionsForBuilder()
      .then(setSupabaseQuestions)
      .catch(() => setSupabaseQuestions([])) // legacy bank still works even if Supabase is unreachable
      .finally(() => setLoadingQuestions(false));
  }, []);

  // Load (or note the absence of) an existing draft paper, and the
  // teacher's saved papers, once on mount.
  useEffect(() => {
    async function init() {
      try {
        const [draft, saved] = await Promise.all([getDraftPaper(), listSavedPapers()]);
        setMyPapers(saved);
        if (draft) {
          setDraftPaperId(draft.id);
          const { questions, items } = await getPaperItems(draft.id);
          setDraftQuestions(questions);
          setDraftItems(items);
        }
      } catch (err) {
        setPaperError(err.message || "Couldn't load your saved paper.");
      } finally {
        setLoadingPaper(false);
      }
    }
    init();
  }, []);

  // The central e-Lab Practice Questions bank: legacy JS (reviewed/
  // published only) merged with published Supabase questions, plus the
  // teacher's own questions. Supabase takes precedence whenever the same
  // id exists in both, so no id is ever duplicated in the combined pool.
  const legacyQuestions = getVisibleQuestions();
  const supabaseIds = new Set(supabaseQuestions.map((q) => q.id));
  const sampleQuestions = [...legacyQuestions.filter((q) => !supabaseIds.has(q.id)), ...supabaseQuestions];
  const allQuestions = [...sampleQuestions, ...myQuestions];

  function getQuestionById(id) {
    return allQuestions.find((q) => q.id === id) ?? draftQuestions.find((q) => q.id === id) ?? null;
  }

  // ---- My Questions (teacher's own bank — unrelated to paper persistence, untouched) ----

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
    return { ...sourceQuestion, id: generateCustomId(sourceQuestion.id), isCustom: true, sourceId: sourceQuestion.id };
  }

  // ---- Draft paper — now Supabase-backed ----

  async function ensureDraftPaperExists() {
    if (draftPaperId) return draftPaperId;
    const paper = await createPaper({ title: draftDetails.assessmentTitle || "Untitled paper", status: "draft" });
    setDraftPaperId(paper.id);
    return paper.id;
  }

  function isInDraft(questionId) {
    return draftQuestions.some((q) => q.id === questionId);
  }

  async function addToDraft(question) {
    if (isInDraft(question.id)) return; // no accidental duplicate addition
    try {
      const paperId = await ensureDraftPaperExists();
      const position = draftItems.length;
      let item;
      if (question.isSupabaseQuestion) {
        // Resolve the CURRENT latest published version now, then freeze
        // it — this is the actual version-pinning guarantee: later edits
        // to the canonical question create new versions, but this item
        // keeps pointing at the one resolved right now, forever.
        const questionVersionId = await resolveLatestVersionId(question.id);
        item = await addItem(paperId, { position, questionVersionId, marksOverride: null });
      } else {
        // Legacy JS or teacher-custom question — no canonical versioned
        // home exists for it, so a full frozen snapshot is stored
        // directly; no attempt is made to create a Supabase question for it.
        item = await addItem(paperId, { position, customQuestion: question, marksOverride: null });
      }
      setDraftItems((prev) => [...prev, item]);
      setDraftQuestions((prev) => [...prev, { ...question, paperItemId: item.id }]);
    } catch (err) {
      setPaperError(err.message || "Couldn't add that question to your paper.");
    }
  }

  async function removeFromDraft(questionId) {
    const target = draftQuestions.find((q) => q.id === questionId);
    if (!target?.paperItemId) return;
    setDraftQuestions((prev) => prev.filter((q) => q.id !== questionId));
    setDraftItems((prev) => prev.filter((i) => i.id !== target.paperItemId));
    try {
      await removeItem(target.paperItemId);
    } catch (err) {
      setPaperError(err.message || "Couldn't remove that question — it may reappear after reload.");
    }
  }

  // Only marks are ever persisted server-side for an existing item — a
  // content patch only makes sense for a custom-snapshot item (there is
  // nothing to "patch" on a version-pinned item without breaking the
  // pinning guarantee), so that path stays a local-only convenience.
  async function updateDraftQuestion(id, patch) {
    setDraftQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    const target = draftQuestions.find((q) => q.id === id);
    if (!target?.paperItemId) return;
    if (patch.marks != null) {
      try {
        await updateItemMarksOverride(target.paperItemId, patch.marks);
      } catch {
        // local UI state already updated; a failed persist here is
        // non-critical enough not to interrupt the teacher's editing flow
      }
    }
  }

  async function reorderDraft(fromIndex, toIndex) {
    const nextQuestions = [...draftQuestions];
    const [moved] = nextQuestions.splice(fromIndex, 1);
    nextQuestions.splice(toIndex, 0, moved);
    setDraftQuestions(nextQuestions);
    const orderedIds = nextQuestions.map((q) => q.paperItemId).filter(Boolean);
    try {
      await reorderItems(orderedIds);
      setDraftItems((prev) => orderedIds.map((id) => prev.find((i) => i.id === id)).filter(Boolean));
    } catch (err) {
      setPaperError(err.message || "Couldn't save the new question order.");
    }
  }

  async function clearDraft() {
    setDraftQuestions([]);
    const idsToRemove = draftItems.map((i) => i.id);
    setDraftItems([]);
    try {
      await Promise.all(idsToRemove.map((id) => removeItem(id)));
    } catch (err) {
      setPaperError(err.message || "Couldn't clear all questions from the paper.");
    }
  }

  function updateDraftDetails(patch) {
    setDraftDetails((prev) => ({ ...prev, ...patch }));
  }

  // ---- My Papers ----

  async function saveCurrentPaper(title) {
    const paperId = await ensureDraftPaperExists();
    await updatePaperMeta(paperId, { title: title || draftDetails.assessmentTitle || "Untitled paper", status: "saved" });
    const saved = await listSavedPapers();
    setMyPapers(saved);
    setDraftPaperId(null);
    setDraftQuestions([]);
    setDraftItems([]);
    return saved.find((p) => p.id === paperId);
  }

  async function updateSavedPaper(id, patch) {
    setMyPapers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      await updatePaperMeta(id, patch);
    } catch (err) {
      setPaperError(err.message || "Couldn't save changes to that paper.");
    }
  }

  async function deleteSavedPaper(id) {
    setMyPapers((prev) => prev.filter((p) => p.id !== id));
    try {
      await deletePaper(id);
    } catch (err) {
      setPaperError(err.message || "Couldn't delete that paper.");
    }
  }

  async function duplicateSavedPaper(id) {
    try {
      const copy = await duplicatePaper(id);
      setMyPapers((prev) => [copy, ...prev]);
    } catch (err) {
      setPaperError(err.message || "Couldn't duplicate that paper.");
    }
  }

  // Loads a SAVED paper's items into the active draft for editing —
  // content is reconstructed from each item's pinned question_version_id
  // (via content_snapshot) or custom_question, never from the live
  // canonical question. This is the guarantee under test with
  // PILOT-S1-1-001: editing the canonical question after this point
  // cannot change what reloading this paper displays.
  async function loadPaperIntoDraft(id) {
    setLoadingPaper(true);
    try {
      const { questions, items } = await getPaperItems(id);
      setDraftPaperId(id);
      setDraftQuestions(questions);
      setDraftItems(items);
    } catch (err) {
      setPaperError(err.message || "Couldn't load that paper.");
    } finally {
      setLoadingPaper(false);
    }
  }

  const value = {
    sampleQuestions,
    loadingQuestions,
    myQuestions,
    myPapers,
    draft: { questions: draftQuestions, details: draftDetails },
    loadingPaper,
    paperError,
    draftTotalMarks: calcTotalMarks(draftQuestions),
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
