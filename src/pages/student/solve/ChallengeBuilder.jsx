import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import CurriculumCheckboxTree from "../../../components/curriculum/CurriculumCheckboxTree.jsx";
import { curateChallenge, estimateMinutesFor, createChallenge } from "../../../lib/challengeService.js";
import Button from "../../../components/ui/Button.jsx";

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20];
const TIME_OPTIONS_MINUTES = [10, 20, 30, 45, 60];

// Consolidated into one screen — Topics / Mode / Level / Style side by
// side, with a persistent summary + Start Challenge always visible below,
// rather than the previous 5-step wizard. Every setting can be changed
// without navigating anywhere; the live preview recomputes from whatever
// is currently selected.
export default function ChallengeBuilder() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [topicCodes, setTopicCodes] = useState([]);
  const [mode, setMode] = useState("questions");
  const [questionCount, setQuestionCount] = useState(10);
  const [customCount, setCustomCount] = useState("");
  const [timeMinutes, setTimeMinutes] = useState(20);
  const [level, setLevel] = useState(profile?.level === "HL" ? "HL" : "SL");
  const [style, setStyle] = useState("balanced");
  const [starting, setStarting] = useState(false);
  const [buildError, setBuildError] = useState(null);

  const effectiveCount = mode === "questions" ? (Number(customCount) || questionCount) : null;

  const preview = useMemo(() => {
    if (topicCodes.length === 0) return null;
    return curateChallenge({
      topicCodes, level, mode,
      questionCount: effectiveCount,
      timeLimitMinutes: timeMinutes,
      style,
    });
  }, [topicCodes, level, mode, effectiveCount, timeMinutes, style]);

  async function handleStart() {
    if (!preview || preview.questions.length === 0) return;
    setStarting(true);
    setBuildError(null);
    try {
      const totalMinutes = preview.questions.reduce((sum, q) => sum + estimateMinutesFor(q), 0);
      const timeLimitSeconds = mode === "time" ? timeMinutes * 60 : Math.round(totalMinutes * 60);
      const challenge = await createChallenge({
        topicCodes, level, mode,
        questionCount: preview.questions.length,
        timeLimitSeconds, style,
        questions: preview.questions,
      });
      navigate(`/student/solve/${challenge.id}`);
    } catch (err) {
      setBuildError(err.message || "Something went wrong starting this challenge.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
      <button type="button" onClick={() => navigate("/student/solve")} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> Back to Solve
      </button>
      <h1 className="font-[var(--font-display)] text-[28px] font-bold tracking-tight text-[var(--color-ink)]">Build Your Challenge</h1>

      <div className="mt-6 grid gap-5 lg:grid-cols-4">
        {/* Topics */}
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Topics</p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{topicCodes.length} selected \u2014 select any combination</p>
          <div className="mt-3 max-h-80 overflow-y-auto pr-1">
            <CurriculumCheckboxTree selectedCodes={topicCodes} onChange={setTopicCodes} counts={{}} />
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Mode & count/time */}
            <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Mode</p>
              <div className="mt-2 flex gap-1.5">
                {["questions", "time"].map((m) => (
                  <button key={m} type="button" onClick={() => setMode(m)} className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold ${mode === m ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                    {m === "questions" ? "By Questions" : "By Time"}
                  </button>
                ))}
              </div>
              {mode === "questions" ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {QUESTION_COUNT_OPTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => { setQuestionCount(c); setCustomCount(""); }} className={`rounded-md border px-3 py-1.5 text-xs font-medium ${questionCount === c && !customCount ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                      {c}
                    </button>
                  ))}
                  <input type="number" min={1} max={40} placeholder="Custom" value={customCount} onChange={(e) => setCustomCount(e.target.value)} className="w-16 rounded-md border border-[var(--color-line)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-ink)]" />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {TIME_OPTIONS_MINUTES.map((m) => (
                    <button key={m} type="button" onClick={() => setTimeMinutes(m)} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${timeMinutes === m ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                      {m}m
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Level */}
            <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Level</p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">HL may include SL foundation content.</p>
              <div className="mt-2 flex gap-1.5">
                {["SL", "HL"].map((l) => (
                  <button key={l} type="button" onClick={() => setLevel(l)} className={`flex-1 rounded-md border py-2 text-sm font-semibold ${level === l ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Style */}
          <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Challenge Style</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {[
                { id: "balanced", label: "Balanced", desc: "A sensible mixture of difficulties and question types." },
                { id: "exam_ready", label: "Exam Ready", desc: "Prioritises examination-style reasoning and application questions." },
              ].map((s) => (
                <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={`rounded-md border p-2.5 text-left ${style === s.id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}>
                  <p className="text-xs font-semibold text-[var(--color-ink)]">{s.label}</p>
                  <p className="text-[11px] text-[var(--color-ink-faint)]">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Summary + Start — always visible, recomputes live */}
      <div className="mt-5 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
        {topicCodes.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">Select at least one topic above to preview your challenge.</p>
        ) : !preview ? (
          <div className="flex justify-center py-2"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
        ) : preview.insufficientReason ? (
          <div className="flex items-start gap-2 text-sm text-[var(--color-amber)]">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <p>{preview.insufficientReason} Try selecting more topics or reducing the question count.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span><strong className="text-[var(--color-ink)]">{preview.questions.length}</strong> <span className="text-[var(--color-ink-faint)]">Questions</span></span>
              <span><strong className="text-[var(--color-ink)]">{level}</strong> <span className="text-[var(--color-ink-faint)]">Level</span></span>
              <span><strong className="capitalize text-[var(--color-ink)]">{style.replace("_", " ")}</strong> <span className="text-[var(--color-ink-faint)]">Style</span></span>
              <span className="text-[var(--color-ink-faint)]">~{Math.round(preview.questions.reduce((s, q) => s + estimateMinutesFor(q), 0))} min estimated</span>
            </div>
            <Button disabled={starting} onClick={handleStart}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Challenge"}
            </Button>
          </div>
        )}
        {buildError && <p className="mt-2 text-xs text-[var(--color-coral)]">{buildError}</p>}
      </div>
    </div>
  );
}
