export const STUDY_SUBJECT_IDS = [
  'mathematics',
  'biology',
  'chemistry',
  'physics',
  'computer-science',
  'english',
  'geography',
  'business-studies',
] as const;

export type StudySubjectId = (typeof STUDY_SUBJECT_IDS)[number];
export type QuizSubjectFilter = StudySubjectId | 'mixed';
export type StudyTier = 'core' | 'extended';
export type QuizTierFilter = 'all' | StudyTier;
export type QuizMode = 'practice' | 'exam';
export type GradeBand = 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';
export type StudyCoachMode = 'explain' | 'mark-scheme' | 'socratic' | 'revision-plan';

export interface StudySubject {
  id: StudySubjectId;
  name: string;
  shortName: string;
  syllabusCode: string;
  faculty: 'Sciences' | 'Mathematics & ICT' | 'Languages' | 'Commercials & Humanities';
  description: string;
  topics: readonly string[];
  commandWords: readonly string[];
  keyFormulasOrFacts: readonly { label: string; detail: string }[];
  quickPrompts: readonly { label: string; prompt: string }[];
}

export interface QuizQuestion {
  id: string;
  subjectId: StudySubjectId;
  topic: string;
  difficulty: StudyTier;
  syllabusRef: string;
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  examTip: string;
}

export interface QuizAnswerSubmission {
  questionId: string;
  selectedIndex: number;
}

export interface GradedQuestionResult {
  questionId: string;
  subjectId: StudySubjectId;
  topic: string;
  difficulty: StudyTier;
  syllabusRef: string;
  prompt: string;
  options: readonly [string, string, string, string];
  selectedIndex: number;
  correctIndex: 0 | 1 | 2 | 3;
  isCorrect: boolean;
  explanation: string;
  examTip: string;
}

export interface TopicAccuracy {
  topic: string;
  correct: number;
  total: number;
  percentage: number;
}

export interface QuizGradingSummary {
  score: number;
  totalQuestions: number;
  percentage: number;
  gradeBand: GradeBand;
  weakTopics: string[];
  topicBreakdown: TopicAccuracy[];
  results: GradedQuestionResult[];
}

export interface QuizAttemptRecord {
  id: string;
  subject_id: QuizSubjectFilter;
  tier: QuizTierFilter;
  mode: QuizMode;
  score: number;
  total_questions: number;
  percentage: number;
  grade_band: GradeBand;
  duration_seconds: number;
  weak_topics: string[];
  created_at: string;
}

export interface CuratedFlashcard {
  id: string;
  cardKey: string;
  subjectId: StudySubjectId;
  topic: string;
  tier: StudyTier;
  front: string;
  back: string;
  hint: string;
  examNote: string;
  source: 'curated';
}

export interface CustomFlashcardRecord {
  id: string;
  subject_id: StudySubjectId;
  topic: string;
  front: string;
  back: string;
  hint: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyFlashcardItem {
  cardKey: string;
  id: string;
  subjectId: StudySubjectId;
  topic: string;
  tier?: StudyTier;
  front: string;
  back: string;
  hint: string | null;
  examNote?: string;
  source: 'curated' | 'custom';
}

export interface FlashcardReviewRecord {
  card_key: string;
  subject_id: StudySubjectId;
  box: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  last_rating: FlashcardRating;
  next_review_at: string;
  reviewed_at: string;
}

export interface StudyProgressPayload {
  synced: boolean;
  migrationRequired?: boolean;
  attempts: QuizAttemptRecord[];
  customCards: CustomFlashcardRecord[];
  reviews: FlashcardReviewRecord[];
}

export interface HubMarketplaceSummary {
  activeProductsCount: number;
  approvedGroupsCount: number;
  mySavedCount: number;
  myPendingRequestsCount: number;
  myProductsCount: number;
  isApprovedSeller: boolean;
}
