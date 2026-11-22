'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  Eye,
  Lightbulb,
  Plus,
  RotateCw,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui';
import { isStudySubjectId, STUDY_SUBJECTS, SUBJECT_BY_ID } from '@/lib/study/curriculum';
import { combineFlashcards } from '@/lib/study/flashcards';
import { useLocalStudySnapshot, writeLocalStudyProgress } from '@/lib/study/local-storage';
import {
  calculateNextReview,
  formatNextReviewLabel,
  isCardDue,
  isCardMastered,
  needsPractice,
} from '@/lib/study/spaced-repetition';
import type {
  CustomFlashcardRecord,
  FlashcardRating,
  FlashcardReviewRecord,
  StudyFlashcardItem,
  StudyProgressPayload,
  StudySubjectId,
} from '@/lib/study/types';
import type { Profile } from '@/lib/types';

type QueueFilter = 'due' | 'all' | 'practice' | 'mastered' | 'custom';

function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function filterFlashcards(
  cards: readonly StudyFlashcardItem[],
  subjectFilter: StudySubjectId | 'all',
  queueFilter: QueueFilter,
  reviewMap: ReadonlyMap<string, FlashcardReviewRecord>
): StudyFlashcardItem[] {
  const bySubject =
    subjectFilter === 'all'
      ? cards
      : cards.filter((card) => card.subjectId === subjectFilter);

  if (queueFilter === 'due') {
    return bySubject.filter((card) => isCardDue(reviewMap.get(card.cardKey)));
  }
  if (queueFilter === 'practice') {
    return bySubject.filter((card) => needsPractice(reviewMap.get(card.cardKey)));
  }
  if (queueFilter === 'mastered') {
    return bySubject.filter((card) => isCardMastered(reviewMap.get(card.cardKey)));
  }
  if (queueFilter === 'custom') {
    return bySubject.filter((card) => card.source === 'custom');
  }
  return [...bySubject];
}

export function FlashcardStudio({
  profile,
  initialStudy,
  initialSubject,
  initialQueue,
}: {
  profile: Profile | null;
  initialStudy: StudyProgressPayload;
  initialSubject?: string;
  initialQueue?: string;
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

  const initialSubjectFilter: StudySubjectId | 'all' = isStudySubjectId(initialSubject)
    ? initialSubject
    : 'all';
  const initialQueueFilter: QueueFilter =
    initialQueue === 'due' ||
    initialQueue === 'practice' ||
    initialQueue === 'mastered' ||
    initialQueue === 'custom'
      ? initialQueue
      : 'due';

  const [subjectFilter, setSubjectFilter] = useState<StudySubjectId | 'all'>(initialSubjectFilter);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>(initialQueueFilter);

  const allCards = useMemo(() => combineFlashcards(study.customCards), [study.customCards]);
  const cardByKey = useMemo(() => new Map(allCards.map((c) => [c.cardKey, c])), [allCards]);
  const reviewMap = useMemo(
    () => new Map(study.reviews.map((r) => [r.card_key, r])),
    [study.reviews]
  );

  const filteredCards = useMemo(
    () => filterFlashcards(allCards, subjectFilter, queueFilter, reviewMap),
    [allCards, subjectFilter, queueFilter, reviewMap]
  );

  // Active review session queue (list of cardKeys)
  const [sessionQueue, setSessionQueue] = useState<string[]>(() => {
    const startCards = combineFlashcards(initialStudy.customCards);
    const startReviews = new Map(initialStudy.reviews.map((r) => [r.card_key, r]));
    return filterFlashcards(startCards, initialSubjectFilter, initialQueueFilter, startReviews).map(
      (c) => c.cardKey
    );
  });
  const [queueIndex, setQueueIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [sessionCounts, setSessionCounts] = useState<Record<FlashcardRating, number>>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
  });

  // Custom flashcard modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const rebuildQueue = useCallback(
    (cards: readonly StudyFlashcardItem[], shouldShuffle = false) => {
      const keys = cards.map((c) => c.cardKey);
      setSessionQueue(shouldShuffle ? shuffleArray(keys) : keys);
      setQueueIndex(0);
      setFlipped(false);
      setShowHint(false);
      setSessionCounts({ again: 0, hard: 0, good: 0, easy: 0 });
    },
    []
  );

  function selectSubjectFilter(nextSubject: StudySubjectId | 'all') {
    setSubjectFilter(nextSubject);
    rebuildQueue(filterFlashcards(allCards, nextSubject, queueFilter, reviewMap), false);
  }

  function selectQueueFilter(nextQueue: QueueFilter) {
    setQueueFilter(nextQueue);
    rebuildQueue(filterFlashcards(allCards, subjectFilter, nextQueue, reviewMap), false);
  }

  const currentCardKey = sessionQueue[queueIndex];
  const currentCard = currentCardKey ? cardByKey.get(currentCardKey) : undefined;
  const currentReview = currentCard ? reviewMap.get(currentCard.cardKey) : undefined;

  const sessionReviewedTotal =
    sessionCounts.again + sessionCounts.hard + sessionCounts.good + sessionCounts.easy;
  const sessionComplete = sessionQueue.length > 0 && queueIndex >= sessionQueue.length;

  const ratingPreviews = useMemo(() => {
    if (!currentCard) return null;
    const ratings: FlashcardRating[] = ['again', 'hard', 'good', 'easy'];
    return Object.fromEntries(
      ratings.map((rating) => {
        const next = calculateNextReview({
          cardKey: currentCard.cardKey,
          subjectId: currentCard.subjectId,
          rating,
          existing: currentReview,
        });
        const label =
          rating === 'again'
            ? 'Re-queue now'
            : next.interval_days === 1
              ? '1 day'
              : `${next.interval_days} days`;
        return [rating, label];
      })
    ) as Record<FlashcardRating, string>;
  }, [currentCard, currentReview]);

  const submitRating = useCallback(
    async (rating: FlashcardRating) => {
      if (!currentCard || ratingBusy) return;
      setRatingBusy(true);

      const optimisticNext = calculateNextReview({
        cardKey: currentCard.cardKey,
        subjectId: currentCard.subjectId,
        rating,
        existing: currentReview,
      });

      let finalReview: FlashcardReviewRecord = optimisticNext;
      let persistedCloud = false;

      try {
        if (isApproved) {
          const res = await fetch('/api/study/flashcards/review', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              cardKey: currentCard.cardKey,
              subjectId: currentCard.subjectId,
              rating,
            }),
          });
          const data = await res.json();
          if (res.ok && data.review) {
            finalReview = data.review as FlashcardReviewRecord;
            persistedCloud = Boolean(data.persisted);
          }
        }
      } catch {
        // Keep optimistic local review so study flow is never interrupted
      }

      const others = study.reviews.filter((r) => r.card_key !== finalReview.card_key);
      const nextReviews = [finalReview, ...others];
      if (persistedCloud) {
        setCloudStudy((prev) => ({ ...prev, reviews: nextReviews, synced: true }));
      } else {
        writeLocalStudyProgress(localScope, {
          attempts: study.attempts,
          customCards: study.customCards,
          reviews: nextReviews,
        });
      }

      setSessionCounts((prev) => ({ ...prev, [rating]: prev[rating] + 1 }));

      if (rating === 'again') {
        // Re-insert the missed card a few cards later in the current session for genuine active recall
        setSessionQueue((prev) => {
          const nextQueue = [...prev];
          const insertAt = Math.min(nextQueue.length, queueIndex + 3);
          nextQueue.splice(insertAt, 0, currentCard.cardKey);
          return nextQueue;
        });
      }

      setQueueIndex((idx) => idx + 1);
      setFlipped(false);
      setShowHint(false);
      setRatingBusy(false);
    },
    [currentCard, currentReview, isApproved, localScope, queueIndex, ratingBusy, study.attempts, study.customCards, study.reviews]
  );

  // Keyboard shortcuts for active flashcard review
  useEffect(() => {
    if (!currentCard || createOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((v) => !v);
      } else if (e.key.toLowerCase() === 'h' && !flipped && currentCard.hint) {
        setShowHint(true);
      } else if (flipped && !ratingBusy) {
        if (e.key === '1') void submitRating('again');
        else if (e.key === '2') void submitRating('hard');
        else if (e.key === '3') void submitRating('good');
        else if (e.key === '4') void submitRating('easy');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentCard, createOpen, flipped, ratingBusy, submitRating]);

  async function handleCreateCard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const payload = {
      subjectId: String(form.get('subjectId')) as StudySubjectId,
      topic: String(form.get('topic') || '').trim(),
      front: String(form.get('front') || '').trim(),
      back: String(form.get('back') || '').trim(),
      hint: String(form.get('hint') || '').trim() || null,
    };

    setCreateBusy(true);
    try {
      let createdCard: CustomFlashcardRecord;
      let persisted = false;

      if (isApproved) {
        const res = await fetch('/api/study/flashcards', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not create flashcard.');
        createdCard = data.card as CustomFlashcardRecord;
        persisted = Boolean(data.persisted);
      } else {
        if (payload.topic.length < 2 || payload.front.length < 3 || payload.back.length < 3) {
          throw new Error('Fill in topic, front question, and back answer.');
        }
        const nowIso = new Date().toISOString();
        createdCard = {
          id: crypto.randomUUID(),
          subject_id: payload.subjectId,
          topic: payload.topic,
          front: payload.front,
          back: payload.back,
          hint: payload.hint,
          created_at: nowIso,
          updated_at: nowIso,
        };
      }

      const nextCards = [createdCard, ...study.customCards];
      if (persisted) {
        setCloudStudy((prev) => ({ ...prev, customCards: nextCards }));
      } else {
        writeLocalStudyProgress(localScope, {
          attempts: study.attempts,
          customCards: nextCards,
          reviews: study.reviews,
        });
      }

      const nextAll = combineFlashcards(nextCards);
      formEl.reset();
      setCreateOpen(false);
      setSubjectFilter(createdCard.subject_id);
      setQueueFilter('custom');
      rebuildQueue(filterFlashcards(nextAll, createdCard.subject_id, 'custom', reviewMap), false);
      toast.success('Custom flashcard added to your deck.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save flashcard.');
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleDeleteCustomCard(cardId: string) {
    try {
      let persisted = false;
      if (isApproved) {
        const res = await fetch(`/api/study/flashcards/${cardId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not delete flashcard.');
        persisted = Boolean(data.persisted);
      }
      const nextCards = study.customCards.filter((c) => c.id !== cardId);
      const nextReviews = study.reviews.filter((r) => r.card_key !== `custom:${cardId}`);
      if (persisted) {
        setCloudStudy((prev) => ({ ...prev, customCards: nextCards, reviews: nextReviews }));
      } else {
        writeLocalStudyProgress(localScope, {
          attempts: study.attempts,
          customCards: nextCards,
          reviews: nextReviews,
        });
      }
      const nextAll = combineFlashcards(nextCards);
      const nextReviewMap = new Map(nextReviews.map((r) => [r.card_key, r]));
      rebuildQueue(filterFlashcards(nextAll, subjectFilter, queueFilter, nextReviewMap), false);
      toast.success('Custom flashcard removed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete flashcard.');
    }
  }

  const totalMastered = allCards.filter((c) => isCardMastered(reviewMap.get(c.cardKey))).length;
  const totalDue = allCards.filter((c) => isCardDue(reviewMap.get(c.cardKey))).length;

  return (
    <div className="study-studio" data-testid="flashcard-studio">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WISE OWL HUB 5.0 · SPACED REPETITION STUDIO</p>
          <h1>IGCSE Flashcards &amp; Active Recall.</h1>
          <p>
            Flip curated Cambridge IGCSE cards or author your own. Rate your recall honestly—spaced repetition schedules each card right before you forget it.
          </p>
        </div>
        <div className="heading-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => setCreateOpen(true)}
            data-testid="open-create-card-button"
          >
            <Plus size={16} /> Create Flashcard
          </button>
          <Link className="button secondary" href="/hub">
            <ArrowLeft size={16} /> Student Hub
          </Link>
        </div>
      </div>

      {/* SUMMARY STATS STRIP */}
      <div className="flashcard-stats-strip">
        <span className="pill-subtle">{allCards.length} total cards</span>
        <span className="pill-subtle">{totalDue} due for review</span>
        <span className="pill-subtle">{totalMastered} mastered (Box 4–5)</span>
        <span className="pill-subtle">{study.customCards.length} custom cards</span>
        {isApproved && study.synced ? (
          <span className="pill-subtle hub-sync-pill"><Cloud size={13} /> Cloud Synced</span>
        ) : (
          <span className="pill-subtle">Local browser sync</span>
        )}
      </div>

      {/* SUBJECT FILTER PILLS */}
      <div className="category-pills-row" role="navigation" aria-label="Filter flashcards by subject">
        <button
          type="button"
          className={`pill-button ${subjectFilter === 'all' ? 'active' : ''}`}
          onClick={() => selectSubjectFilter('all')}
        >
          All Subjects ({allCards.length})
        </button>
        {STUDY_SUBJECTS.map((subject) => {
          const dueForSub = allCards.filter(
            (c) => c.subjectId === subject.id && isCardDue(reviewMap.get(c.cardKey))
          ).length;
          return (
            <button
              key={subject.id}
              type="button"
              className={`pill-button ${subjectFilter === subject.id ? 'active' : ''}`}
              onClick={() => selectSubjectFilter(subject.id)}
              data-testid={`flashcard-subject-${subject.id}`}
            >
              {subject.shortName} · {dueForSub} due
            </button>
          );
        })}
      </div>

      {/* QUEUE MODE TABS & SHUFFLE */}
      <div className="flashcard-toolbar">
        <div className="button-row" role="tablist" aria-label="Review queue mode">
          {(
            [
              ['due', 'Due for Review'],
              ['all', 'All Cards'],
              ['practice', 'Needs Practice'],
              ['mastered', 'Mastered'],
              ['custom', `My Custom (${study.customCards.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={queueFilter === id}
              className={`pill-button ${queueFilter === id ? 'active' : ''}`}
              onClick={() => selectQueueFilter(id)}
              data-testid={`queue-tab-${id}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="button secondary small"
          onClick={() => rebuildQueue(filteredCards, true)}
          disabled={filteredCards.length < 2}
        >
          <Shuffle size={15} /> Shuffle Deck
        </button>
      </div>

      {/* ACTIVE FLASHCARD STAGE */}
      {currentCard ? (
        <section className="flashcard-stage" aria-label="Flashcard review stage">
          <div className="flashcard-stage-meta">
            <span className="muted-tiny">
              Card {Math.min(queueIndex + 1, sessionQueue.length)} of {sessionQueue.length}
              {sessionReviewedTotal > 0 ? ` · ${sessionReviewedTotal} rated this session` : ''}
            </span>
            <div className="box-pips" aria-label={`Mastery box ${currentReview?.box ?? 0} of 5`}>
              <span>Box {currentReview?.box ?? 0}/5</span>
              {[1, 2, 3, 4, 5].map((level) => (
                <span
                  key={level}
                  className={`box-pip ${(currentReview?.box ?? 0) >= level ? 'filled' : ''}`}
                />
              ))}
            </div>
          </div>

          <div
            className={`panel flashcard-card ${flipped ? 'is-flipped' : ''}`}
            data-testid="active-flashcard"
          >
            <div className="flashcard-card-head">
              <div className="badge-cluster">
                <span className="pill-subtle">
                  {SUBJECT_BY_ID[currentCard.subjectId].name} · {SUBJECT_BY_ID[currentCard.subjectId].syllabusCode}
                </span>
                <span className="pill-subtle">{currentCard.topic}</span>
                {currentCard.source === 'custom' && <span className="pill-subtle">Custom Card</span>}
              </div>
              <span className="muted-tiny">{formatNextReviewLabel(currentReview)}</span>
            </div>

            <div className="flashcard-body">
              <span className="flashcard-side-label">
                {flipped ? 'CAMBRIDGE EXAM ANSWER' : 'ACTIVE RECALL PROMPT'}
              </span>

              {!flipped ? (
                <>
                  <h2 className="flashcard-text" data-testid="flashcard-front">
                    {currentCard.front}
                  </h2>
                  {currentCard.hint && (
                    <div className="flashcard-hint-area">
                      {showHint ? (
                        <p className="flashcard-hint-box" data-testid="flashcard-hint">
                          <Lightbulb size={15} /> <strong>Hint:</strong> {currentCard.hint}
                        </p>
                      ) : (
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setShowHint(true)}
                        >
                          <Lightbulb size={15} /> Show Hint (H)
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flashcard-back-content" data-testid="flashcard-back">
                  <p className="flashcard-answer-text">{currentCard.back}</p>
                  {currentCard.examNote && (
                    <p className="quiz-exam-tip">
                      <strong>Examiner Note:</strong> {currentCard.examNote}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flashcard-card-foot">
              <button
                type="button"
                className="button secondary"
                onClick={() => setFlipped((v) => !v)}
                data-testid="flip-card-button"
              >
                <RotateCw size={16} /> {flipped ? 'Show Prompt' : 'Reveal Answer (Space)'}
              </button>

              <Link
                className="text-link"
                href={`/owlaid?mode=igcse&subject=${currentCard.subjectId}&prompt=${encodeURIComponent(
                  `Explain this ${SUBJECT_BY_ID[currentCard.subjectId].name} flashcard in more depth with an exam example: ${currentCard.front}`
                )}`}
              >
                <BrainCircuit size={15} /> Ask OwlAid
              </Link>
            </div>
          </div>

          {/* SPACED REPETITION RATING BAR */}
          <div className="flashcard-rating-panel">
            {!flipped ? (
              <button
                type="button"
                className="button primary wide"
                onClick={() => setFlipped(true)}
                data-testid="reveal-answer-cta"
              >
                <Eye size={17} /> Reveal Answer to Rate Recall
              </button>
            ) : (
              <>
                <p className="muted-tiny" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                  How well did you recall this? (Keyboard shortcuts 1–4)
                </p>
                <div className="flashcard-rating-grid" data-testid="flashcard-rating-buttons">
                  <button
                    type="button"
                    disabled={ratingBusy}
                    className="rating-btn rating-again"
                    onClick={() => void submitRating('again')}
                    data-testid="rate-again"
                  >
                    <strong>1 · Again</strong>
                    <span>{ratingPreviews?.again}</span>
                  </button>
                  <button
                    type="button"
                    disabled={ratingBusy}
                    className="rating-btn rating-hard"
                    onClick={() => void submitRating('hard')}
                    data-testid="rate-hard"
                  >
                    <strong>2 · Hard</strong>
                    <span>{ratingPreviews?.hard}</span>
                  </button>
                  <button
                    type="button"
                    disabled={ratingBusy}
                    className="rating-btn rating-good"
                    onClick={() => void submitRating('good')}
                    data-testid="rate-good"
                  >
                    <strong>3 · Good</strong>
                    <span>{ratingPreviews?.good}</span>
                  </button>
                  <button
                    type="button"
                    disabled={ratingBusy}
                    className="rating-btn rating-easy"
                    onClick={() => void submitRating('easy')}
                    data-testid="rate-easy"
                  >
                    <strong>4 · Easy</strong>
                    <span>{ratingPreviews?.easy}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      ) : sessionComplete ? (
        <section className="panel flashcard-complete-card" data-testid="flashcard-session-complete">
          <div className="empty-icon-ring">
            <CheckCircle2 size={32} />
          </div>
          <h2>Review Session Complete!</h2>
          <p className="muted">
            You completed {sessionReviewedTotal} active-recall review{sessionReviewedTotal === 1 ? '' : 's'} —{' '}
            {sessionCounts.easy} Easy · {sessionCounts.good} Good · {sessionCounts.hard} Hard · {sessionCounts.again} Again.
          </p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setQueueFilter('all');
                rebuildQueue(
                  subjectFilter === 'all'
                    ? allCards
                    : allCards.filter((c) => c.subjectId === subjectFilter),
                  true
                );
              }}
            >
              Practice Full Deck
            </button>
            <Link
              className="button secondary"
              href={subjectFilter !== 'all' ? `/quizzes?subject=${subjectFilter}` : '/quizzes'}
            >
              <ClipboardCheck size={16} /> Test with a Quiz
            </Link>
            <Link className="button secondary" href="/hub">
              Back to Student Hub
            </Link>
          </div>
        </section>
      ) : (
        <section className="panel flashcard-complete-card">
          <div className="empty-icon-ring">
            <Sparkles size={30} />
          </div>
          <h2>
            {queueFilter === 'due'
              ? 'All caught up on due flashcards!'
              : queueFilter === 'custom'
                ? 'No custom flashcards yet.'
                : 'No flashcards in this filter yet.'}
          </h2>
          <p className="muted">
            {queueFilter === 'custom'
              ? 'Create personal IGCSE flashcards for tricky formulas, definitions, or case studies.'
              : 'Switch to All Cards to keep practising or create a new custom flashcard.'}
          </p>
          <div className="button-row" style={{ justifyContent: 'center' }}>
            {queueFilter !== 'all' && (
              <button type="button" className="button primary" onClick={() => selectQueueFilter('all')}>
                Browse All Cards
              </button>
            )}
            <button type="button" className="button secondary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Create Custom Card
            </button>
          </div>
        </section>
      )}

      {/* CUSTOM FLASHCARDS LIBRARY */}
      {study.customCards.length > 0 && (
        <section className="home-section" aria-labelledby="custom-cards-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL STUDY DECK</p>
              <h2 id="custom-cards-heading">Custom Flashcards ({study.customCards.length})</h2>
            </div>
          </div>
          <div className="custom-cards-grid" data-testid="custom-flashcards-list">
            {study.customCards.map((card) => (
              <article key={card.id} className="panel custom-card-tile">
                <div className="quiz-card-meta">
                  <span className="pill-subtle">
                    {SUBJECT_BY_ID[card.subject_id].shortName} · {card.topic}
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete custom flashcard ${card.topic}`}
                    onClick={() => void handleDeleteCustomCard(card.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <strong>{card.front}</strong>
                <p className="muted-tiny">{card.back}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* CREATE CUSTOM FLASHCARD DIALOG */}
      {createOpen && (
        <Dialog title="Create Custom IGCSE Flashcard" onClose={() => setCreateOpen(false)}>
          <form className="stack-form" onSubmit={handleCreateCard}>
            <label>
              IGCSE Subject
              <select
                name="subjectId"
                defaultValue={subjectFilter !== 'all' ? subjectFilter : 'biology'}
                required
              >
                {STUDY_SUBJECTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.syllabusCode})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <input
                name="topic"
                minLength={2}
                maxLength={80}
                placeholder="e.g. Enzymes, Stoichiometry, Break-Even"
                required
              />
            </label>
            <label>
              Front (Question or Term)
              <textarea
                name="front"
                rows={2}
                minLength={3}
                maxLength={400}
                placeholder="What do you want to test yourself on?"
                required
              />
            </label>
            <label>
              Back (Exam-Ready Answer)
              <textarea
                name="back"
                rows={3}
                minLength={3}
                maxLength={800}
                placeholder="Write a clear Cambridge mark-scheme answer."
                required
              />
            </label>
            <label>
              Optional Recall Hint
              <input
                name="hint"
                maxLength={240}
                placeholder="Optional short cue before flipping"
              />
            </label>
            <div className="button-row">
              <button type="submit" className="button primary" disabled={createBusy}>
                {createBusy ? 'Saving…' : 'Save Flashcard'}
              </button>
              <button type="button" className="button secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
