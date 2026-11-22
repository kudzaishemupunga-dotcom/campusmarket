import { useSyncExternalStore } from 'react';
import type {
  CustomFlashcardRecord,
  FlashcardReviewRecord,
  QuizAttemptRecord,
  StudyProgressPayload,
} from './types';

const STORAGE_PREFIX = 'wiseowl-hub-study-v1';

function storageKey(scope: string): string {
  return `${STORAGE_PREFIX}:${scope}`;
}

const emptyProgress: StudyProgressPayload = {
  synced: false,
  attempts: [],
  customCards: [],
  reviews: [],
};

const listeners = new Set<() => void>();
const snapshotCache = new Map<string, { raw: string | null; value: StudyProgressPayload }>();

function emitLocalStudyChange() {
  listeners.forEach((listener) => listener());
}

function subscribeLocalStudy(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith(STORAGE_PREFIX)) {
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function readLocalStudyProgress(scope: string): StudyProgressPayload {
  if (typeof window === 'undefined') return emptyProgress;
  const key = storageKey(scope);
  try {
    const raw = window.localStorage.getItem(key);
    const cached = snapshotCache.get(key);
    if (cached && cached.raw === raw) return cached.value;

    if (!raw) {
      snapshotCache.set(key, { raw: null, value: emptyProgress });
      return emptyProgress;
    }
    const parsed = JSON.parse(raw) as Partial<StudyProgressPayload>;
    const value: StudyProgressPayload = {
      synced: false,
      attempts: Array.isArray(parsed.attempts) ? (parsed.attempts as QuizAttemptRecord[]).slice(0, 100) : [],
      customCards: Array.isArray(parsed.customCards)
        ? (parsed.customCards as CustomFlashcardRecord[]).slice(0, 200)
        : [],
      reviews: Array.isArray(parsed.reviews) ? (parsed.reviews as FlashcardReviewRecord[]).slice(0, 500) : [],
    };
    snapshotCache.set(key, { raw, value });
    return value;
  } catch {
    return emptyProgress;
  }
}

export function writeLocalStudyProgress(scope: string, data: Omit<StudyProgressPayload, 'synced'>): void {
  if (typeof window === 'undefined') return;
  const key = storageKey(scope);
  try {
    const raw = JSON.stringify({
      attempts: data.attempts.slice(0, 100),
      customCards: data.customCards.slice(0, 200),
      reviews: data.reviews.slice(0, 500),
    });
    window.localStorage.setItem(key, raw);
    snapshotCache.delete(key);
    emitLocalStudyChange();
  } catch {
    /* ignore quota/private-mode storage errors */
  }
}

export function useLocalStudySnapshot(scope: string): StudyProgressPayload {
  return useSyncExternalStore(
    subscribeLocalStudy,
    () => readLocalStudyProgress(scope),
    () => emptyProgress
  );
}
