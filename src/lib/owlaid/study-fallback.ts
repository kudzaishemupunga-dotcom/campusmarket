import { IGCSE_COMMAND_WORDS, SUBJECT_BY_ID, STUDY_SUBJECTS } from "@/lib/study/curriculum";
import { CURATED_FLASHCARDS } from "@/lib/study/flashcards";
import { QUIZ_QUESTIONS } from "@/lib/study/quizzes";
import type { StudyContext } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "what", "when", "where", "which", "who",
  "how", "why", "does", "into", "about", "explain", "describe", "define", "state", "give",
  "show", "help", "igcse", "cambridge", "marks", "mark", "question", "example", "please", "compare",
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function scoreMatch(keywords: string[], haystack: string): number {
  const lower = haystack.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += kw.length >= 6 ? 3 : 2;
  }
  return score;
}

/**
 * Curated offline Cambridge IGCSE Study Reference engine.
 * Gives learners real, exam-accurate revision guidance even when Gemini AI is offline or unconfigured.
 */
export function getOfflineStudyAnswer(question: string, study: StudyContext): string {
  const normalized = question.trim();
  const lower = normalized.toLowerCase();
  const subject = study.subjectId !== "general" ? SUBJECT_BY_ID[study.subjectId] : null;
  const tierLabel = study.tier === "extended" ? "Extended" : "Core";
  const keywords = extractKeywords(normalized);

  // Command-word lookup
  const matchedCommand = IGCSE_COMMAND_WORDS.find((cmd) =>
    new RegExp(`\\b${cmd.word.toLowerCase()}\\b`, "i").test(lower) &&
    /\b(command word|mean|difference|mark scheme|exam)\b/i.test(lower)
  );

  // Search curated flashcards & quiz explanations within the chosen subject first (or across all)
  const cardPool = subject
    ? CURATED_FLASHCARDS.filter((c) => c.subjectId === subject.id)
    : CURATED_FLASHCARDS;
  const quizPool = subject
    ? QUIZ_QUESTIONS.filter((q) => q.subjectId === subject.id)
    : QUIZ_QUESTIONS;

  const bestCard = cardPool
    .map((c) => ({
      card: c,
      score: scoreMatch(keywords, `${c.topic} ${c.front} ${c.back} ${c.hint}`),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const bestQuestion = quizPool
    .map((q) => ({
      question: q,
      score: scoreMatch(keywords, `${q.topic} ${q.prompt} ${q.explanation} ${q.examTip}`),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const header = subject
    ? `IGCSE Study Reference — ${subject.name} (${subject.syllabusCode} · ${tierLabel})`
    : `IGCSE Study Reference (Cambridge ${tierLabel})`;

  const lines: string[] = [header];

  if (matchedCommand) {
    lines.push(
      `Command Word — "${matchedCommand.word}": ${matchedCommand.meaning}`
    );
  }

  if (bestCard && bestCard.score >= 3) {
    lines.push(
      `Topic: ${bestCard.card.topic}`,
      `Key Concept: ${bestCard.card.front}`,
      `Mark-Scheme Summary: ${bestCard.card.back}`,
      `Examiner Tip: ${bestCard.card.examNote}`
    );
    if (study.coachMode === "socratic") {
      lines.push(`Self-Check Prompt: Cover the summary above and explain "${bestCard.card.topic}" in your own words. Hint: ${bestCard.card.hint}`);
    }
    return lines.join("\n\n");
  }

  if (bestQuestion && bestQuestion.score >= 3) {
    const correctOption = bestQuestion.question.options[bestQuestion.question.correctIndex];
    lines.push(
      `Syllabus Focus (${bestQuestion.question.syllabusRef} — ${bestQuestion.question.topic}):`,
      `Worked Point: ${bestQuestion.question.explanation}`,
      `Key Answer: ${correctOption}`,
      `Examiner Tip: ${bestQuestion.question.examTip}`
    );
    return lines.join("\n\n");
  }

  if (subject) {
    const facts = subject.keyFormulasOrFacts
      .map((item) => `• ${item.label}: ${item.detail}`)
      .join("\n");
    const coachGuidance: Record<StudyContext["coachMode"], string> = {
      explain: `Break "${normalized}" into clear syllabus definitions, cause-and-effect steps, and one concrete worked example.`,
      "mark-scheme": `Target key command words (${subject.commandWords.join(", ")}) and write one distinct marking point per mark awarded.`,
      socratic: `Before checking your notes, recall the core definition or formula for this topic, then test yourself against one worked example.`,
      "revision-plan": `Focus your revision across ${subject.topics.slice(0, 4).join(", ")} using active recall flashcards followed by a timed quiz.`,
    };
    lines.push(
      `Live Gemini tutoring is currently in offline reference mode, so here is your verified ${subject.name} (${subject.syllabusCode}) study sheet:`,
      facts,
      `Study Strategy (${study.coachMode}): ${coachGuidance[study.coachMode]}`,
      `Next step: Practice ${subject.name} questions in Interactive Quizzes or drill spaced-repetition Flashcards from the top navigation.`
    );
    return lines.join("\n\n");
  }

  const subjectList = STUDY_SUBJECTS.map((s) => `${s.name} (${s.syllabusCode})`).join(", ");
  lines.push(
    `Live Gemini tutoring is currently in offline reference mode. Select a specific Cambridge IGCSE subject (${subjectList}) to access subject formulas, mark-scheme guidance, and targeted revision notes.`,
    `Quick Cambridge Command Words:\n• Describe = say WHAT happens\n• Explain = say WHY / HOW with cause and effect\n• Compare = use direct comparative words (whereas, higher than)\n• Evaluate = weigh both sides and justify a conclusion`
  );
  return lines.join("\n\n");
}
