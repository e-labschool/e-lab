import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Loader2, AlertTriangle } from "lucide-react";
import { useAuth } from "../../../context/AuthContext.jsx";
import CurriculumCheckboxTree from "../../../components/curriculum/CurriculumCheckboxTree.jsx";
import { curateChallenge, estimateMinutesFor, createChallenge } from "../../../lib/challengeService.js";
import Button from "../../../components/ui/Button.jsx";

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20];
const TIME_OPTIONS_MINUTES = [10, 20, 30, 45, 60];

const STEPS = ["topics", "mode", "level", "style", "summary"];

export default function ChallengeBuilder() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);

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
    if (step !== 4 || topicCodes.length === 0) return null;
    return curateChallenge({
      topicCodes, level, mode,
      questionCount: effectiveCount,
      timeLimitMinutes: timeMinutes,
      style,
    });
  }, [step, topicCodes, level, mode, effectiveCount, timeMinutes, style]);

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
      navigate(`${"/student/solve"}/${challenge.id}`);
    } catch (err) {
      setBuildError(err.message || "Something went wrong starting this challenge.");
    } finally {
      setStarting(false);
    }
  }

  const canAdvance = [
    topicCodes.length > 0,
    true,
    Boolean(level),
    Boolean(style),
    true,
  ][step];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <button type="button" onClick={() => (step === 0 ? navigate("/student/solve") : setStep((s) => s - 1))} className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]">
        <ChevronLeft size={15} /> Back
      </button>

      <div className="mb-6 flex gap-1.5">
        {STEPS.map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-[var(--color-indigo)]" : "bg-[var(--color-line)]"}`} />)}
      </div>

      {step === 0 && (
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Choose your topics</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Select any combination — there's no required order or unlocking.</p>
          <p className="mt-4 text-xs font-medium text-[var(--color-ink-faint)]">Selected Topics: {topicCodes.length}</p>
          <div className="mt-3">
            <CurriculumCheckboxTree selectedCodes={topicCodes} onChange={setTopicCodes} counts={{}} />
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Challenge mode</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Choose one — you don't need to configure both.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {["questions", "time"].map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg border p-4 text-left ${mode === m ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{m === "questions" ? "By Questions" : "By Time"}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{m === "questions" ? "Pick a question count" : "Pick a duration"}</p>
              </button>
            ))}
          </div>
          {mode === "questions" ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {QUESTION_COUNT_OPTIONS.map((c) => (
                <button key={c} type="button" onClick={() => { setQuestionCount(c); setCustomCount(""); }} className={`rounded-md border px-4 py-2 text-sm font-medium ${questionCount === c && !customCount ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                  {c}
                </button>
              ))}
              <input type="number" min={1} max={40} placeholder="Custom" value={customCount} onChange={(e) => setCustomCount(e.target.value)} className="w-24 rounded-md border border-[var(--color-line)] bg-transparent px-3 py-2 text-sm text-[var(--color-ink)]" />
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              {TIME_OPTIONS_MINUTES.map((m) => (
                <button key={m} type="button" onClick={() => setTimeMinutes(m)} className={`rounded-md border px-4 py-2 text-sm font-medium ${timeMinutes === m ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                  {m} min
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Level</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">HL challenges may include relevant SL foundation content.</p>
          <div className="mt-5 flex gap-3">
            {["SL", "HL"].map((l) => (
              <button key={l} type="button" onClick={() => setLevel(l)} className={`flex-1 rounded-lg border p-5 text-center ${level === l ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}>
                <p className="text-lg font-semibold text-[var(--color-ink)]">{l}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Challenge style</h1>
          <div className="mt-5 flex flex-col gap-3">
            {[
              { id: "balanced", label: "Balanced", desc: "A sensible mixture of difficulties and question types." },
              { id: "exam_ready", label: "Exam Ready", desc: "Prioritises examination-style reasoning and application questions." },
            ].map((s) => (
              <button key={s.id} type="button" onClick={() => setStyle(s.id)} className={`rounded-lg border p-4 text-left ${style === s.id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}>
                <p className="text-sm font-semibold text-[var(--color-ink)]">{s.label}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{s.desc}</p>
              </button>
            ))}
            <div className="rounded-lg border border-dashed border-[var(--color-line)] p-4 opacity-60">
              <p className="text-sm font-semibold text-[var(--color-ink)]">Adaptive <span className="ml-1.5 rounded-full bg-[var(--color-line)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-ink-faint)]">Coming Later</span></p>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Will adjust question difficulty in real time based on your performance.</p>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">Your Challenge</h1>
          <div className="mt-5 rounded-lg border border-[var(--color-line)] p-5">
            <div className="flex flex-wrap gap-1.5">
              {topicCodes.map((c) => <span key={c} className="rounded-full bg-[var(--color-indigo-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-indigo)]">{c}</span>)}
            </div>
            {!preview ? (
              <div className="mt-4 flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
            ) : preview.insufficientReason ? (
              <div className="mt-4 flex items-start gap-2 rounded-md bg-[var(--color-amber-soft)] px-3 py-2.5 text-sm text-[var(--color-amber)]">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <div>
                  <p>{preview.insufficientReason}</p>
                  <div className="mt-2 flex gap-3 text-xs font-medium">
                    <button type="button" onClick={() => setStep(1)} className="underline">Reduce question count</button>
                    <button type="button" onClick={() => setStep(0)} className="underline">Select more topics</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
                  <div><p className="font-semibold text-[var(--color-ink)]">{preview.questions.length}</p><p className="text-xs text-[var(--color-ink-faint)]">Questions</p></div>
                  <div><p className="font-semibold text-[var(--color-ink)]">{level}</p><p className="text-xs text-[var(--color-ink-faint)]">Level</p></div>
                  <div><p className="font-semibold capitalize text-[var(--color-ink)]">{style.replace("_", " ")}</p><p className="text-xs text-[var(--color-ink-faint)]">Style</p></div>
                </div>
                <p className="mt-3 text-center text-xs text-[var(--color-ink-faint)]">
                  Estimated time: ~{Math.round(preview.questions.reduce((s, q) => s + estimateMinutesFor(q), 0))} minutes
                </p>
              </>
            )}
          </div>
          {buildError && <p className="mt-3 text-xs text-[var(--color-coral)]">{buildError}</p>}
          <Button className="mt-5 w-full" disabled={!preview || preview.insufficientReason || starting} onClick={handleStart}>
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Challenge"}
          </Button>
        </div>
      )}

      {step < 4 && (
        <Button className="mt-8 w-full" disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>Continue</Button>
      )}
    </div>
  );
}
