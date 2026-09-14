import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, TrendingUp, TrendingDown, Minus, Sparkles, Flame, Info, ChevronDown, X } from "lucide-react";
import { getProgressOverview } from "../../lib/progressAnalytics.js";
import { startNewCycle, gradeRangeForScore } from "../../lib/predictionEngine.js";
import { getFirstConceptIdForSubtopicCode } from "../../lib/learn-tree.js";
import { STATUS_LABELS, PROGRESS_CONFIG } from "../../lib/progressConfig.js";
import Container from "../../components/ui/Container.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

// One colour per topic, reusing the app's EXISTING accent tokens only —
// no new colours invented for this page.
const TOPIC_HEX = { S1: "#2B7A6E", S2: "#3654D6", S3: "#7A4FB0", R1: "#C96A21", R2: "#B85C4A", R3: "#4B7A3D" };
const STATUS_TONE = { strong: "teal", revisit: "amber", performing_well: "indigo", priority: "coral", practise: "violet", not_assessed: "neutral", not_started: "neutral" };

export default function StudentProgressPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const studentLevel = profile?.level;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    getProgressOverview(studentLevel).then(setData).finally(() => setLoading(false));
  }, [studentLevel]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;
  }

  const hasAnyLearn = data.overallLearnedPercent > 0;
  const hasAnySolve = data.overallAssessedPercent != null;

  return (
    <Container className="py-8 md:py-10">
      <h1 className="font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">Your Progress</h1>
      <p className="mt-1.5 text-[15px] text-[var(--color-ink-soft)]">See what you've learned, how you're performing, and what to focus on next.</p>

      {/* Estimated IB Grade — the visual headline of this page */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
        <GradePlacard prediction={data.prediction} predictionTrend={data.predictionTrend} />
        <SupportingPerformancePanel data={data} />
      </div>

      <PredictionCycleControls userId={user?.id} data={data} onCycleChanged={reload} />

      {/* Top summary metrics */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard tone="indigo" value={hasAnyLearn ? `${data.overallLearnedPercent}%` : "0%"} label="Learning Progress" />
        <MetricCard tone="teal" value={data.accuracy != null ? `${data.accuracy}%` : "\u2014"} label="Accuracy" />
        <MetricCard tone="violet" value={data.questionsAttempted} label="Questions Attempted" />
        <MetricCard tone="amber" value={`\uD83D\uDD25 ${data.streak?.current_streak ?? 0} Day${(data.streak?.current_streak ?? 0) === 1 ? "" : "s"}`} label="Challenge Streak" />
      </div>

      {/* Syllabus map overview */}
      <div className="mt-8 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {data.topicStats.map((t) => (
          <button
            key={t.code}
            onClick={() => setExpanded(t.code === expanded ? null : t.code)}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-center shadow-[0_1px_2px_rgba(20,30,80,0.05)] transition-transform hover:-translate-y-px"
          >
            <p className="text-xs font-bold" style={{ color: TOPIC_HEX[t.code] }}>{t.code}</p>
            <p className="mt-1 text-lg font-bold text-[var(--color-ink)]">{t.learnedPercent}%</p>
          </button>
        ))}
      </div>

      {/* Two-panel: Learning Progress | Assessment Performance */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* LEFT — Learning Progress */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_12px_-4px_rgba(20,30,80,0.08)]">
          <p className="text-lg font-bold text-[var(--color-ink)]">Learning Progress</p>
          <p className="text-xs text-[var(--color-ink-faint)]">IB DP Chemistry &middot; {data.overallLearnedPercent}% complete</p>
          <ProgressBar percent={data.overallLearnedPercent} colorHex="#3654D6" className="mt-2" />

          <div className="mt-4 flex flex-col gap-1.5">
            {data.topicStats.map((t) => (
              <div key={t.code}>
                <button onClick={() => setExpanded(t.code === expanded ? null : t.code)} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[var(--color-line)]/15">
                  <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
                    <ChevronRight size={13} className={`shrink-0 text-[var(--color-ink-faint)] transition-transform ${expanded === t.code ? "rotate-90" : ""}`} />
                    {t.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="w-24"><ProgressBar percent={t.learnedPercent} colorHex={TOPIC_HEX[t.code]} /></span>
                    <span className="w-9 shrink-0 text-right text-xs font-semibold text-[var(--color-ink)]">{t.learnedPercent}%</span>
                  </span>
                </button>
                {expanded === t.code && (
                  <div className="ml-5 flex flex-col gap-1 border-l border-[var(--color-line)] py-1 pl-3">
                    {t.subtopics.map((s) => {
                      const conceptId = getFirstConceptIdForSubtopicCode(s.code);
                      return (
                        <div key={s.code} className="flex items-center justify-between gap-2 py-1 text-xs">
                          <span className="text-[var(--color-ink-soft)]">{s.code} {s.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-[var(--color-ink)]">{s.learnedPercent}%</span>
                            {conceptId && (
                              <Link to={`/student/learn/${conceptId}`} className="font-medium text-[var(--color-indigo)] hover:underline">
                                {s.learnedPercent > 0 ? "Continue" : "Start"}
                              </Link>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
          {!hasAnyLearn && <p className="mt-4 text-sm text-[var(--color-ink-faint)]">Complete a Learn concept to start tracking learning progress.</p>}
        </div>

        {/* RIGHT — Assessment Performance, now with Grade Readiness */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_12px_-4px_rgba(20,30,80,0.08)]">
          <p className="text-lg font-bold text-[var(--color-ink)]">Assessment Performance</p>
          <p className="text-xs text-[var(--color-ink-faint)]">{hasAnySolve ? `${data.overallAssessedPercent}% overall` : "Not assessed yet"}</p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <MiniStat value={data.challengesCompleted} label="Challenges" />
            <MiniStat value={data.questionsAttempted} label="Questions" />
            <MiniStat value={data.avgChallengeScore != null ? `${data.avgChallengeScore}%` : "\u2014"} label="Avg. Score" />
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            {data.topicStats.map((t) => (
              <div key={t.code} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2">
                <span className="text-sm font-medium text-[var(--color-ink)]">{t.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--color-ink)]">{t.assessedPercent != null ? `${t.assessedPercent}%` : "\u2014"}</span>
                  <GradeReadinessBadge topic={t} />
                  <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                </span>
              </div>
            ))}
          </div>
          {!hasAnySolve && <p className="mt-4 text-sm text-[var(--color-ink-faint)]">Take your first Challenge to see assessment performance.</p>}
        </div>
      </div>

      {/* Recommended for you */}
      {data.recommendation && (
        <div className="mt-8 rounded-2xl border border-[var(--color-indigo)]/15 bg-gradient-to-br from-[var(--color-indigo-soft)] via-[var(--color-violet-soft)] to-[var(--color-paper-raised)] p-5 shadow-[0_2px_4px_rgba(20,30,80,0.06),0_8px_20px_-6px_rgba(20,30,80,0.12)]">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-indigo)]"><Sparkles size={13} /> Recommended For You</p>
          <p className="mt-1.5 text-lg font-bold text-[var(--color-ink)]">
            {data.recommendation.kind === "strengthen" && `Strengthen ${data.recommendation.subtopic.label}`}
            {data.recommendation.kind === "continue" && `Continue ${data.recommendation.subtopic.label}`}
            {data.recommendation.kind === "challenge" && `Try a Challenge on ${data.recommendation.subtopic.label}`}
          </p>
          <div className="mt-3 flex gap-2.5">
            {data.recommendation.kind === "continue" ? (
              <Button size="sm" onClick={() => { const cid = getFirstConceptIdForSubtopicCode(data.recommendation.subtopic.code); if (cid) navigate(`/student/learn/${cid}`); }}>Continue Learning</Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/student/solve/new")}>Practice Topic</Button>
            )}
          </div>
        </div>
      )}

      {/* Learning x Performance */}
      <div className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-[0_1px_2px_rgba(20,30,80,0.05)]">
        <p className="text-lg font-bold text-[var(--color-ink)]">Learning &amp; Performance</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {data.subtopicStats.filter((s) => s.learnedPercent > 0 || s.attemptCount > 0).map((s) => (
            <div key={s.code} className="rounded-lg border border-[var(--color-line)] p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--color-ink)]">{s.code} {s.label}</span>
                <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</Badge>
              </div>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">Learned: {s.learnedPercent}% &middot; Assessment: {s.assessedPercent != null ? `${s.assessedPercent}%` : "\u2014"}</p>
            </div>
          ))}
          {data.subtopicStats.every((s) => s.learnedPercent === 0 && s.attemptCount === 0) && (
            <p className="text-sm text-[var(--color-ink-faint)]">Start learning or take a challenge to see this comparison.</p>
          )}
        </div>
      </div>

      {/* Strengths / Areas to Strengthen — enhanced with Grade Readiness, no duplicate section created */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-teal)]/20 bg-[var(--color-teal-soft)] p-5">
          <p className="text-sm font-bold text-[var(--color-teal)]">Your Strengths</p>
          {data.strengths.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No strengths identified yet — keep practising to build evidence.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {data.strengths.map((s) => (
                <div key={s.code} className="text-sm">
                  <span className="font-medium text-[var(--color-ink)]">{s.code} {s.label}</span>
                  <span className="ml-2 text-xs text-[var(--color-ink-faint)]">{s.assessedPercent}% &middot; {s.attemptCount} questions attempted</span>
                  {s.attemptCount >= PROGRESS_CONFIG.minAttemptsForStrength && (
                    <span className="ml-2 text-xs font-semibold text-[var(--color-teal)]">Grade {gradeRangeForScore(s.assessedPercent).isRange ? `${gradeRangeForScore(s.assessedPercent).low}\u2013${gradeRangeForScore(s.assessedPercent).high}` : gradeRangeForScore(s.assessedPercent).low} readiness</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-amber)]/20 bg-[var(--color-amber-soft)] p-5">
          <p className="text-sm font-bold text-[var(--color-amber)]">Areas to Strengthen</p>
          {data.areasToStrengthen.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--color-ink-faint)]">No areas flagged yet.</p>
          ) : (
            <div className="mt-2 flex flex-col gap-2.5">
              {data.areasToStrengthen.map((s) => {
                const conceptId = getFirstConceptIdForSubtopicCode(s.code);
                return (
                  <div key={s.code} className="rounded-lg bg-[var(--color-paper-raised)]/60 p-2.5 text-sm">
                    <p className="font-medium text-[var(--color-ink)]">{s.code} {s.label}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">
                      Learn: {s.learnedPercent}% &middot; Assessment: {s.assessedPercent}%
                      {s.attemptCount >= PROGRESS_CONFIG.minAttemptsForInsight && ` \u00b7 Grade ${gradeRangeForScore(s.assessedPercent).low} readiness`}
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      {conceptId && <Button size="sm" variant="secondary" onClick={() => navigate(`/student/learn/${conceptId}`)}>Review Concept</Button>}
                      <Button size="sm" onClick={() => navigate("/student/solve/new")}>Practice Topic</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {data.areasToStrengthen.length > 0 && (
        <ActionableStatement areasToStrengthen={data.areasToStrengthen} />
      )}

      {/* Question Outcomes — every value here reconciles exactly with the
          top metrics above, since both come from the same computation in
          progressAnalytics.js, not two separately-hand-calculated numbers. */}
      <div className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
        <p className="text-sm font-bold text-[var(--color-ink)]">Question Outcomes</p>
        <p className="text-[11px] text-[var(--color-ink-faint)]">
          Across {data.questionsAttempted + data.questionsUnattempted} questions in your submitted challenges
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <OutcomeStat tone="teal" value={data.questionsCorrect} label="Correct" />
          <OutcomeStat tone="coral" value={data.questionsWrong} label="Wrong" />
          <OutcomeStat tone="amber" value={data.questionsNeedsReview} label="Needs Review" />
          <OutcomeStat tone="neutral" value={data.questionsUnattempted} label="Unattempted" />
        </div>
        {data.questionsAttempted + data.questionsUnattempted > 0 && (
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--color-line)]" role="img" aria-label={`${data.questionsCorrect} correct, ${data.questionsWrong} wrong, ${data.questionsNeedsReview} needing review, ${data.questionsUnattempted} unattempted`}>
            {[
              { count: data.questionsCorrect, color: "var(--color-teal)" },
              { count: data.questionsWrong, color: "var(--color-coral)" },
              { count: data.questionsNeedsReview, color: "var(--color-amber)" },
              { count: data.questionsUnattempted, color: "var(--color-line)" },
            ].map((seg, i) => {
              const total = data.questionsAttempted + data.questionsUnattempted;
              const pct = total > 0 ? (seg.count / total) * 100 : 0;
              return pct > 0 ? <div key={i} style={{ width: `${pct}%`, backgroundColor: seg.color }} /> : null;
            })}
          </div>
        )}
      </div>

      {/* Performance trend + Recent activity */}
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-ink)]"><TrendingUp size={15} /> Challenge Performance</p>
          {data.trend.length < 2 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-faint)]">Complete a few more challenges to see a trend.</p>
          ) : (
            <TrendChart points={data.trend} />
          )}
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
          <p className="text-sm font-bold text-[var(--color-ink)]">Recent Activity</p>
          {data.recentActivity.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-ink-faint)]">No activity yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {data.recentActivity.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {e.type === "challenge" ? <Flame size={13} className="shrink-0 text-[var(--color-amber)]" /> : <Sparkles size={13} className="shrink-0 text-[var(--color-indigo)]" />}
                  <span className="text-[var(--color-ink-soft)]">{e.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-[var(--color-ink-faint)]">{new Date(e.at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PreviousCyclesSection allCycles={data.allCycles} activeCycle={data.activeCycle} />
    </Container>
  );
}

// ============================================================
// Estimated IB Grade placard
// ============================================================

const TREND_ICON = { improving: TrendingUp, declining: TrendingDown, stable: Minus };
const TREND_LABEL = { improving: "Improving", declining: "Declining", stable: "Stable" };
const CONFIDENCE_LABEL = { low: "Low Confidence", medium: "Medium Confidence", high: "High Confidence" };

function GradePlacard({ prediction, predictionTrend }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!prediction?.hasEstimate) {
    const remainingChallenges = Math.max(0, (prediction?.requiredChallenges ?? 0) - (prediction?.evidenceChallenges ?? 0));
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-center shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_12px_-4px_rgba(20,30,80,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Estimated IB Grade</p>
        <p className="mt-2 font-[var(--font-display)] text-6xl font-bold text-[var(--color-ink-faint)]">&mdash;</p>
        <p className="mt-2 text-sm font-semibold text-[var(--color-ink-soft)]">Building Estimate</p>
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          {remainingChallenges > 0 ? `Complete ${remainingChallenges} more Challenge${remainingChallenges === 1 ? "" : "s"}` : "Complete Challenges across more syllabus areas"}
        </p>
        <p className="mt-2 text-[11px] text-[var(--color-ink-faint)]">
          {prediction?.evidenceChallenges ?? 0} / {prediction?.requiredChallenges ?? 3} Challenges &middot; {prediction?.subtopicsWithEvidence ?? 0} / {prediction?.requiredSyllabusAreas ?? 2} syllabus areas
        </p>
      </div>
    );
  }

  const TrendIcon = predictionTrend ? TREND_ICON[predictionTrend] : null;
  const gradeDisplay = prediction.isRange ? `${prediction.estimatedGradeLow}\u2013${prediction.estimatedGradeHigh}` : prediction.estimatedGrade;

  return (
    <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-6 text-center shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_12px_-4px_rgba(20,30,80,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Estimated IB Grade</p>
      <p className="mt-1 font-[var(--font-display)] font-bold leading-none text-[var(--color-ink)]" style={{ fontSize: "5rem" }}>{gradeDisplay}</p>

      {TrendIcon && (
        <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-[var(--color-ink-soft)]">
          <TrendIcon size={13} /> {TREND_LABEL[predictionTrend]}
        </p>
      )}

      <p className="mt-1.5 text-xs font-medium text-[var(--color-ink-faint)]">{CONFIDENCE_LABEL[prediction.confidence]}</p>

      <p className="mt-3 text-[11px] text-[var(--color-ink-faint)]">Based on {prediction.evidenceChallenges} Challenges</p>
      <p className="text-[11px] text-[var(--color-ink-faint)]">Syllabus Coverage: {Math.round(prediction.syllabusCoverage)}%</p>

      <button type="button" onClick={() => setShowInfo(true)} className="mt-3 flex items-center gap-1 text-[11px] font-medium text-[var(--color-indigo)] hover:underline">
        <Info size={12} /> How it works
      </button>

      {showInfo && <InfoModal onClose={() => setShowInfo(false)} />}
    </div>
  );
}

function InfoModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-w-sm rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-bold text-[var(--color-ink)]">About your Estimated IB Grade</p>
          <button type="button" onClick={onClose} className="shrink-0 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={16} /></button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
          Your estimated grade is based on your performance in e-Lab Challenges, recent results, question difficulty and syllabus coverage. As you complete more assessments, the estimate becomes more reliable. This is an e-Lab learning estimate and is not an official IB or school predicted grade.
        </p>
        <Button size="sm" className="mt-4" onClick={onClose}>Got it</Button>
      </div>
    </div>
  );
}

function SupportingPerformancePanel({ data }) {
  const { prediction, gradeTrendPoints } = data;
  const gradeSequence = gradeTrendPoints
    .map((s) => (s.estimated_grade != null ? String(s.estimated_grade) : s.estimated_grade_low != null ? `${s.estimated_grade_low}\u2013${s.estimated_grade_high}` : null))
    .filter(Boolean)
    .slice(-6);

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-[0_1px_2px_rgba(20,30,80,0.05),0_4px_12px_-4px_rgba(20,30,80,0.08)]">
      <p className="text-sm font-bold text-[var(--color-ink)]">Current Performance</p>
      <div className="mt-3 flex flex-col gap-2.5">
        <SupportingRow label="Challenge Performance" value={prediction.hasEstimate ? `${Math.round(prediction.overallPerformance)}%` : "\u2014"} />
        <SupportingRow label="Syllabus Coverage" value={prediction.hasEstimate ? `${Math.round(prediction.syllabusCoverage)}%` : "\u2014"} />
        <SupportingRow label="Recent Performance" value={prediction.hasEstimate ? `${Math.round(prediction.recentPerformance)}%` : "\u2014"} />
        <SupportingRow label="Challenges Completed" value={data.challengesCompleted} />
      </div>
      {gradeSequence.length >= 2 && (
        <div className="mt-4 border-t border-[var(--color-line)] pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Grade Trend</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{gradeSequence.join(" \u2192 ")}</p>
        </div>
      )}
    </div>
  );
}

function SupportingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      <span className="font-semibold text-[var(--color-ink)]">{value}</span>
    </div>
  );
}

// ============================================================
// Prediction cycle controls
// ============================================================

function PredictionCycleControls({ userId, data, onCycleChanged }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const { activeCycle, cooldown } = data;

  async function handleConfirmStart() {
    setStarting(true);
    setError(null);
    try {
      await startNewCycle(userId);
      setShowConfirm(false);
      onCycleChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 px-4 py-2.5 text-xs">
      <div className="text-[var(--color-ink-soft)]">
        <span className="font-semibold text-[var(--color-ink)]">Current Prediction Cycle</span>
        {activeCycle ? (
          <span> &middot; Started {new Date(activeCycle.started_at).toLocaleDateString()} &middot; {data.prediction?.evidenceChallenges ?? 0} Challenges</span>
        ) : (
          <span> &middot; Not started yet</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!cooldown.allowed && cooldown.availableAt && (
          <span className="text-[var(--color-ink-faint)]">New cycle available {cooldown.availableAt.toLocaleDateString()}</span>
        )}
        <button
          type="button"
          disabled={!cooldown.allowed}
          onClick={() => setShowConfirm(true)}
          className="font-semibold text-[var(--color-indigo)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-ink-faint)] disabled:no-underline"
        >
          Start New Cycle
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !starting && setShowConfirm(false)}>
          <div className="max-w-sm rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 text-left shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-[var(--color-ink)]">Start a new prediction cycle?</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
              Your Learn progress, Challenge history and previous results will remain saved. Only new Challenge performance will be used to build your current Estimated IB Grade.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
              This is useful when you want a fresh measure of your current performance, especially during final DP revision.
            </p>
            {error && <p className="mt-2 text-sm text-[var(--color-coral)]">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setShowConfirm(false)} disabled={starting}>Cancel</Button>
              <Button size="sm" onClick={handleConfirmStart} disabled={starting}>{starting ? "Starting\u2026" : "Start New Cycle"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviousCyclesSection({ allCycles, activeCycle }) {
  const [open, setOpen] = useState(false);
  const previous = allCycles.filter((c) => c.id !== activeCycle?.id);
  if (previous.length === 0) return null;

  return (
    <div className="mt-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span className="text-sm font-bold text-[var(--color-ink)]">Previous Prediction Cycles</span>
        <ChevronDown size={15} className={`text-[var(--color-ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          {previous.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm">
              <span className="font-medium text-[var(--color-ink)]">Cycle {c.cycle_number}</span>
              <span className="text-xs text-[var(--color-ink-faint)]">
                {new Date(c.started_at).toLocaleDateString()} &ndash; {c.ended_at ? new Date(c.ended_at).toLocaleDateString() : "Current"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Grade Readiness — reuses the SAME deterministic grade/range logic as
// the main placard (predictionEngine.js), never a separate calculation.
// ============================================================

function GradeReadinessBadge({ topic }) {
  if (topic.assessedPercent == null || topic.attemptCount < PROGRESS_CONFIG.minAttemptsForInsight) {
    return <span className="text-[10px] text-[var(--color-ink-faint)]">More data needed</span>;
  }
  const { low, high, isRange } = gradeRangeForScore(topic.assessedPercent);
  return (
    <span className="rounded-full bg-[var(--color-indigo-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-indigo)]">
      Grade {isRange ? `${low}\u2013${high}` : low}
    </span>
  );
}

function ActionableStatement({ areasToStrengthen }) {
  const eligible = areasToStrengthen.filter((s) => s.attemptCount >= PROGRESS_CONFIG.minAttemptsForInsight);
  const insufficientEvidence = areasToStrengthen.filter((s) => s.attemptCount < PROGRESS_CONFIG.minAttemptsForInsight);
  if (eligible.length === 0 && insufficientEvidence.length === 0) return null;

  const nextGrade = Math.min(7, Math.max(...eligible.map((s) => gradeRangeForScore(s.assessedPercent).high), 5) + 1);
  const parts = [];
  if (eligible.length > 0) parts.push(`Improve performance in ${eligible.map((s) => s.label).join(" and ")}`);
  if (insufficientEvidence.length > 0) parts.push(`complete more assessment evidence in ${insufficientEvidence.map((s) => s.label).join(" and ")}`);

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 p-3 text-sm">
      <span className="font-semibold text-[var(--color-ink)]">To move towards Grade {nextGrade}: </span>
      <span className="text-[var(--color-ink-soft)]">{parts.join(", and ")}.</span>
    </div>
  );
}

function MetricCard({ tone, value, label }) {
  const TONES = { indigo: "bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]", teal: "bg-[var(--color-teal-soft)] text-[var(--color-teal)]", violet: "bg-[var(--color-violet-soft)] text-[var(--color-violet)]", amber: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]" };
  return (
    <div className={`rounded-xl border border-[var(--color-line)] p-4 shadow-[0_1px_2px_rgba(20,30,80,0.05)] ${TONES[tone]}`}>
      <p className="text-lg font-bold text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] py-2">
      <p className="text-sm font-bold text-[var(--color-ink)]">{value}</p>
      <p className="text-[10px] text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function OutcomeStat({ tone, value, label }) {
  const DOT = { teal: "var(--color-teal)", coral: "var(--color-coral)", amber: "var(--color-amber)", neutral: "var(--color-ink-faint)" };
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: DOT[tone] }} />
        <p className="text-lg font-bold text-[var(--color-ink)]">{value}</p>
      </div>
      <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{label}</p>
    </div>
  );
}

function ProgressBar({ percent, colorHex, className = "" }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--color-line)] ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: colorHex }} />
    </div>
  );
}

function TrendChart({ points }) {
  const w = 320, h = 110, padL = 28, padR = 8, padT = 8, padB = 20;
  const max = 100;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const coords = points.map((p, i) => [padL + i * stepX, padT + plotH - (p.percent / max) * plotH]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const yTicks = [0, 50, 100];

  return (
    <div className="mt-1">
      <p className="text-[11px] text-[var(--color-ink-faint)]">Score (%) over your last {points.length} submitted challenges</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full" role="img" aria-label={`Line chart of challenge score percentage over the last ${points.length} challenges, y-axis 0 to 100 percent`}>
        {yTicks.map((t) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
              <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-ink-faint)">{t}%</text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#3654D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="#3654D6">
            <title>{`Challenge ${i + 1}: ${points[i].percent}%${points[i].date ? ` \u2014 ${new Date(points[i].date).toLocaleDateString()}` : ""}`}</title>
          </circle>
        ))}
        <text x={(padL + w - padR) / 2} y={h - 4} textAnchor="middle" fontSize="8" fill="var(--color-ink-faint)">Challenge (oldest \u2192 most recent)</text>
      </svg>
    </div>
  );
}
