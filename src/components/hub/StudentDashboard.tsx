'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  ClipboardCheck,
  FolderKanban,
  Layers,
  MoreHorizontal,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { STUDY_SUBJECTS, SUBJECT_BY_ID } from '@/lib/study/curriculum';
import { combineFlashcards } from '@/lib/study/flashcards';
import { useLocalStudySnapshot } from '@/lib/study/local-storage';
import { gradeBandForPercentage } from '@/lib/study/scoring';
import {
  computeStudyStreakDays,
  computeSubjectReadiness,
  isCardDue,
  isCardMastered,
} from '@/lib/study/spaced-repetition';
import type {
  HubMarketplaceSummary,
  StudyProgressPayload,
  StudySubjectId,
} from '@/lib/study/types';
import type { Profile } from '@/lib/types';

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function cleanGreetingName(name: string): string {
  return name.trim().replace(/\.+$/, '');
}

export function StudentDashboard({
  profile,
  initialStudy,
  marketplaceSummary,
}: {
  profile: Profile | null;
  initialStudy: StudyProgressPayload;
  marketplaceSummary: HubMarketplaceSummary | null;
}) {
  const isApproved = profile?.verification_status === 'approved';
  const localScope = profile ? profile.id : 'guest';
  const localStudy = useLocalStudySnapshot(localScope);
  const study: StudyProgressPayload = initialStudy.synced
    ? initialStudy
    : localStudy.attempts.length || localStudy.customCards.length || localStudy.reviews.length
      ? { ...localStudy, synced: false, migrationRequired: initialStudy.migrationRequired }
      : initialStudy;

  const [openSubjectMenu, setOpenSubjectMenu] = useState<StudySubjectId | null>(null);
  const subjectsGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openSubjectMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (subjectsGridRef.current && !subjectsGridRef.current.contains(event.target as Node)) {
        setOpenSubjectMenu(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenSubjectMenu(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openSubjectMenu]);

  const allCards = useMemo(() => combineFlashcards(study.customCards), [study.customCards]);
  const reviewMap = useMemo(
    () => new Map(study.reviews.map((r) => [r.card_key, r])),
    [study.reviews]
  );

  const readinessList = useMemo(
    () => computeSubjectReadiness(allCards, study.reviews, study.attempts),
    [allCards, study.reviews, study.attempts]
  );

  const totalAttempts = study.attempts.length;
  const averageQuizScore = totalAttempts
    ? Math.round(study.attempts.reduce((sum, a) => sum + a.percentage, 0) / totalAttempts)
    : null;
  const averageGrade = averageQuizScore !== null ? gradeBandForPercentage(averageQuizScore) : null;

  const reviewedCount = study.reviews.length;
  const masteredCount = allCards.filter((c) => isCardMastered(reviewMap.get(c.cardKey))).length;
  const dueCount = allCards.filter((c) => isCardDue(reviewMap.get(c.cardKey))).length;
  const streakDays = useMemo(
    () => computeStudyStreakDays(study.attempts, study.reviews),
    [study.attempts, study.reviews]
  );
  const studiedSubjectsCount = readinessList.filter(
    (item) => item.attemptsCount > 0 || item.reviewedCards > 0
  ).length;
  const hasAnyProgress = totalAttempts > 0 || reviewedCount > 0;

  const focusSuggestion = useMemo(() => {
    const weakestWithAttempt = [...readinessList]
      .filter((r) => r.averageQuizPercent !== null && r.averageQuizPercent < 75)
      .sort((a, b) => (a.averageQuizPercent ?? 100) - (b.averageQuizPercent ?? 100))[0];

    if (weakestWithAttempt) {
      const subject = SUBJECT_BY_ID[weakestWithAttempt.subjectId];
      const focusTopic = weakestWithAttempt.weakTopics[0] ?? subject.topics[0];
      return {
        label: 'Focus next',
        text: `${subject.name} — ${focusTopic} (${weakestWithAttempt.averageQuizPercent}% quiz average)`,
        href: `/owlaid?mode=igcse&subject=${subject.id}&prompt=${encodeURIComponent(`Help me review ${focusTopic} in ${subject.name} (${subject.syllabusCode}) with mark-scheme points and a worked example.`)}`,
        cta: `Study with OwlAid`,
      };
    }

    const reviewedDue = study.reviews.filter((r) => isCardDue(r));
    if (reviewedDue.length > 0) {
      const subject = SUBJECT_BY_ID[reviewedDue[0].subject_id];
      return {
        label: 'Due for review',
        text: `${reviewedDue.length} reviewed flashcard${reviewedDue.length === 1 ? '' : 's'} ready for recall.`,
        href: `/flashcards?subject=${subject.id}&queue=due`,
        cta: 'Review now',
      };
    }

    return null;
  }, [readinessList, study.reviews]);

  return (
    <div className="hub-dashboard" data-testid="student-dashboard">
      {/* WORKSPACE HEADER */}
      <header className="hub-header">
        <div className="hub-header-text">
          <h1>
            {isApproved && profile
              ? `Welcome back, ${cleanGreetingName(profile.display_name)}`
              : 'Student Hub'}
          </h1>
          <p className="muted">
            {isApproved && study.synced
              ? 'Cambridge IGCSE workspace · Progress synced to your school account'
              : isApproved
                ? 'Cambridge IGCSE workspace · Progress saved in this browser'
                : 'Cambridge IGCSE workspace · Practise freely or sign in to sync across devices'}
          </p>
        </div>

        <div className="hub-quick-actions">
          <Link className="button primary" href="/owlaid?mode=igcse">
            <BrainCircuit size={16} /> Study
          </Link>
          <Link className="button secondary" href="/quizzes">
            <ClipboardCheck size={16} /> Quiz
          </Link>
          <Link className="button secondary" href="/flashcards">
            <Layers size={16} /> Flashcards
          </Link>
        </div>
      </header>

      {/* SUBTLE ACCOUNT NOTICE WHEN SIGNED OUT OR PENDING */}
      {!profile && (
        <div className="hub-subtle-bar" role="note">
          <span>Sign in with your Wise Owl account to sync study progress, use OwlAid, and browse CampusMarket.</span>
          <div className="hub-subtle-bar-links">
            <Link href="/login?next=/hub">Sign in</Link>
            <Link href="/signup">Create account</Link>
          </div>
        </div>
      )}

      {profile && !isApproved && (
        <div className="hub-subtle-bar" role="note">
          <span>
            Account status: <strong>{profile.verification_status}</strong>. Cloud sync, OwlAid, and CampusMarket unlock once a school administrator approves your account.
          </span>
          <Link href="/pending-approval">View status</Link>
        </div>
      )}

      {/* COMPACT PROGRESS SUMMARY OR CALM GET-STARTED BAR */}
      {hasAnyProgress ? (
        <section className="panel hub-summary-strip" aria-label="Study progress summary" data-testid="hub-metrics">
          <div className="hub-summary-item">
            <span className="hub-summary-label">Quiz average</span>
            <strong className="hub-summary-value">
              {averageQuizScore !== null ? `${averageQuizScore}%` : 'Not started'}
            </strong>
            <span className="muted-tiny">
              {totalAttempts > 0
                ? `${totalAttempts} scored attempt${totalAttempts === 1 ? '' : 's'}${averageGrade ? ` · Grade ${averageGrade}` : ''}`
                : 'Complete a quiz to see your average'}
            </span>
          </div>

          <div className="hub-summary-item">
            <span className="hub-summary-label">Flashcards</span>
            <strong className="hub-summary-value">
              {masteredCount} mastered
            </strong>
            <span className="muted-tiny">
              {dueCount} due · {study.customCards.length > 0 ? `${study.customCards.length} custom` : `${allCards.length} total`}
            </span>
          </div>

          <div className="hub-summary-item">
            <span className="hub-summary-label">Active study</span>
            <strong className="hub-summary-value">
              {streakDays > 0 ? `${streakDays} day${streakDays === 1 ? '' : 's'}` : 'Active'}
            </strong>
            <span className="muted-tiny">
              {studiedSubjectsCount} of {STUDY_SUBJECTS.length} subjects started
            </span>
          </div>
        </section>
      ) : (
        <section className="panel hub-get-started" aria-label="Get started" data-testid="hub-metrics">
          <div>
            <p className="eyebrow">Get started</p>
            <h2>Start with a short subject quiz or flashcard review</h2>
            <p className="muted">
              Your scores, grade estimates, and revision schedule appear here once you begin.
            </p>
          </div>
          <div className="button-row">
            <Link className="button primary small" href="/quizzes?subject=biology">
              Take first quiz <ArrowRight size={14} />
            </Link>
            <Link className="button secondary small" href="/flashcards">
              Review flashcards
            </Link>
          </div>
        </section>
      )}

      {focusSuggestion && (
        <div className="hub-focus-bar">
          <div>
            <span className="hub-focus-tag">{focusSuggestion.label}</span>
            <span>{focusSuggestion.text}</span>
          </div>
          <Link href={focusSuggestion.href} className="text-link">
            {focusSuggestion.cta} <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* CLEAN 8-SUBJECT GRID */}
      <section className="hub-section" aria-labelledby="hub-subjects-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Your learning</p>
            <h2 id="hub-subjects-heading">Your subjects</h2>
          </div>
          <Link href="/quizzes?subject=mixed">
            Mixed IGCSE quiz <ArrowRight size={15} />
          </Link>
        </div>

        <div className="hub-subjects-grid" ref={subjectsGridRef}>
          {STUDY_SUBJECTS.map((subject) => {
            const stat = readinessList.find((item) => item.subjectId === subject.id)!;
            const started = stat.attemptsCount > 0 || stat.reviewedCards > 0;
            const isMenuOpen = openSubjectMenu === subject.id;
            const primaryHref =
              stat.attemptsCount > 0 && stat.averageQuizPercent !== null && stat.averageQuizPercent < 70
                ? `/owlaid?mode=igcse&subject=${subject.id}`
                : `/quizzes?subject=${subject.id}`;
            const primaryLabel =
              stat.attemptsCount > 0 && stat.averageQuizPercent !== null && stat.averageQuizPercent < 70
                ? 'Review topic'
                : started
                  ? 'Practise quiz'
                  : 'Start quiz';

            return (
              <article
                key={subject.id}
                className="panel hub-subject-card"
                data-testid={`subject-card-${subject.id}`}
              >
                <div className="hub-subject-top">
                  <div>
                    <span className="hub-subject-code">{subject.syllabusCode}</span>
                    <h3>{subject.name}</h3>
                  </div>
                  {stat.latestGrade && (
                    <span className="hub-grade-badge has-grade" aria-label={`Latest grade ${stat.latestGrade}`}>
                      {stat.latestGrade}
                    </span>
                  )}
                </div>

                {started ? (
                  <div className="hub-subject-progress">
                    <p className="hub-subject-status">
                      {stat.averageQuizPercent !== null
                        ? `Quiz avg ${stat.averageQuizPercent}%`
                        : `${stat.reviewedCards}/${stat.totalCards} cards reviewed`}
                      {stat.averageQuizPercent !== null && stat.masteredCards > 0
                        ? ` · ${stat.masteredCards}/${stat.totalCards} mastered`
                        : stat.averageQuizPercent !== null && stat.reviewedCards > 0
                          ? ` · ${stat.reviewedCards} card${stat.reviewedCards === 1 ? '' : 's'} reviewed`
                          : ''}
                    </p>
                    <div
                      className="hub-progress-track"
                      role="progressbar"
                      aria-valuenow={stat.readinessPercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${subject.name} progress`}
                    >
                      <div className="hub-progress-fill" style={{ width: `${stat.readinessPercent}%` }} />
                    </div>
                    {stat.weakTopics.length > 0 && (
                      <p className="hub-weak-note">Revise: {stat.weakTopics[0]}</p>
                    )}
                  </div>
                ) : (
                  <p className="hub-subject-unstarted">Not started</p>
                )}

                <div className="hub-subject-footer">
                  <Link className="button secondary small hub-subject-primary" href={primaryHref}>
                    {primaryLabel}
                  </Link>

                  <div className="subject-more-wrap">
                    <button
                      type="button"
                      className="icon-button subject-more-btn"
                      aria-label={`More options for ${subject.name}`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      onClick={() => setOpenSubjectMenu(isMenuOpen ? null : subject.id)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {isMenuOpen && (
                      <div className="subject-more-menu" role="menu">
                        <Link
                          role="menuitem"
                          href={`/owlaid?mode=igcse&subject=${subject.id}`}
                          onClick={() => setOpenSubjectMenu(null)}
                        >
                          <BrainCircuit size={14} /> Study in OwlAid
                        </Link>
                        <Link
                          role="menuitem"
                          href={`/quizzes?subject=${subject.id}`}
                          onClick={() => setOpenSubjectMenu(null)}
                        >
                          <ClipboardCheck size={14} /> Take quiz
                        </Link>
                        <Link
                          role="menuitem"
                          href={`/flashcards?subject=${subject.id}`}
                          onClick={() => setOpenSubjectMenu(null)}
                        >
                          <Layers size={14} /> Review flashcards
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* RECENT QUIZZES — SHOWN ONLY WHEN MEANINGFUL */}
      {study.attempts.length > 0 && (
        <section className="hub-section" aria-labelledby="hub-recent-quizzes">
          <div className="section-heading">
            <div>
              <h2 id="hub-recent-quizzes">Recent quizzes</h2>
            </div>
            <Link href="/quizzes">
              All quizzes <ArrowRight size={15} />
            </Link>
          </div>
          <div className="panel hub-recent-card">
            <ul className="hub-attempt-list">
              {study.attempts.slice(0, 5).map((attempt) => {
                const subjectName =
                  attempt.subject_id === 'mixed'
                    ? 'Mixed IGCSE Quiz'
                    : SUBJECT_BY_ID[attempt.subject_id]?.name ?? attempt.subject_id;
                return (
                  <li key={attempt.id} className="hub-attempt-row">
                    <div>
                      <strong>{subjectName}</strong>
                      <span className="muted-tiny">
                        {attempt.score}/{attempt.total_questions} · {formatShortDate(attempt.created_at)}
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
        </section>
      )}

      {/* COMPACT SECONDARY SCHOOL LIFE & MARKETPLACE AREA */}
      <section className="hub-section" aria-labelledby="hub-school-life">
        <div className="panel hub-school-strip">
          <div className="hub-school-info">
            <p className="eyebrow">School life</p>
            <h2 id="hub-school-life">CampusMarket &amp; projects</h2>
            <p className="muted">
              {marketplaceSummary
                ? `${marketplaceSummary.activeProductsCount} approved product${marketplaceSummary.activeProductsCount === 1 ? '' : 's'} · ${marketplaceSummary.approvedGroupsCount} project team${marketplaceSummary.approvedGroupsCount === 1 ? '' : 's'}${marketplaceSummary.myPendingRequestsCount > 0 ? ` · ${marketplaceSummary.myPendingRequestsCount} open request${marketplaceSummary.myPendingRequestsCount === 1 ? '' : 's'}` : ''}`
                : 'Explore student-built goods, verified project groups, and school information.'}
            </p>
          </div>

          <div className="hub-school-links">
            <Link className="button secondary small" href="/marketplace">
              <ShoppingBag size={14} /> Marketplace
            </Link>
            <Link className="button secondary small" href="/projects">
              <FolderKanban size={14} /> Projects
            </Link>
            <Link
              className="button secondary small"
              href={marketplaceSummary?.isApprovedSeller ? '/seller/dashboard' : '/seller'}
            >
              <Store size={14} /> Seller Portal
            </Link>
            <Link className="button secondary small" href="/owlaid">
              <BookOpen size={14} /> School info
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
