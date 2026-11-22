"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { BookOpen, BrainCircuit, ClipboardCheck, Layers, Sparkles } from "lucide-react";
import type { ChatResult, HistoryTurn, StudyContext } from "@/lib/owlaid/types";
import { isStudySubjectId, STUDY_SUBJECTS, SUBJECT_BY_ID } from "@/lib/study/curriculum";
import type { StudyCoachMode, StudySubjectId, StudyTier } from "@/lib/study/types";
import { WiseOwlLogo } from "@/components/hub/wise-owl-logo";
import styles from "./OwlAidChat.module.css";

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
  mode?: "local" | "ai";
  model?: string;
  notice?: string;
  studyBadge?: string;
};

const schoolSuggestions = [
  { icon: "🏛️", label: "Mission & vision", question: "What are the school mission and vision?" },
  { icon: "🎓", label: "Cambridge curriculum", question: "What curriculum does the school follow?" },
  { icon: "🏅", label: "Sports & clubs", question: "What sports and clubs are available?" },
  { icon: "📍", label: "Location & contact", question: "Where is Wise Owl High School Westgate located?" },
];

const COACH_MODES: readonly { id: StudyCoachMode; label: string; blurb: string }[] = [
  { id: "explain", label: "Concept Explainer", blurb: "Step-by-step explanation + worked example" },
  { id: "mark-scheme", label: "Mark-Scheme Coach", blurb: "Command words & examiner marking points" },
  { id: "socratic", label: "Hint-First Tutor", blurb: "Guided hints so you build active recall" },
  { id: "revision-plan", label: "Revision Sheet", blurb: "High-yield notes + 3 self-check questions" },
];

let nextId = 0;
function createMessage(role: Message["role"], text: string, extra: Partial<Message> = {}): Message {
  nextId += 1;
  return { id: nextId, role, text, ...extra };
}

export interface OwlAidChatProps {
  initialMode?: "school" | "igcse";
  initialSubject?: string;
  initialPrompt?: string;
  signedInApproved?: boolean;
}

export default function OwlAidChat({
  initialMode = "school",
  initialSubject,
  initialPrompt,
  signedInApproved = true,
}: OwlAidChatProps) {
  const [assistantMode, setAssistantMode] = useState<"school" | "igcse">(initialMode);
  const [subjectId, setSubjectId] = useState<StudySubjectId | "general">(
    isStudySubjectId(initialSubject) ? initialSubject : "biology"
  );
  const [coachMode, setCoachMode] = useState<StudyCoachMode>("explain");
  const [tier, setTier] = useState<StudyTier>("extended");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState(initialPrompt ? initialPrompt.slice(0, 600) : "");
  const [busy, setBusy] = useState(false);
  const [lastMode, setLastMode] = useState<"local" | "ai" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeSubject = subjectId !== "general" ? SUBJECT_BY_ID[subjectId] : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function submitQuestion(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || question.length > 600 || busy) return;

    const history: HistoryTurn[] = messages.slice(-8).map((message) => ({
      role: message.role === "user" ? "user" : "model",
      text: message.text,
    }));

    const studyPayload: StudyContext | undefined =
      assistantMode === "igcse"
        ? { enabled: true, subjectId, coachMode, tier }
        : undefined;

    const studyBadge =
      assistantMode === "igcse"
        ? `${activeSubject ? `${activeSubject.shortName} ${activeSubject.syllabusCode}` : "IGCSE"} · ${tier === "extended" ? "Extended" : "Core"}`
        : undefined;

    setMessages((current) => [...current, createMessage("user", question)]);
    setDraft("");
    setBusy(true);
    try {
      const requestBody = studyPayload
        ? { message: question, history, study: studyPayload }
        : { message: question, history };

      const response = await fetch("/api/owlaid/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data: Partial<ChatResult> & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (typeof data.reply !== "string" || (data.mode !== "local" && data.mode !== "ai")) {
        throw new Error("The server returned an unexpected response.");
      }
      setMessages((current) => [
        ...current,
        createMessage("bot", data.reply!, {
          mode: data.mode,
          model: data.model,
          notice: data.notice,
          studyBadge,
        }),
      ]);
      setLastMode(data.mode);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      setMessages((current) => [...current, createMessage("bot", `⚠️ ${text}`)]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitQuestion(draft);
  }

  function inputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const igcsePrompts = activeSubject
    ? activeSubject.quickPrompts
    : [
        { label: "Command words", prompt: "Explain the difference between Describe, Explain, and Evaluate in Cambridge IGCSE exams." },
        { label: "Revision timetable strategy", prompt: "How should I structure active recall revision across Sciences and Mathematics?" },
        { label: "Exam technique", prompt: "What are the top examiner tips for avoiding lost marks in IGCSE Extended papers?" },
      ];

  return (
    <div className={styles.page}>
      <section className={styles.banner}>
        <div className={styles.bannerInner}>
          <div className={styles.brand}>
            <div className={styles.logo}>
              <WiseOwlLogo variant="shield" size={40} eager />
            </div>
            <div>
              <div className={styles.schoolName}>WISE OWL HUB 5.0 · WESTGATE</div>
              <h1>OwlAid <span>5.0</span></h1>
              <p>School information assistant &amp; Cambridge IGCSE Study Mode</p>
            </div>
          </div>

          <div className={styles.modeSwitcher} role="tablist" aria-label="OwlAid assistant mode">
            <button
              type="button"
              role="tab"
              aria-selected={assistantMode === "school"}
              className={`${styles.modeTab} ${assistantMode === "school" ? styles.modeTabActive : ""}`}
              onClick={() => setAssistantMode("school")}
              data-testid="owlaid-mode-school"
            >
              <BookOpen size={15} /> School Info
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={assistantMode === "igcse"}
              className={`${styles.modeTab} ${assistantMode === "igcse" ? styles.modeTabActive : ""}`}
              onClick={() => setAssistantMode("igcse")}
              data-testid="owlaid-mode-igcse"
            >
              <BrainCircuit size={15} /> IGCSE Study Mode
            </button>
          </div>
        </div>
      </section>

      {assistantMode === "igcse" && (
        <section className={styles.studyControlsBar} aria-label="IGCSE Study Mode controls" data-testid="igcse-study-controls">
          <div className={styles.studyControlsInner}>
            <label className={styles.controlField}>
              <span>IGCSE Subject</span>
              <select
                aria-label="IGCSE Subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value as StudySubjectId | "general")}
              >
                <option value="general">General IGCSE</option>
                {STUDY_SUBJECTS.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name} ({subject.syllabusCode})
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.controlField}>
              <span>Coaching Style</span>
              <select
                aria-label="Coaching Style"
                value={coachMode}
                onChange={(e) => setCoachMode(e.target.value as StudyCoachMode)}
              >
                {COACH_MODES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.controlField}>
              <span>Cambridge Tier</span>
              <div className={styles.tierToggle} role="group" aria-label="Cambridge Tier">
                <button
                  type="button"
                  className={tier === "core" ? styles.tierActive : ""}
                  onClick={() => setTier("core")}
                >
                  Core
                </button>
                <button
                  type="button"
                  className={tier === "extended" ? styles.tierActive : ""}
                  onClick={() => setTier("extended")}
                >
                  Extended
                </button>
              </div>
            </div>

            <div className={styles.studyCrossLinks}>
              <Link
                href={activeSubject ? `/quizzes?subject=${activeSubject.id}` : "/quizzes"}
                className={styles.crossLink}
              >
                <ClipboardCheck size={14} /> Take {activeSubject ? activeSubject.shortName : "IGCSE"} Quiz
              </Link>
              <Link
                href={activeSubject ? `/flashcards?subject=${activeSubject.id}` : "/flashcards"}
                className={styles.crossLink}
              >
                <Layers size={14} /> Review Cards
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Resources and quick prompts">
          <div className={styles.sidebarIntro}>
            <div className={styles.eyebrow}>
              {assistantMode === "igcse" ? "IGCSE STUDY MODE" : "WELCOME TO OWLAID"}
            </div>
            <h2>
              {assistantMode === "igcse"
                ? activeSubject
                  ? `${activeSubject.name}`
                  : "Cambridge IGCSE Tutor"
                : "Ask. Discover. Learn."}
            </h2>
            <p>
              {assistantMode === "igcse"
                ? activeSubject
                  ? `${activeSubject.syllabusCode} · ${COACH_MODES.find((c) => c.id === coachMode)?.blurb}`
                  : "Get structured syllabus explanations, mark-scheme breakdowns, and active-recall coaching."
                : "Explore school information with built-in answers and switch to IGCSE Study Mode anytime."}
            </p>
          </div>

          {assistantMode === "school" ? (
            <>
              <div className={styles.sideSection}>
                <h3>Quick questions</h3>
                <div className={styles.quickList}>
                  {schoolSuggestions.map(({ icon, label, question }) => (
                    <button
                      type="button"
                      className={styles.quickButton}
                      disabled={busy}
                      key={question}
                      onClick={() => void submitQuestion(question)}
                    >
                      <span aria-hidden="true">{icon}</span>
                      <span>{label}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.sideSection}>
                <h3>School snapshot</h3>
                <dl className={styles.factList}>
                  <div><dt>Opened</dt><dd>2023</dd></div>
                  <div><dt>Location</dt><dd>Westgate, Harare</dd></div>
                  <div><dt>Curriculum</dt><dd>Cambridge</dd></div>
                  <div><dt>Motto</dt><dd>Going an Extra Mile</dd></div>
                </dl>
              </div>
              <div className={styles.note}>
                School facts are from OwlAid 3.8 and should be confirmed by school staff. Staff names, hours and schedules are unverified until confirmed. OwlAid is not an official announcement channel.
              </div>
            </>
          ) : (
            <>
              <div className={styles.sideSection}>
                <h3>IGCSE Study Prompts</h3>
                <div className={styles.quickList}>
                  {igcsePrompts.map(({ label, prompt }) => (
                    <button
                      type="button"
                      className={styles.quickButton}
                      disabled={busy}
                      key={label}
                      onClick={() => void submitQuestion(prompt)}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      <span>{label}</span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </div>

              {activeSubject && (
                <div className={styles.sideSection}>
                  <h3>Key Syllabus Formulas &amp; Facts</h3>
                  <dl className={styles.formulaList}>
                    {activeSubject.keyFormulasOrFacts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.detail}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className={styles.note}>
                IGCSE Study Mode pairs Gemini tutoring with built-in offline syllabus references. Always cross-check coursework deadlines and official exam timetables with your Wise Owl teachers.
              </div>
            </>
          )}
        </aside>

        <section className={styles.chatCard} aria-label="OwlAid chat">
          <div className={styles.chatTop}>
            <div className={styles.chatTitle}>
              <span className={styles.chatIcon} aria-hidden="true">
                <WiseOwlLogo variant="shield" size={26} alt="" />
              </span>
              <div>
                <strong>
                  {assistantMode === "igcse"
                    ? `OwlAid IGCSE Study Mode${activeSubject ? ` · ${activeSubject.shortName}` : ""}`
                    : "OwlAid Chat"}
                </strong>
                <small>
                  {assistantMode === "igcse"
                    ? `${tier === "extended" ? "Extended" : "Core"} tier · ${COACH_MODES.find((c) => c.id === coachMode)?.label}`
                    : "School information & study help"}
                </small>
              </div>
            </div>
            <div className={styles.chatActions}>
              <span className={styles.status}>
                <span className={styles.statusDot} />
                {lastMode === "ai" ? "AI response" : lastMode === "local" ? "Local answer" : "Ready"}
              </span>
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  setMessages([]);
                  setLastMode(null);
                }}
                disabled={busy || messages.length === 0}
              >
                Clear
              </button>
            </div>
          </div>

          {!signedInApproved && (
            <div className={styles.authStrip}>
              <span>Sign in with an approved Wise Owl school account to chat with OwlAid.</span>
              <Link href="/login?next=/owlaid">Sign in →</Link>
            </div>
          )}

          <div className={styles.chatMessages} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 && assistantMode === "school" && (
              <div className={styles.welcome}>
                <div className={styles.welcomeOwl}>
                  <WiseOwlLogo variant="crest" size={96} framed eager />
                </div>
                <h2>Hello! Welcome to OwlAid.</h2>
                <p>
                  I can answer questions about Wise Owl, its academics, clubs and school values—or switch to IGCSE Study Mode for subject tutoring.
                </p>
                <div className={styles.welcomeChips}>
                  <button type="button" onClick={() => void submitQuestion("What is the school motto?")} disabled={busy}>
                    School motto
                  </button>
                  <button type="button" onClick={() => void submitQuestion("Who founded the school?")} disabled={busy}>
                    Our founders
                  </button>
                  <button type="button" onClick={() => setAssistantMode("igcse")} disabled={busy}>
                    Switch to IGCSE Study Mode →
                  </button>
                </div>
              </div>
            )}

            {messages.length === 0 && assistantMode === "igcse" && (
              <div className={styles.welcome}>
                <div className={styles.welcomeOwl}>
                  <WiseOwlLogo variant="crest" size={96} framed eager />
                </div>
                <h2>
                  IGCSE Study Mode{activeSubject ? `: ${activeSubject.name}` : ""}
                </h2>
                <p>
                  Ask a syllabus concept, paste a past-paper topic, or choose a quick prompt below for structured Cambridge {tier === "extended" ? "Extended" : "Core"} guidance.
                </p>
                <div className={styles.welcomeChips}>
                  {igcsePrompts.map(({ label, prompt }) => (
                    <button
                      type="button"
                      key={label}
                      onClick={() => void submitQuestion(prompt)}
                      disabled={busy}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                className={`${styles.messageRow} ${message.role === "user" ? styles.fromUser : styles.fromBot}`}
                key={message.id}
              >
                <div className={styles.avatar} aria-hidden="true">
                  {message.role === "user" ? "YOU" : <WiseOwlLogo variant="shield" size={22} alt="" />}
                </div>
                <div className={styles.messageBody}>
                  <div className={styles.messageText}>{message.text}</div>
                  {message.mode && (
                    <span className={styles.messageSource}>
                      {message.mode === "local"
                        ? message.studyBadge
                          ? `📘 IGCSE Study Reference · ${message.studyBadge}`
                          : "📚 School knowledge"
                        : `✦ Gemini AI${message.model ? ` · ${message.model}` : ""}${message.studyBadge ? ` · ${message.studyBadge}` : ""}`}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {busy && (
              <div className={`${styles.messageRow} ${styles.fromBot}`}>
                <div className={styles.avatar} aria-hidden="true">
                  <WiseOwlLogo variant="shield" size={22} alt="" />
                </div>
                <div className={styles.typing} aria-label="OwlAid is replying">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submitForm}>
            <label className={styles.srOnly} htmlFor="owlaid-input">
              Ask OwlAid a question
            </label>
            <textarea
              id="owlaid-input"
              ref={inputRef}
              placeholder={
                assistantMode === "igcse"
                  ? `Ask an IGCSE ${activeSubject ? activeSubject.name : "study"} question (${COACH_MODES.find((c) => c.id === coachMode)?.label})…`
                  : "Ask OwlAid a question…"
              }
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={inputKeyDown}
              maxLength={600}
              rows={2}
              disabled={busy}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={busy || !draft.trim()}
              aria-label="Send message"
            >
              {busy ? "…" : "Send ↗"}
            </button>
          </form>
          <p className={styles.chatFooter}>
            Enter to send · Shift+Enter for a new line · Don&apos;t share passwords or private student records.
          </p>
        </section>
      </div>
    </div>
  );
}
