'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Flame,
  FolderKanban,
  GraduationCap,
  Heart,
  Inbox,
  Layers,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Target,
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
} from '@/lib/study/types';
import type { Profile } from '@/lib/types';
import { WiseOwlLogo } from './wise-owl-logo';

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
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
  const averageGrade = averageQuizScore !== null ? gradeBandForPercentage(averageQuizScore) : '—';

  const masteredCount = allCards.filter((c) => isCardMastered(reviewMap.get(c.cardKey))).length;
  const dueCount = allCards.filter((c) => isCardDue(reviewMap.get(c.cardKey))).length;
  const streakDays = useMemo(
    () => computeStudyStreakDays(study.attempts, study.reviews),
    [study.attempts, study.reviews]
  );
  const studiedSubjectsCount = readinessList.filter(
    (item) => item.attemptsCount > 0 || item.reviewedCards > 0
  ).length;

  // Smart recommendation based on actual progress (zero fabricated urgency)
  const recommendation = useMemo(() => {
    const weakestWithAttempt = [...readinessList]
      .filter((r) => r.averageQuizPercent !== null && r.averageQuizPercent < 75)
      .sort((a, b) => (a.averageQuizPercent ?? 100) - (b.averageQuizPercent ?? 100))[0];

    if (weakestWithAttempt) {
      const subject = SUBJECT_BY_ID[weakestWithAttempt.subjectId];
      const focusTopic = weakestWithAttempt.weakTopics[0] ?? subject.topics[0];
      return {
        eyebrow: 'PRIORITY REVISION FOCUS',
        title: `Strengthen ${subject.name} — ${focusTopic}`,
        text: `Your recent ${subject.name} average is ${weakestWithAttempt.averageQuizPercent}%. Walk through mark-scheme steps with OwlAid or drill targeted flashcards before retrying.`,
        primaryHref: `/owlaid?mode=igcse&subject=${subject.id}&prompt=${encodeURIComponent(`Coach me on ${focusTopic} in ${subject.name} (${subject.syllabusCode}) with mark-scheme points and a worked example.`)}`,
        primaryLabel: `Study ${subject.shortName} in OwlAid`,
        secondaryHref: `/quizzes?subject=${subject.id}`,
        secondaryLabel: `Retake ${subject.shortName} Quiz`,
      };
    }

    const reviewedDue = study.reviews.filter((r) => isCardDue(r));
    if (reviewedDue.length > 0) {
      const subject = SUBJECT_BY_ID[reviewedDue[0].subject_id];
      return {
        eyebrow: 'SPACED REPETITION DUE',
        title: `${reviewedDue.length} reviewed flashcard${reviewedDue.length === 1 ? '' : 's'} ready for active recall`,
        text: `Reviewing cards right when they come due locks Cambridge IGCSE definitions and formulas into long-term memory.`,
        primaryHref: `/flashcards?subject=${subject.id}&queue=due`,
        primaryLabel: 'Start Due Review',
        secondaryHref: '/quizzes?subject=mixed',
        secondaryLabel: 'Take Mixed Quiz',
      };
    }

    return {
      eyebrow: 'RECOMMENDED FIRST STEP',
      title: 'Start your Cambridge IGCSE readiness check',
      text: 'Take a scored subject quiz to reveal your grade band and weak topics, then lock in key terms with spaced-repetition flashcards and OwlAid Study Mode.',
      primaryHref: '/quizzes?subject=biology',
      primaryLabel: 'Take an IGCSE Quiz',
      secondaryHref: '/owlaid?mode=igcse',
      secondaryLabel: 'Open OwlAid Study Mode',
    };
  }, [readinessList, study.reviews]);

  return (
    <div className="hub-dashboard" data-testid="student-dashboard">
      {/* HERO HEADER */}
      <section className="hub-hero panel">
        <div className="hub-hero-copy">
          <div className="hub-hero-brand">
            <WiseOwlLogo variant="crest" size={82} framed eager />
            <div className="hub-hero-brand-meta">
              <div className="badge-cluster">
                <span className="hero-kicker">
                  <span className="tiny-dot" /> WISE OWL HUB 5.0 · WESTGATE
                </span>
                {isApproved && study.synced ? (
                  <span className="pill-subtle hub-sync-pill">
                    <Cloud size={13} /> Cloud Progress Synced
                  </span>
                ) : isApproved ? (
                  <span className="pill-subtle">
                    <CheckCircle2 size={13} /> School Member · Local Sync Fallback
                  </span>
                ) : (
                  <span className="pill-subtle">
                    <BookOpen size={13} /> Local Practice Preview
                  </span>
                )}
              </div>

              <h1>
                {isApproved && profile
                  ? `Welcome back, ${profile.display_name}.`
                  : 'Wise Owl Student Hub.'}
              </h1>
            </div>
          </div>
          <p>
            Your unified workspace for Cambridge IGCSE study coaching, scored subject quizzes, spaced-repetition flashcards, and Wise Owl Westgate student projects.
          </p>

          <div className="button-row">
            <Link className="button primary" href="/owlaid?mode=igcse">
              <BrainCircuit size={17} /> OwlAid IGCSE Study Mode
            </Link>
            <Link className="button secondary" href="/quizzes">
              <ClipboardCheck size={17} /> Start a Quiz
            </Link>
            <Link className="button secondary" href="/flashcards">
              <Layers size={17} /> Review Flashcards
            </Link>
          </div>
        </div>

        <aside className="hub-coach-card" aria-label="Recommended next study action">
          <p className="eyebrow">{recommendation.eyebrow}</p>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.text}</p>
          <div className="button-row">
            <Link className="button primary small" href={recommendation.primaryHref}>
              {recommendation.primaryLabel} <ArrowRight size={15} />
            </Link>
            <Link className="button secondary small" href={recommendation.secondaryHref}>
              {recommendation.secondaryLabel}
            </Link>
          </div>
        </aside>
      </section>

      {/* ACCOUNT STATUS BANNER FOR SIGNED-OUT OR PENDING USERS */}
      {!profile && (
        <div className="inline-notice hub-auth-callout">
          <ShieldCheck size={20} />
          <div>
            <strong>Sign in with your Wise Owl account to sync progress across devices</strong>
            <p>
              Practice quizzes and flashcards work immediately in this browser. Sign in with your verified Wise Owl account to persist scores in the cloud, unlock OwlAid AI Study Mode, and browse CampusMarket.
            </p>
            <div className="button-row" style={{ marginTop: '0.6rem' }}>
              <Link className="button primary small" href="/login?next=/hub">
                Sign In <ArrowRight size={14} />
              </Link>
              <Link className="button secondary small" href="/signup">
                Create Member Account
              </Link>
            </div>
          </div>
        </div>
      )}

      {profile && !isApproved && (
        <div className="inline-notice hub-auth-callout">
          <ShieldCheck size={20} />
          <div>
            <strong>School verification status: {profile.verification_status}</strong>
            <p>
              Once a Wise Owl administrator approves your membership, cloud study sync, OwlAid AI tutoring, and CampusMarket browsing unlock automatically.
            </p>
            <Link href="/pending-approval">
              View approval details <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* LIVE METRICS STRIP */}
      <section className="metrics-grid" aria-label="Study and campus metrics" data-testid="hub-metrics">
        <article className="panel hub-metric-card">
          <div className="hub-metric-head">
            <span className="muted-tiny">QUIZ PERFORMANCE</span>
            <ClipboardCheck size={18} />
          </div>
          <strong className="hub-metric-value">
            {averageQuizScore !== null ? `${averageQuizScore}%` : '0'}
          </strong>
          <span className="muted-tiny">
            {totalAttempts > 0
              ? `${totalAttempts} scored attempt${totalAttempts === 1 ? '' : 's'} · Avg grade ${averageGrade}`
              : 'No quiz attempts yet'}
          </span>
        </article>

        <article className="panel hub-metric-card">
          <div className="hub-metric-head">
            <span className="muted-tiny">FLASHCARD MASTERY</span>
            <Layers size={18} />
          </div>
          <strong className="hub-metric-value">
            {masteredCount} <small>/ {allCards.length}</small>
          </strong>
          <span className="muted-tiny">
            {dueCount} card{dueCount === 1 ? '' : 's'} due · {study.customCards.length} custom
          </span>
        </article>

        <article className="panel hub-metric-card">
          <div className="hub-metric-head">
            <span className="muted-tiny">STUDY MOMENTUM</span>
            <Flame size={18} />
          </div>
          <strong className="hub-metric-value">
            {streakDays} <small>day{streakDays === 1 ? '' : 's'}</small>
          </strong>
          <span className="muted-tiny">
            {studiedSubjectsCount} of {STUDY_SUBJECTS.length} IGCSE subjects active
          </span>
        </article>

        <article className="panel hub-metric-card">
          <div className="hub-metric-head">
            <span className="muted-tiny">CAMPUSMARKET</span>
            <ShoppingBag size={18} />
          </div>
          <strong className="hub-metric-value">
            {marketplaceSummary ? marketplaceSummary.activeProductsCount : '—'}
          </strong>
          <span className="muted-tiny">
            {marketplaceSummary
              ? `${marketplaceSummary.mySavedCount} saved · ${marketplaceSummary.myPendingRequestsCount} active request${marketplaceSummary.myPendingRequestsCount === 1 ? '' : 's'}`
              : 'Approved school members only'}
          </span>
        </article>
      </section>

      {/* SUBJECT READINESS MATRIX */}
      <section className="home-section" aria-labelledby="hub-subjects-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CAMBRIDGE IGCSE · 8 CORE SUBJECTS</p>
            <h2 id="hub-subjects-heading">Subject Readiness Matrix</h2>
          </div>
          <Link href="/quizzes?subject=mixed">
            Mixed IGCSE Challenge <ArrowRight size={16} />
          </Link>
        </div>

        <div className="hub-subjects-grid">
          {STUDY_SUBJECTS.map((subject) => {
            const stat = readinessList.find((item) => item.subjectId === subject.id)!;
            return (
              <article key={subject.id} className="panel hub-subject-card" data-testid={`subject-card-${subject.id}`}>
                <div className="hub-subject-top">
                  <div>
                    <span className="pill-subtle">{subject.syllabusCode}</span>
                    <h3>{subject.name}</h3>
                  </div>
                  <span className={`hub-grade-badge ${stat.latestGrade ? 'has-grade' : ''}`}>
                    {stat.latestGrade ?? 'New'}
                  </span>
                </div>

                <p className="muted-tiny">{subject.description}</p>

                <div className="hub-progress-row">
                  <div className="hub-progress-meta">
                    <span>Readiness</span>
                    <strong>{stat.readinessPercent}%</strong>
                  </div>
                  <div className="hub-progress-track" role="progressbar" aria-valuenow={stat.readinessPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${subject.name} readiness`}>
                    <div className="hub-progress-fill" style={{ width: `${stat.readinessPercent}%` }} />
                  </div>
                </div>

                <div className="hub-subject-stats">
                  <span>
                    <Target size={13} />{' '}
                    {stat.averageQuizPercent !== null
                      ? `Quiz avg ${stat.averageQuizPercent}% (${stat.attemptsCount})`
                      : 'No quizzes yet'}
                  </span>
                  <span>
                    <Layers size={13} /> {stat.masteredCards}/{stat.totalCards} cards
                  </span>
                </div>

                {stat.weakTopics.length > 0 && (
                  <div className="hub-weak-topics">
                    <span>Revise:</span> {stat.weakTopics.join(' · ')}
                  </div>
                )}

                <div className="hub-subject-actions">
                  <Link className="button secondary tiny" href={`/owlaid?mode=igcse&subject=${subject.id}`}>
                    <BrainCircuit size={13} /> Study
                  </Link>
                  <Link className="button secondary tiny" href={`/quizzes?subject=${subject.id}`}>
                    <ClipboardCheck size={13} /> Quiz
                  </Link>
                  <Link className="button secondary tiny" href={`/flashcards?subject=${subject.id}`}>
                    <Layers size={13} /> Cards
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* RECENT ACTIVITY & CAMPUS INTEGRATION */}
      <section className="home-section hub-lower-grid" aria-label="Recent study history and school integration">
        <article className="panel hub-activity-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">REAL SCORING HISTORY</p>
              <h2>Recent Quiz Attempts</h2>
            </div>
            <Link href="/quizzes">
              All Quizzes <ArrowRight size={15} />
            </Link>
          </div>

          {study.attempts.length > 0 ? (
            <ul className="hub-attempt-list">
              {study.attempts.slice(0, 6).map((attempt) => {
                const subjectName =
                  attempt.subject_id === 'mixed'
                    ? 'Mixed IGCSE Challenge'
                    : SUBJECT_BY_ID[attempt.subject_id]?.name ?? attempt.subject_id;
                return (
                  <li key={attempt.id} className="hub-attempt-row">
                    <div>
                      <strong>{subjectName}</strong>
                      <span className="muted-tiny">
                        {attempt.score}/{attempt.total_questions} · {attempt.mode} · {formatShortDate(attempt.created_at)}
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
          ) : (
            <div className="hub-empty-compact">
              <Sparkles size={22} />
              <p>Complete your first IGCSE quiz to see real scores, grade bands, and topic diagnostics here.</p>
              <Link className="button primary small" href="/quizzes">
                Start First Quiz <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </article>

        <article className="panel hub-campus-panel">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">BROADER SCHOOL INTEGRATION</p>
              <h2>CampusMarket & School Life</h2>
            </div>
            <Link href="/marketplace">
              Open Market <ArrowRight size={15} />
            </Link>
          </div>

          <p className="muted">
            Wise Owl Hub connects academic revision directly with Wise Owl High School Westgate’s student project marketplace and school knowledge base.
          </p>

          {marketplaceSummary ? (
            <div className="hub-campus-stats">
              <div>
                <ShoppingBag size={16} />
                <span>
                  <strong>{marketplaceSummary.activeProductsCount}</strong> approved student products
                </span>
              </div>
              <div>
                <FolderKanban size={16} />
                <span>
                  <strong>{marketplaceSummary.approvedGroupsCount}</strong> verified project groups
                </span>
              </div>
              <div>
                <Heart size={16} />
                <span>
                  <strong>{marketplaceSummary.mySavedCount}</strong> saved shortlist items
                </span>
              </div>
              <div>
                <Inbox size={16} />
                <span>
                  <strong>{marketplaceSummary.myPendingRequestsCount}</strong> open purchase requests
                </span>
              </div>
            </div>
          ) : (
            <div className="hub-campus-stats">
              <div>
                <GraduationCap size={16} />
                <span>Cambridge O-Level / IGCSE & Heritage-Based Curriculum</span>
              </div>
              <div>
                <Award size={16} />
                <span>Motto: “Going an Extra Mile” · Westgate, Harare</span>
              </div>
            </div>
          )}

          <div className="button-row">
            <Link className="button primary small" href="/marketplace">
              <ShoppingBag size={15} /> Browse Marketplace
            </Link>
            <Link className="button secondary small" href="/projects">
              <FolderKanban size={15} /> Project Teams
            </Link>
            <Link className="button secondary small" href={marketplaceSummary?.isApprovedSeller ? '/seller/dashboard' : '/seller'}>
              <Store size={15} /> Seller Portal
            </Link>
            <Link className="button secondary small" href="/owlaid">
              <BookOpen size={15} /> School Info
            </Link>
          </div>
        </article>
      </section>
    </div>
  );
}
