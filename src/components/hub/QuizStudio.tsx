'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Cloud,
  Flag,
  Layers,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { isStudySubjectId, STUDY_SUBJECTS, SUBJECT_BY_ID } from '@/lib/study/curriculum';
import { useLocalStudySnapshot, writeLocalStudyProgress } from '@/lib/study/local-storage';
import { getQuizQuestions, QUIZ_QUESTIONS } from '@/lib/study/quizzes';
import { gradeQuizSubmission } from '@/lib/study/scoring';
import type {
  CustomFlashcardRecord,
  GradedQuestionResult,
  QuizAttemptRecord,
  QuizGradingSummary,
  QuizMode,
  QuizQuestion,
  QuizSubjectFilter,
  QuizTierFilter,
  StudyProgressPayload,
} from '@/lib/study/types';
import type { Profile } from '@/lib/types';

function formatTimer(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function QuizStudio({
  profile,
  initialStudy,
  initialSubject,
}: {
  profile: Profile | null;
  initialStudy: StudyProgressPayload;
  initialSubject?: string;
}) {
  const isApproved = profile?.verification_status === 'approved';
  const localScope = profile ? profile.id : 'guest';
  const localStudy = useLocalStudySnapshot(localScope);
  const [cloudStudy, setCloudStudy] = useState<StudyProgressPayload>(initialStudy);

  const study: StudyProgressPayload = cloudStudy.synced
    ? cloudStudy
    : localStudy.attempts.length || localStudy.customCards.length || localStudy.reviews.length
      ? { ...localStudy, synced: false, migrationRequired: cloudStudy.migrationRequired }
      : cloudStudy;

  const [selectedSubject, setSelectedSubject] = useState<QuizSubjectFilter>(
    initialSubject === 'mixed'
      ? 'mixed'
      : isStudySubjectId(initialSubject)
        ? initialSubject
        : 'biology'
  );
  const [tier, setTier] = useState<QuizTierFilter>('all');
  const [mode, setMode] = useState<QuizMode>('practice');
  const [questionLimit, setQuestionLimit] = useState<'5' | 'all'>('5');
  const [timed, setTimed] = useState(false);

  // Active quiz session state
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savedFlashcardIds, setSavedFlashcardIds] = useState<Record<string, boolean>>({});

  // Results state
  const [lastGrading, setLastGrading] = useState<QuizGradingSummary | null>(null);
  const [lastAttempt, setLastAttempt] = useState<QuizAttemptRecord | null>(null);
  const [lastPersistedCloud, setLastPersistedCloud] = useState(false);

  const startedAtRef = useRef<number>(0);
  const autoSubmittedRef = useRef<boolean>(false);
  const finishQuizRef = useRef<() => Promise<void>>(async () => {});

  const availableQuestions = useMemo(
    () =>
      getQuizQuestions({
        subjectId: selectedSubject,
        tier,
        limit: questionLimit === '5' ? 5 : undefined,
      }),
    [selectedSubject, tier, questionLimit]
  );

  const totalTimeLimitSeconds = questions.length * 60;
  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => selectedAnswers[q.id] !== undefined).length;

  useEffect(() => {
    if (phase !== 'active') return;
    const interval = window.setInterval(() => {
      const nextElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsedSeconds(nextElapsed);
      if (
        timed &&
        totalTimeLimitSeconds > 0 &&
        nextElapsed >= totalTimeLimitSeconds &&
        !autoSubmittedRef.current
      ) {
        autoSubmittedRef.current = true;
        toast.info('Time is up! Grading your answered questions.');
        void finishQuizRef.current();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase, timed, totalTimeLimitSeconds]);

  function startQuiz(customPool?: QuizQuestion[]) {
    const pool = customPool ?? availableQuestions;
    if (!pool.length) {
      toast.error('No questions match this filter. Try switching Cambridge Tier to All.');
      return;
    }
    setQuestions(pool);
    setCurrentIndex(0);
    setSelectedAnswers({});
    setCheckedQuestions({});
    setFlaggedQuestions({});
    setElapsedSeconds(0);
    setLastGrading(null);
    setLastAttempt(null);
    setSavedFlashcardIds({});
    startedAtRef.current = Date.now();
    autoSubmittedRef.current = false;
    setPhase('active');
  }

  function selectOption(optionIndex: number) {
    if (!currentQuestion) return;
    if (mode === 'practice' && checkedQuestions[currentQuestion.id]) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
  }

  function checkCurrentPracticeAnswer() {
    if (!currentQuestion) return;
    if (selectedAnswers[currentQuestion.id] === undefined) {
      toast.error('Select an answer option first.');
      return;
    }
    setCheckedQuestions((prev) => ({ ...prev, [currentQuestion.id]: true }));
  }

  async function finishAndGradeQuiz() {
    const submissions = questions
      .filter((q) => selectedAnswers[q.id] !== undefined)
      .map((q) => ({ questionId: q.id, selectedIndex: selectedAnswers[q.id] }));

    if (!submissions.length) {
      toast.error('Answer at least one question before grading.');
      return;
    }

    const duration = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000));
    setSubmitting(true);

    try {
      let grading: QuizGradingSummary;
      let attempt: QuizAttemptRecord;
      let persistedCloud = false;

      if (isApproved) {
        const res = await fetch('/api/study/quizzes/attempts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subjectId: selectedSubject,
            tier,
            mode,
            durationSeconds: duration,
            answers: submissions,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not grade quiz attempt.');
        grading = data.grading as QuizGradingSummary;
        attempt = data.attempt as QuizAttemptRecord;
        persistedCloud = Boolean(data.persisted);
      } else {
        grading = gradeQuizSubmission(submissions);
        attempt = {
          id: `local-${Date.now()}`,
          subject_id: selectedSubject,
          tier,
          mode,
          score: grading.score,
          total_questions: grading.totalQuestions,
          percentage: grading.percentage,
          grade_band: grading.gradeBand,
          duration_seconds: duration,
          weak_topics: grading.weakTopics,
          created_at: new Date().toISOString(),
        };
      }

      setLastGrading(grading);
      setLastAttempt(attempt);
      setLastPersistedCloud(persistedCloud);

      const nextAttempts = [attempt, ...study.attempts].slice(0, 100);
      if (persistedCloud) {
        setCloudStudy((prev) => ({ ...prev, attempts: nextAttempts, synced: true }));
      } else {
        writeLocalStudyProgress(localScope, {
          attempts: nextAttempts,
          customCards: study.customCards,
          reviews: study.reviews,
        });
      }

      setPhase('results');
      toast.success(
        `Scored ${grading.score}/${grading.totalQuestions} (${grading.percentage}% · Grade ${grading.gradeBand})`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to grade quiz right now.');
    } finally {
      setSubmitting(false);
    }
  }

  async function saveQuestionAsFlashcard(result: GradedQuestionResult) {
    if (savedFlashcardIds[result.questionId]) return;
    const correctOption = result.options[result.correctIndex];
    const front = result.prompt.slice(0, 390);
    const back = `${correctOption} — ${result.explanation}`.slice(0, 790);
    const hint = result.examTip.slice(0, 230);

    try {
      if (isApproved) {
        const res = await fetch('/api/study/flashcards', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subjectId: result.subjectId,
            topic: result.topic,
            front,
            back,
            hint,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save flashcard.');
        const savedCard = data.card as CustomFlashcardRecord;
        const nextCards = [savedCard, ...study.customCards];
        if (data.persisted) {
          setCloudStudy((prev) => ({ ...prev, customCards: nextCards }));
        } else {
          writeLocalStudyProgress(localScope, {
            attempts: study.attempts,
            customCards: nextCards,
            reviews: study.reviews,
          });
        }
      } else {
        const nowIso = new Date().toISOString();
        const localCard: CustomFlashcardRecord = {
          id: crypto.randomUUID(),
          subject_id: result.subjectId,
          topic: result.topic,
          front,
          back,
          hint,
          created_at: nowIso,
          updated_at: nowIso,
        };
        const nextCards = [localCard, ...study.customCards];
        writeLocalStudyProgress(localScope, {
          attempts: study.attempts,
          customCards: nextCards,
          reviews: study.reviews,
        });
      }
      setSavedFlashcardIds((prev) => ({ ...prev, [result.questionId]: true }));
      toast.success('Saved to your Flashcards deck for spaced review.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save flashcard.');
    }
  }

  useEffect(() => {
    finishQuizRef.current = finishAndGradeQuiz;
  });

  // Keyboard shortcuts during active quiz
  useEffect(() => {
    if (phase !== 'active' || !currentQuestion) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        if (mode === 'practice' && checkedQuestions[currentQuestion.id]) return;
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: idx }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, currentQuestion, mode, checkedQuestions]);

  const subjectStats = useMemo(() => {
    const map = new Map<string, { attempts: number; best: number | null }>();
    for (const subject of STUDY_SUBJECTS) {
      const relevant = study.attempts.filter((a) => a.subject_id === subject.id);
      map.set(subject.id, {
        attempts: relevant.length,
        best: relevant.length ? Math.max(...relevant.map((r) => r.percentage)) : null,
      });
    }
    const mixedRelevant = study.attempts.filter((a) => a.subject_id === 'mixed');
    map.set('mixed', {
      attempts: mixedRelevant.length,
      best: mixedRelevant.length ? Math.max(...mixedRelevant.map((r) => r.percentage)) : null,
    });
    return map;
  }, [study.attempts]);

  // =================== SETUP VIEW ===================
  if (phase === 'setup') {
    const activeSubjectMeta = selectedSubject !== 'mixed' ? SUBJECT_BY_ID[selectedSubject] : null;
    return (
      <div className="study-studio" data-testid="quiz-studio">
        <div className="page-heading">
          <div>
            <p className="eyebrow">WISE OWL HUB 5.0 · CAMBRIDGE IGCSE ASSESSMENTS</p>
            <h1>Interactive Subject Quizzes.</h1>
            <p>
              Test your mastery across 8 Cambridge IGCSE subjects with server-verified scoring, grade band estimates (A*–U), topic diagnostics, and instant OwlAid explanations.
            </p>
          </div>
          <div className="heading-actions">
            <Link className="button secondary" href="/hub">
              <ArrowLeft size={16} /> Student Hub
            </Link>
            <Link className="button secondary" href="/flashcards">
              <Layers size={16} /> Flashcards
            </Link>
          </div>
        </div>

        {/* SUBJECT SELECTOR GRID */}
        <section className="quiz-subject-grid" aria-label="Choose quiz subject">
          {STUDY_SUBJECTS.map((subject) => {
            const count = QUIZ_QUESTIONS.filter((q) => q.subjectId === subject.id).length;
            const stat = subjectStats.get(subject.id);
            const active = selectedSubject === subject.id;
            return (
              <button
                key={subject.id}
                type="button"
                className={`panel quiz-subject-tile ${active ? 'is-selected' : ''}`}
                onClick={() => setSelectedSubject(subject.id)}
                data-testid={`quiz-subject-${subject.id}`}
                aria-pressed={active}
              >
                <div className="quiz-subject-tile-top">
                  <span className="pill-subtle">{subject.syllabusCode}</span>
                  {stat?.best !== null && stat?.best !== undefined && (
                    <span className="quiz-best-pill">Best {stat.best}%</span>
                  )}
                </div>
                <strong>{subject.name}</strong>
                <span className="muted-tiny">
                  {count} IGCSE questions · {stat?.attempts ?? 0} attempt{stat?.attempts === 1 ? '' : 's'}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            className={`panel quiz-subject-tile mixed-tile ${selectedSubject === 'mixed' ? 'is-selected' : ''}`}
            onClick={() => setSelectedSubject('mixed')}
            data-testid="quiz-subject-mixed"
            aria-pressed={selectedSubject === 'mixed'}
          >
            <div className="quiz-subject-tile-top">
              <span className="pill-subtle">ALL 8 SUBJECTS</span>
              {subjectStats.get('mixed')?.best !== null && subjectStats.get('mixed')?.best !== undefined && (
                <span className="quiz-best-pill">Best {subjectStats.get('mixed')?.best}%</span>
              )}
            </div>
            <strong>Mixed IGCSE Challenge</strong>
            <span className="muted-tiny">Cross-subject readiness diagnostic ({QUIZ_QUESTIONS.length} bank)</span>
          </button>
        </section>

        {/* QUIZ CONFIGURATION PANEL */}
        <section className="panel quiz-config-panel" aria-label="Quiz settings">
          <div className="quiz-config-header">
            <div>
              <p className="eyebrow">QUIZ CONFIGURATION</p>
              <h2>
                {activeSubjectMeta
                  ? `${activeSubjectMeta.name} (${activeSubjectMeta.syllabusCode})`
                  : 'Mixed Cambridge IGCSE Readiness Challenge'}
              </h2>
              <p className="muted">
                {availableQuestions.length} question{availableQuestions.length === 1 ? '' : 's'} ready with Cambridge mark-scheme explanations.
              </p>
            </div>
            <button
              type="button"
              className="button primary"
              onClick={() => startQuiz()}
              disabled={availableQuestions.length === 0}
              data-testid="start-quiz-button"
            >
              <ClipboardCheck size={18} /> Start Quiz ({availableQuestions.length} Qs)
            </button>
          </div>

          <div className="quiz-config-grid">
            <label>
              <span>Cambridge Tier</span>
              <select value={tier} onChange={(e) => setTier(e.target.value as QuizTierFilter)}>
                <option value="all">All Tiers (Core + Extended)</option>
                <option value="core">Core Only</option>
                <option value="extended">Extended Only</option>
              </select>
            </label>

            <label>
              <span>Feedback Style</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as QuizMode)}>
                <option value="practice">Practice (Instant mark-scheme feedback)</option>
                <option value="exam">Exam Simulation (Grade at end)</option>
              </select>
            </label>

            <label>
              <span>Quiz Length</span>
              <select value={questionLimit} onChange={(e) => setQuestionLimit(e.target.value as '5' | 'all')}>
                <option value="5">Quick Sprint (5 Questions)</option>
                <option value="all">Full Subject Set ({selectedSubject === 'mixed' ? 'All 64' : 'All 8'})</option>
              </select>
            </label>

            <label>
              <span>Timer Mode</span>
              <select value={timed ? 'timed' : 'untimed'} onChange={(e) => setTimed(e.target.value === 'timed')}>
                <option value="untimed">Untimed Study</option>
                <option value="timed">Timed Exam (60s per question)</option>
              </select>
            </label>
          </div>
        </section>

        {/* RECENT ATTEMPTS HISTORY */}
        <section className="home-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR SCORING RECORD</p>
              <h2>Recent Quiz Attempts</h2>
            </div>
            {isApproved && study.synced ? (
              <span className="pill-subtle hub-sync-pill"><Cloud size={13} /> Cloud Synced</span>
            ) : (
              <span className="pill-subtle">Saved locally in browser</span>
            )}
          </div>

          {study.attempts.length > 0 ? (
            <div className="panel">
              <ul className="hub-attempt-list" data-testid="quiz-history-list">
                {study.attempts.slice(0, 10).map((attempt) => {
                  const label =
                    attempt.subject_id === 'mixed'
                      ? 'Mixed IGCSE Challenge'
                      : SUBJECT_BY_ID[attempt.subject_id]?.name ?? attempt.subject_id;
                  return (
                    <li key={attempt.id} className="hub-attempt-row">
                      <div>
                        <strong>{label}</strong>
                        <span className="muted-tiny">
                          {attempt.score}/{attempt.total_questions} correct · {attempt.tier} · {attempt.mode} · {formatTimer(attempt.duration_seconds)}
                        </span>
                      </div>
                      <div className="hub-attempt-right">
                        <span className="hub-grade-badge has-grade">{attempt.grade_band}</span>
                        <strong>{attempt.percentage}%</strong>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="panel hub-empty-compact">
              <Sparkles size={22} />
              <p>No scored quizzes yet. Pick a subject above and start your first Cambridge IGCSE quiz.</p>
            </div>
          )}
        </section>
      </div>
    );
  }

  // =================== ACTIVE QUIZ RUNNER ===================
  if (phase === 'active' && currentQuestion) {
    const selectedIdx = selectedAnswers[currentQuestion.id];
    const isChecked = mode === 'practice' && Boolean(checkedQuestions[currentQuestion.id]);
    const isLast = currentIndex === questions.length - 1;
    const subjectMeta = SUBJECT_BY_ID[currentQuestion.subjectId];
    const remainingSeconds = Math.max(0, totalTimeLimitSeconds - elapsedSeconds);

    return (
      <div className="study-studio" data-testid="quiz-runner">
        <div className="quiz-runner-topbar">
          <button type="button" className="text-link" onClick={() => setPhase('setup')}>
            <ArrowLeft size={16} /> Exit Quiz
          </button>

          <div className="quiz-runner-meta">
            <span className="pill-subtle">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="pill-subtle">
              <Clock3 size={13} />{' '}
              {timed ? `${formatTimer(remainingSeconds)} left` : formatTimer(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div
          className="hub-progress-track quiz-progress-bar"
          role="progressbar"
          aria-valuenow={Math.round(((currentIndex + 1) / questions.length) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Quiz progress"
        >
          <div
            className="hub-progress-fill"
            style={{ width: `${Math.round(((currentIndex + 1) / questions.length) * 100)}%` }}
          />
        </div>

        <div className="quiz-question-dots" role="navigation" aria-label="Question navigator">
          {questions.map((q, idx) => {
            const answered = selectedAnswers[q.id] !== undefined;
            const flagged = Boolean(flaggedQuestions[q.id]);
            const checked = mode === 'practice' && Boolean(checkedQuestions[q.id]);
            const correct = checked && selectedAnswers[q.id] === q.correctIndex;
            const wrong = checked && selectedAnswers[q.id] !== q.correctIndex;
            return (
              <button
                key={q.id}
                type="button"
                className={`quiz-dot ${idx === currentIndex ? 'is-current' : ''} ${answered ? 'is-answered' : ''} ${flagged ? 'is-flagged' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Jump to question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <article className="panel quiz-question-card">
          <div className="quiz-card-meta">
            <div className="badge-cluster">
              <span className="pill-subtle">{subjectMeta.name} · {currentQuestion.syllabusRef}</span>
              <span className="pill-subtle">{currentQuestion.topic}</span>
              <span className="pill-subtle">{currentQuestion.difficulty === 'extended' ? 'Extended' : 'Core'}</span>
            </div>
            <button
              type="button"
              className={`button secondary tiny ${flaggedQuestions[currentQuestion.id] ? 'is-flagged-btn' : ''}`}
              onClick={() =>
                setFlaggedQuestions((prev) => ({
                  ...prev,
                  [currentQuestion.id]: !prev[currentQuestion.id],
                }))
              }
            >
              <Flag size={13} /> {flaggedQuestions[currentQuestion.id] ? 'Flagged' : 'Flag'}
            </button>
          </div>

          <h2 className="quiz-prompt" data-testid="quiz-question-prompt">
            {currentQuestion.prompt}
          </h2>

          <div className="quiz-options-list" role="radiogroup" aria-label="Answer options">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = selectedIdx === idx;
              const isCorrectOption = idx === currentQuestion.correctIndex;
              let stateClass = '';
              if (isChecked) {
                if (isCorrectOption) stateClass = 'option-correct';
                else if (isSelected && !isCorrectOption) stateClass = 'option-wrong';
              } else if (isSelected) {
                stateClass = 'option-selected';
              }
              return (
                <button
                  key={idx}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={isChecked}
                  className={`quiz-option-button ${stateClass}`}
                  onClick={() => selectOption(idx)}
                  data-testid={`quiz-option-${idx}`}
                >
                  <span className="quiz-option-letter">{String.fromCharCode(65 + idx)}</span>
                  <span className="quiz-option-text">{option}</span>
                  {isChecked && isCorrectOption && <CheckCircle2 size={18} className="option-icon-ok" />}
                  {isChecked && isSelected && !isCorrectOption && <XCircle size={18} className="option-icon-bad" />}
                </button>
              );
            })}
          </div>

          {isChecked && (
            <div
              className={`quiz-feedback-box ${selectedIdx === currentQuestion.correctIndex ? 'feedback-correct' : 'feedback-wrong'}`}
              role="status"
              data-testid="quiz-instant-feedback"
            >
              <strong>
                {selectedIdx === currentQuestion.correctIndex
                  ? 'Correct! Well done.'
                  : `Not quite — correct answer: ${String.fromCharCode(65 + currentQuestion.correctIndex)}`}
              </strong>
              <p>{currentQuestion.explanation}</p>
              <p className="quiz-exam-tip">
                <strong>Examiner Tip:</strong> {currentQuestion.examTip}
              </p>
            </div>
          )}

          <div className="quiz-runner-actions">
            <button
              type="button"
              className="button secondary"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            >
              <ArrowLeft size={16} /> Previous
            </button>

            <div className="button-row">
              {mode === 'practice' && !isChecked && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={selectedIdx === undefined}
                  onClick={checkCurrentPracticeAnswer}
                  data-testid="check-answer-button"
                >
                  Check Answer
                </button>
              )}

              {!isLast ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  data-testid="next-question-button"
                >
                  Next Question <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="button primary"
                  disabled={submitting || answeredCount === 0}
                  onClick={() => void finishAndGradeQuiz()}
                  data-testid="finish-quiz-button"
                >
                  {submitting ? 'Grading…' : `Finish & Score (${answeredCount}/${questions.length})`}
                </button>
              )}
            </div>
          </div>
          <p className="muted-tiny" style={{ textAlign: 'center' }}>
            Tip: Press keys 1–4 to pick an option quickly.
          </p>
        </article>
      </div>
    );
  }

  // =================== RESULTS & DIAGNOSTICS VIEW ===================
  if (phase === 'results' && lastGrading && lastAttempt) {
    const missedQuestionIds = new Set(
      lastGrading.results.filter((r) => !r.isCorrect).map((r) => r.questionId)
    );
    const missedQuestions = questions.filter((q) => missedQuestionIds.has(q.id));

    return (
      <div className="study-studio" data-testid="quiz-results">
        <section className="panel quiz-results-hero">
          <div className="quiz-results-score">
            <div className="quiz-grade-ring" data-testid="quiz-grade-band">
              <Trophy size={22} />
              <strong>{lastGrading.gradeBand}</strong>
              <span>IGCSE Est.</span>
            </div>
            <div>
              <p className="eyebrow">QUIZ SCORE REPORT</p>
              <h1 data-testid="quiz-score-heading">
                {lastGrading.score} / {lastGrading.totalQuestions} ({lastGrading.percentage}%)
              </h1>
              <p className="muted">
                Completed in {formatTimer(lastAttempt.duration_seconds)} ·{' '}
                {lastPersistedCloud
                  ? 'Verified & saved to your Wise Owl cloud record'
                  : 'Graded & saved locally in this browser'}
              </p>
            </div>
          </div>

          <div className="button-row">
            {missedQuestions.length > 0 && (
              <button
                type="button"
                className="button primary"
                onClick={() => startQuiz(missedQuestions)}
                data-testid="retry-missed-button"
              >
                <RotateCcw size={16} /> Retry Missed ({missedQuestions.length})
              </button>
            )}
            <button type="button" className="button secondary" onClick={() => startQuiz()}>
              Retake Quiz
            </button>
            <button type="button" className="button secondary" onClick={() => setPhase('setup')}>
              All Subjects
            </button>
            <Link className="button secondary" href="/hub">
              Student Hub
            </Link>
          </div>
        </section>

        {/* TOPIC DIAGNOSTIC BREAKDOWN */}
        <section className="panel quiz-topics-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">TOPIC MASTERY BREAKDOWN</p>
              <h2>Strengths &amp; Revision Priorities</h2>
            </div>
          </div>
          <div className="quiz-topic-bars">
            {lastGrading.topicBreakdown.map((item) => (
              <div key={item.topic} className="quiz-topic-bar-row">
                <div className="hub-progress-meta">
                  <span>
                    {item.topic}{' '}
                    {item.percentage < 70 && <strong className="weak-tag">Revise</strong>}
                  </span>
                  <strong>
                    {item.correct}/{item.total} ({item.percentage}%)
                  </strong>
                </div>
                <div className="hub-progress-track">
                  <div
                    className={`hub-progress-fill ${item.percentage < 70 ? 'fill-warn' : ''}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* QUESTION-BY-QUESTION REVIEW */}
        <section className="home-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MARK-SCHEME REVIEW</p>
              <h2>Detailed Answer Explanations</h2>
            </div>
          </div>
          <div className="quiz-review-list">
            {lastGrading.results.map((result, idx) => {
              const subjectMeta = SUBJECT_BY_ID[result.subjectId];
              const owlAidPrompt = `Explain why the correct answer to this ${subjectMeta.name} (${result.syllabusRef}) question is "${result.options[result.correctIndex]}": ${result.prompt}`;
              return (
                <article
                  key={result.questionId}
                  className={`panel quiz-review-item ${result.isCorrect ? 'review-ok' : 'review-miss'}`}
                >
                  <div className="quiz-card-meta">
                    <div className="badge-cluster">
                      <span className="pill-subtle">Q{idx + 1} · {result.syllabusRef}</span>
                      <span className="pill-subtle">{result.topic}</span>
                    </div>
                    <span className={`quiz-result-pill ${result.isCorrect ? 'ok' : 'miss'}`}>
                      {result.isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {result.isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>
                  <h3>{result.prompt}</h3>
                  <div className="quiz-review-answers">
                    <p>
                      <strong>Your answer:</strong> {result.options[result.selectedIndex]}
                    </p>
                    {!result.isCorrect && (
                      <p className="correct-answer-line">
                        <strong>Correct answer:</strong> {result.options[result.correctIndex]}
                      </p>
                    )}
                  </div>
                  <p className="muted">{result.explanation}</p>
                  <p className="quiz-exam-tip">
                    <strong>Examiner Tip:</strong> {result.examTip}
                  </p>
                  <div className="button-row" style={{ marginTop: '0.5rem' }}>
                    <Link
                      className="button secondary tiny"
                      href={`/owlaid?mode=igcse&subject=${result.subjectId}&prompt=${encodeURIComponent(owlAidPrompt)}`}
                    >
                      <BrainCircuit size={13} /> Ask OwlAid to Explain
                    </Link>
                    <button
                      type="button"
                      className="button secondary tiny"
                      disabled={Boolean(savedFlashcardIds[result.questionId])}
                      onClick={() => void saveQuestionAsFlashcard(result)}
                    >
                      <BookmarkPlus size={13} />{' '}
                      {savedFlashcardIds[result.questionId] ? 'Saved to Flashcards' : 'Save as Flashcard'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return null;
}
