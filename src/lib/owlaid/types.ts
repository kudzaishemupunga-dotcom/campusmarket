import { STUDY_SUBJECT_IDS, type StudyCoachMode, type StudySubjectId, type StudyTier } from "@/lib/study/types";

export type Role = "user" | "model";
export type HistoryTurn = { role: Role; text: string };
export type ChatResult = {
  reply: string;
  mode: "local" | "ai";
  model?: string;
  notice?: string;
};

export type StudyContext = {
  enabled: boolean;
  subjectId: StudySubjectId | "general";
  coachMode: StudyCoachMode;
  tier: StudyTier;
};

const VALID_SUBJECTS = new Set<string>(["general", ...STUDY_SUBJECT_IDS]);
const VALID_COACH_MODES = new Set<string>(["explain", "mark-scheme", "socratic", "revision-plan"]);
const VALID_TIERS = new Set<string>(["core", "extended"]);

export function validHistory(value: unknown): value is HistoryTurn[] {
  return Array.isArray(value) && value.length <= 8 && value.every((entry) =>
    typeof entry === "object" && entry !== null &&
    (entry.role === "user" || entry.role === "model") &&
    typeof entry.text === "string" && entry.text.length <= 1000,
  );
}

export function validStudyContext(value: unknown): value is StudyContext | undefined {
  if (value === undefined || value === null) return true;
  if (typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.enabled !== "boolean") return false;
  if (!candidate.enabled) return true;
  return (
    typeof candidate.subjectId === "string" &&
    VALID_SUBJECTS.has(candidate.subjectId) &&
    typeof candidate.coachMode === "string" &&
    VALID_COACH_MODES.has(candidate.coachMode) &&
    typeof candidate.tier === "string" &&
    VALID_TIERS.has(candidate.tier)
  );
}
