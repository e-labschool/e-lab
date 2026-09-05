import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useBlocker } from "react-router-dom";
import { Flag, Loader2, Calculator as CalculatorIcon, Sigma, AlertTriangle, Maximize } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient.js";
import { getQuestionById } from "../../../data/questions/index.js";
import { getChallengeQuestions, saveAnswer, updateChallengeProgress, submitChallenge, abandonChallenge } from "../../../lib/challengeService.js";
import { CUSTOM_CHALLENGE_CONFIG } from "../../../lib/assessmentConfig.js";
import QuestionRenderer from "./QuestionRenderer.jsx";
import Calculator from "./Calculator.jsx";
import SymbolPalette, { insertAtCursor } from "./SymbolPalette.jsx";
import ELabLoader from "../../../components/ui/ELabLoader.jsx";
import Button from "../../../components/ui/Button.jsx";

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

const config = CUSTOM_CHALLENGE_CONFIG; // swap for EXAM_SIMULATION_CONFIG when that mode exists — nothing else here changes

export default function ChallengeSession() {
  const { challengeId } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [rows, setRows] = useState([]);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState(new Set());
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [confirmMode, setConfirmMode] = useState(null); // null | "submit" | "end"
  const [submitting, setSubmitting] = useState(false);
  const startedAtRef = useRef(null);

  // Pre-challenge consent screen — only for a genuinely fresh challenge
  // (nothing answered, still on question 1); a refreshed/resumed
  // in-progress challenge skips straight back into the assessment rather
  // than re-prompting, since fullscreen can't be silently re-requested
  // after a reload anyway.
  const [readyScreenDismissed, setReadyScreenDismissed] = useState(false);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(true);

  // ---- Focus / fullscreen monitoring ----
  const [violationCount, setViolationCount] = useState(0);
  const [interruptionOverlay, setInterruptionOverlay] = useState(false);
  const hasFocusRef = useRef(true);
  const violationCountRef = useRef(0); // mirrors state for use inside listeners without stale closures

  // ---- Navigation lock ----
  const [pendingBlockedNav, setPendingBlockedNav] = useState(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!supabase) return;
    Promise.all([
      supabase.from("student_challenges").select("*").eq("id", challengeId).single(),
      getChallengeQuestions(challengeId),
    ])
      .then(([{ data: c, error: cErr }, qRows]) => {
        if (cErr) throw cErr;
        if (c.status !== "in_progress") {
          navigate(`/student/solve/${challengeId}/report`, { replace: true });
          return;
        }
        setChallenge(c);
        setRows(qRows);
        setIndex(c.current_question_index ?? 0);
        setFlagged(new Set(c.flagged_question_ids ?? []));
        setAnswers(Object.fromEntries(qRows.map((r) => [r.question_id, r.student_answer])));
        setViolationCount(c.focus_violation_count ?? 0);
        violationCountRef.current = c.focus_violation_count ?? 0;
        startedAtRef.current = new Date(c.started_at).getTime();
        const alreadyStarted = (c.current_question_index ?? 0) > 0 || qRows.some((r) => r.student_answer != null);
        setReadyScreenDismissed(alreadyStarted);
      })
      .catch((err) => setError(err.message || "Couldn't load this challenge."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  const questions = useMemo(() => rows.map((r) => getQuestionById(r.question_id)).filter(Boolean), [rows]);
  const current = questions[index];
  const currentRow = rows[index];

  const [remainingSeconds, setRemainingSeconds] = useState(null);

  const doSubmit = useCallback(async (terminationReason = "submitted") => {
    if (submittedRef.current || !challenge) return;
    submittedRef.current = true;
    setSubmitting(true);
    const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]));
    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    try {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      await submitChallenge(challenge.id, { questionsById, durationSeconds, terminationReason, focusViolationCount: violationCountRef.current });
      navigate(`/student/solve/${challenge.id}/report`, { replace: true });
    } catch (err) {
      setError(err.message || "Something went wrong submitting your challenge.");
      submittedRef.current = false;
      setSubmitting(false);
    }
  }, [challenge, questions, navigate]);

  useEffect(() => {
    if (!challenge?.time_limit_seconds || !startedAtRef.current || !readyScreenDismissed) return;
    const tick = () => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const remaining = challenge.time_limit_seconds - elapsed;
      setRemainingSeconds(remaining);
      if (remaining <= 0) doSubmit("time_expired");
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [challenge, doSubmit, readyScreenDismissed]);

  // ---- Focus/visibility/fullscreen monitoring ----
  // The timer keeps running while a student is away — per the brief,
  // leaving must never be rewarded with frozen time. Multiple events
  // (blur + visibilitychange) can fire for the same tab-switch; a
  // focused->unfocused EDGE (hasFocusRef flipping true->false) is what
  // counts as one violation, not each individual event.
  useEffect(() => {
    if (!readyScreenDismissed || submittedRef.current) return;

    function registerLeave() {
      if (!hasFocusRef.current) return; // already counted this departure
      hasFocusRef.current = false;
      const next = violationCountRef.current + 1;
      violationCountRef.current = next;
      setViolationCount(next);
      setInterruptionOverlay(true);
      if (next >= config.maxFocusViolations) {
        doSubmit("focus_violation");
      }
    }
    function registerReturn() {
      hasFocusRef.current = true;
    }

    function onVisibility() { if (document.hidden) registerLeave(); }
    function onBlur() { registerLeave(); }
    function onFocus() { registerReturn(); }
    function onFullscreenChange() { if (!document.fullscreenElement) registerLeave(); }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyScreenDismissed, challenge, doSubmit]);

  // ---- beforeunload: browsers only ever show their own native wording,
  // never custom text — this is disclosed in the final report, not hidden. ----
  useEffect(() => {
    if (!readyScreenDismissed || !config.navigationLocked) return;
    function handler(e) {
      if (submittedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [readyScreenDismissed]);

  // ---- In-app navigation lock ----
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      config.navigationLocked && readyScreenDismissed && !submittedRef.current && currentLocation.pathname !== nextLocation.pathname
  );
  useEffect(() => {
    if (blocker.state === "blocked") setPendingBlockedNav(true);
  }, [blocker.state]);

  async function handleStartChallenge() {
    // Always attempted regardless of config.fullscreenRequired — that
    // flag is reserved for a future stricter mode that would BLOCK
    // starting without it; today's Custom Challenge always tries, then
    // proceeds either way, per the brief.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      setFullscreenAvailable(false);
    }
    setReadyScreenDismissed(true);
  }

  async function goTo(nextIndex) {
    if (currentRow) await saveAnswer(challenge.id, currentRow.question_id, answers[currentRow.question_id]);
    setIndex(nextIndex);
    setShowNavigator(false);
    updateChallengeProgress(challenge.id, { currentQuestionIndex: nextIndex });
  }

  async function toggleFlag() {
    const next = new Set(flagged);
    if (next.has(currentRow.question_id)) next.delete(currentRow.question_id);
    else next.add(currentRow.question_id);
    setFlagged(next);
    await updateChallengeProgress(challenge.id, { flaggedQuestionIds: [...next] });
  }

  const answeredCount = rows.filter((r) => {
    const a = answers[r.question_id];
    return a != null && a !== "" && !(typeof a === "object" && Object.values(a).every((v) => !v));
  }).length;
  const unansweredCount = rows.length - answeredCount;

  // ---- Calculator / Symbols ----
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [symbolsOpen, setSymbolsOpen] = useState(false);
  const activeInputRef = useRef(null);
  const activeSetterRef = useRef(null);
  function registerActiveInput(el, setter) {
    activeInputRef.current = el;
    activeSetterRef.current = setter;
  }
  function insertSymbol(symbol) {
    const el = activeInputRef.current;
    const setter = activeSetterRef.current;
    if (!el || !setter) return;
    const result = insertAtCursor(el, symbol);
    if (result) {
      setter(result.value);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(result.cursor, result.cursor); });
    }
  }

  async function handleEndAndLeave() {
    await abandonChallenge(challenge.id, { focusViolationCount: violationCountRef.current });
    submittedRef.current = true;
    blocker.proceed?.();
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]"><ELabLoader /></div>;
  if (error) return <p className="p-10 text-center text-sm text-[var(--color-coral)]">{error}</p>;
  if (!challenge || !current) return null;

  if (!readyScreenDismissed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-paper)] px-6 text-center">
        <p className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Ready to begin?</p>
        <p className="max-w-sm text-sm text-[var(--color-ink-soft)]">
          Once started, e-Lab will enter focused assessment mode. Leaving the assessment screen may be recorded.
        </p>
        <Button onClick={handleStartChallenge}>Start Challenge</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-paper)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--color-ink)]">e-Lab Challenge</p>
            <p className="text-xs text-[var(--color-ink-faint)]">{challenge.topic_codes.join(" + ")} &middot; Question {index + 1} of {questions.length}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {remainingSeconds != null && (
              <span role="timer" aria-live="polite" className={`mr-2 font-mono text-sm font-medium ${remainingSeconds < 60 ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>
                {formatClock(remainingSeconds)} remaining
              </span>
            )}
            <ToolbarButton icon={CalculatorIcon} label="Calculator" onClick={() => { setCalculatorOpen((v) => !v); setSymbolsOpen(false); }} active={calculatorOpen} />
            <ToolbarButton icon={Sigma} label="Symbols" onClick={() => { setSymbolsOpen((v) => !v); setCalculatorOpen(false); }} active={symbolsOpen} />
            <ToolbarButton icon={Flag} label="Navigator" onClick={() => setShowNavigator((v) => !v)} active={showNavigator} />
            <button type="button" onClick={() => setConfirmMode("end")} className="ml-1 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral)]">
              End Challenge
            </button>
          </div>
        </div>
        {!fullscreenAvailable && (
          <p className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 text-[11px] text-[var(--color-ink-faint)]">
            <Maximize size={11} /> Focused fullscreen mode isn't available on this device — the challenge still works normally.
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_14px_-4px_rgba(20,30,80,0.08)] sm:p-8">
          <QuestionRenderer
            question={current}
            questionNumber={index + 1}
            answer={answers[current.id]}
            onAnswer={(value) => setAnswers((prev) => ({ ...prev, [current.id]: value }))}
            onFocusInput={registerActiveInput}
          />
        </div>
      </main>

      {(calculatorOpen || symbolsOpen) && (
        <div className="fixed bottom-20 right-4 z-40 sm:bottom-24">
          {calculatorOpen && <Calculator onClose={() => setCalculatorOpen(false)} />}
          {symbolsOpen && <SymbolPalette onSelect={insertSymbol} onClose={() => setSymbolsOpen(false)} />}
        </div>
      )}

      <footer className="sticky bottom-0 border-t border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={toggleFlag} className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium ${flagged.has(currentRow.question_id) ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)] text-[var(--color-amber)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
              <Flag size={13} /> {flagged.has(currentRow.question_id) ? "Flagged" : "Flag"}
            </button>
            {violationCount > 0 && (
              <span className="text-[11px] text-[var(--color-ink-faint)]">Focus interruptions: {violationCount}</span>
            )}
          </div>

          {showNavigator && (
            <div className="grid grid-cols-10 gap-1.5">
              {rows.map((r, i) => {
                const isAnswered = answers[r.question_id] != null && answers[r.question_id] !== "";
                const isFlagged = flagged.has(r.question_id);
                return (
                  <button
                    key={r.question_id} type="button" onClick={() => goTo(i)}
                    aria-current={i === index ? "true" : undefined}
                    aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", unanswered"}${isFlagged ? ", flagged" : ""}`}
                    title={`Question ${i + 1}${isAnswered ? " \u2014 answered" : " \u2014 unanswered"}${isFlagged ? " \u2014 flagged" : ""}`}
                    className={`relative flex h-8 items-center justify-center rounded-md border text-xs font-medium ${
                      i === index ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]" :
                      isAnswered ? "border-[var(--color-teal)]/40 bg-[var(--color-teal-soft)] text-[var(--color-teal)]" :
                      "border-[var(--color-line)] text-[var(--color-ink-faint)]"
                    }`}
                  >
                    {i + 1}
                    {isFlagged && <Flag size={9} className="absolute -right-1 -top-1 text-[var(--color-amber)]" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="secondary" size="sm" disabled={index === 0} onClick={() => goTo(index - 1)}>Previous</Button>
            {index < questions.length - 1 ? (
              <Button size="sm" onClick={() => goTo(index + 1)}>Next</Button>
            ) : (
              <Button size="sm" onClick={() => setConfirmMode("submit")} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Challenge"}
              </Button>
            )}
          </div>
        </div>
      </footer>

      {/* Explicit End Challenge / Submit confirm — shared by both entry points */}
      {confirmMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmMode(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-[var(--color-ink)]">{confirmMode === "end" ? "End Challenge?" : "Submit Challenge?"}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
              {unansweredCount > 0 ? `You still have ${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"}.` : "Your current challenge is still in progress."}
            </p>
            <div className="mt-4 flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmMode(null)}>{confirmMode === "end" ? "Continue Challenge" : "Return to Challenge"}</Button>
              <Button variant="danger" onClick={() => doSubmit("submitted")} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit & End"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked in-app navigation (Learn/Resources/etc link, back button within the SPA) */}
      {pendingBlockedNav && blocker.state === "blocked" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]"><AlertTriangle size={15} className="text-[var(--color-amber)]" /> Challenge in progress</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Leaving this assessment will end your current challenge.</p>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => { setPendingBlockedNav(false); blocker.reset?.(); }}>Stay in Challenge</Button>
              <Button variant="danger" onClick={handleEndAndLeave}>End &amp; Leave</Button>
            </div>
          </div>
        </div>
      )}

      {/* Focus-interruption overlay — first/second violation only; the
          3rd auto-submits via doSubmit above, so this overlay never has
          to offer anything beyond "resume". */}
      {interruptionOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-paper)] p-6" role="alertdialog" aria-modal="true">
          <div className="max-w-sm text-center">
            <AlertTriangle size={22} className="mx-auto text-[var(--color-amber)]" />
            <p className="mt-3 font-[var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">Assessment interrupted</p>
            <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
              You left the active challenge screen. For a focused assessment, remain on this screen until the challenge is completed.
            </p>
            {violationCount >= 2 && (
              <p className="mt-2 text-sm font-medium text-[var(--color-coral)]">
                This assessment has been interrupted multiple times. Another interruption will automatically submit your challenge.
              </p>
            )}
            <p className="mt-3 text-xs text-[var(--color-ink-faint)]">Focus interruptions: {violationCount}</p>
            <Button className="mt-4" onClick={() => setInterruptionOverlay(false)}>Resume Challenge</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ icon: Icon, label, onClick, active }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${active ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"}`}
    >
      <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
