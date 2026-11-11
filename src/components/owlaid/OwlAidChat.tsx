"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatResult, HistoryTurn } from "@/lib/owlaid/types";
import styles from "./OwlAidChat.module.css";

type Message = {
  id: number;
  role: "user" | "bot";
  text: string;
  mode?: "local" | "ai";
  model?: string;
};

const suggestions = [
  { icon: "🏛️", label: "Mission & vision", question: "What are the school mission and vision?" },
  { icon: "🎓", label: "Cambridge curriculum", question: "What curriculum does the school follow?" },
  { icon: "🏅", label: "Sports & clubs", question: "What sports and clubs are available?" },
  { icon: "📍", label: "Location & contact", question: "Where is Wise Owl High School Westgate located?" },
];

let nextId = 0;
function createMessage(role: Message["role"], text: string, extra: Partial<Message> = {}): Message {
  nextId += 1;
  return { id: nextId, role, text, ...extra };
}

export default function OwlAidChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastMode, setLastMode] = useState<"local" | "ai" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  async function submitQuestion(rawQuestion: string) {
    const question = rawQuestion.trim();
    if (!question || question.length > 600 || busy) return;

    const history: HistoryTurn[] = messages.slice(-8).map((message) => ({
      role: message.role === "user" ? "user" : "model",
      text: message.text,
    }));

    setMessages((current) => [...current, createMessage("user", question)]);
    setDraft("");
    setBusy(true);
    try {
      const response = await fetch("/api/owlaid/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data: Partial<ChatResult> & { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      if (typeof data.reply !== "string" || (data.mode !== "local" && data.mode !== "ai")) {
        throw new Error("The server returned an unexpected response.");
      }
      setMessages((current) => [...current, createMessage("bot", data.reply!, { mode: data.mode, model: data.model })]);
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

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span>WISE OWL HIGH SCHOOL WESTGATE</span>
          <span className={styles.motto}>Going an Extra Mile</span>
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <div className={styles.logo} aria-hidden="true">🦉</div>
            <div>
              <div className={styles.schoolName}>WISE OWL HUB</div>
              <h1>OwlAid <span>4.0</span></h1>
              <p>Your student-built school information assistant</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Link href="/" className={styles.marketLink}>← CampusMarket</Link>
            <span className={styles.clubBadge}>ROBOTICS CLUB PROJECT</span>
          </div>
        </div>
      </header>

      <main id="main" className={styles.layout}>
        <aside className={styles.sidebar} aria-label="School resources and quick questions">
          <div className={styles.sidebarIntro}>
            <div className={styles.eyebrow}>WELCOME TO OWLAID</div>
            <h2>Ask. Discover. Learn.</h2>
            <p>Explore school information with built-in answers and an AI assistant.</p>
          </div>
          <div className={styles.sideSection}>
            <h3>Quick questions</h3>
            <div className={styles.quickList}>
              {suggestions.map(({ icon, label, question }) => (
                <button type="button" className={styles.quickButton} disabled={busy} key={question} onClick={() => void submitQuestion(question)}>
                  <span aria-hidden="true">{icon}</span><span>{label}</span><span aria-hidden="true">↗</span>
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
          <div className={styles.note}>School facts are from OwlAid 3.8 and should be confirmed by school staff. Staff names, hours and schedules are unverified until confirmed. OwlAid is not an official announcement channel.</div>
        </aside>

        <section className={styles.chatCard} aria-label="OwlAid chat">
          <div className={styles.chatTop}>
            <div className={styles.chatTitle}><span className={styles.chatIcon} aria-hidden="true">🦉</span><div><strong>OwlAid Chat</strong><small>School information & study help</small></div></div>
            <div className={styles.chatActions}>
              <span className={styles.status}><span className={styles.statusDot} />{lastMode === "ai" ? "AI response" : lastMode === "local" ? "Local answer" : "Ready"}</span>
              <button type="button" className={styles.clearButton} onClick={() => { setMessages([]); setLastMode(null); }} disabled={busy || messages.length === 0}>Clear</button>
            </div>
          </div>

          <div className={styles.chatMessages} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <div className={styles.welcomeOwl} aria-hidden="true">🦉</div>
                <h2>Hello! Welcome to OwlAid.</h2>
                <p>I can answer questions about Wise Owl, its academics, clubs and school values. Ask me anything to get started.</p>
                <div className={styles.welcomeChips}>
                  <button type="button" onClick={() => void submitQuestion("What is the school motto?")} disabled={busy}>School motto</button>
                  <button type="button" onClick={() => void submitQuestion("Who founded the school?")} disabled={busy}>Our founders</button>
                </div>
              </div>
            )}
            {messages.map((message) => (
              <div className={`${styles.messageRow} ${message.role === "user" ? styles.fromUser : styles.fromBot}`} key={message.id}>
                <div className={styles.avatar} aria-hidden="true">{message.role === "user" ? "YOU" : "🦉"}</div>
                <div className={styles.messageBody}>
                  <div className={styles.messageText}>{message.text}</div>
                  {message.mode && <span className={styles.messageSource}>{message.mode === "local" ? "📚 School knowledge" : `✦ Gemini AI${message.model ? ` · ${message.model}` : ""}`}</span>}
                </div>
              </div>
            ))}
            {busy && (
              <div className={`${styles.messageRow} ${styles.fromBot}`}>
                <div className={styles.avatar} aria-hidden="true">🦉</div>
                <div className={styles.typing} aria-label="OwlAid is replying"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submitForm}>
            <label className={styles.srOnly} htmlFor="owlaid-input">Ask OwlAid a question</label>
            <textarea id="owlaid-input" ref={inputRef} placeholder="Ask OwlAid a question…" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={inputKeyDown} maxLength={600} rows={2} disabled={busy} />
            <button type="submit" className={styles.sendButton} disabled={busy || !draft.trim()} aria-label="Send message">{busy ? "…" : "Send ↗"}</button>
          </form>
          <p className={styles.chatFooter}>Enter to send · Shift+Enter for a new line · Don&apos;t share passwords or private student records.</p>
        </section>
      </main>
      <footer className={styles.footer}>OwlAid 4.0 · Wise Owl High School Westgate · Student-built project</footer>
    </div>
  );
}
