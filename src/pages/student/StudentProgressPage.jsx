import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, TrendingUp, Sparkles, Flame } from "lucide-react";
import { getProgressOverview } from "../../lib/progressAnalytics.js";
import { getFirstConceptIdForSubtopicCode } from "../../lib/learn-tree.js";
import { STATUS_LABELS } from "../../lib/progressConfig.js";
import Container from "../../components/ui/Container.jsx";
import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";

// One colour per topic, reusing the app's EXISTING accent tokens only —
// no new colours invented for this page.
const TOPIC_HEX = { S1: "#2B7A6E", S2: "#3654D6", S3: "#7A4FB0", R1: "#C96A21", R2: "#B85C4A", R3: "#4B7A3D" };
const STATUS_TONE = { strong: "teal", revisit: "amber", performing_well: "indigo", priority: "coral", practise: "violet", not_assessed: "neutral", not_started: "neutral" };

export default function StudentProgressPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getProgressOverview().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>;
  }

  const hasAnyLearn = data.overallLearnedPercent > 0;
  const hasAnySolve = data.overallAssessedPercent != null;

  return (
    <Container className="py-8 md:py-10">
      <h1 className="font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">Your Progress</h1>
      <p className="mt-1.5 text-[15px] text-[var(--color-ink-soft)]">See what you've learned, how you're performing, and what to focus on next.</p>

      {/* Top summary metrics */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard tone="indigo" value={hasAnyLearn ? `${data.overallLearnedPercent}%` : "0%"} label="Learning Progress" />
        <MetricCard tone="teal" value={hasAnySolve ? `${data.overallAssessedPercent}%` : "\u2014"} label="Assessment Performance" />
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

        {/* RIGHT — Assessment Performance */}
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

      {/* Strengths / Areas to Strengthen */}
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
                    <p className="text-xs text-[var(--color-ink-faint)]">Learn: {s.learnedPercent}% &middot; Assessment: {s.assessedPercent}%</p>
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
    </Container>
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

function ProgressBar({ percent, colorHex, className = "" }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[var(--color-line)] ${className}`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: colorHex }} />
    </div>
  );
}

function TrendChart({ points }) {
  const w = 300, h = 80, pad = 6;
  const max = 100;
  const stepX = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - (p.percent / max) * (h - pad * 2)]);
  const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Challenge performance trend over recent challenges">
      <path d={path} fill="none" stroke="#3654D6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill="#3654D6" />)}
    </svg>
  );
}
