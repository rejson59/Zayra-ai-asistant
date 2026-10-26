"use client";

import { useEffect, useRef } from "react";
import { GREETING, SUGGESTIONS } from "@/lib/persona";
import type { AssistantMode, Message } from "@/lib/types";
import { SpeakerIcon } from "./Icons";

type ThreadProps = {
  messages: Message[];
  mode: AssistantMode;
  busy: boolean;
  interim: string;
  listening: boolean;
  onSuggestion: (prompt: string) => void;
  onSpeak: (text: string) => void;
};

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function Thread({
  messages,
  mode,
  busy,
  interim,
  listening,
  onSuggestion,
  onSpeak,
}: ThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, interim, busy]);

  const empty = messages.length === 0;

  return (
    <div className="thread" role="log" aria-live="polite" aria-label="Rozmowa z Zayrą">
      {empty && (
        <div className="empty">
          <p className="empty-greeting">{GREETING[mode]}</p>
          <p className="empty-hint">
            Kliknij kulę albo naciśnij spację, żeby mówić. Możesz też napisać.
          </p>
          <div className="suggestions">
            {SUGGESTIONS[mode].map((s) => (
              <button key={s.label} className="chip" onClick={() => onSuggestion(s.prompt)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m) => (
        <article key={m.id} className={`msg msg-${m.role}`}>
          <div className="msg-head">
            <span className="msg-who">{m.role === "user" ? "Ty" : "Zayra"}</span>
            <span className="msg-time">{timeOf(m.at)}</span>
            {m.demo && <span className="msg-badge">demo</span>}
          </div>
          <div className="msg-body">
            {m.content || (m.role === "assistant" && busy ? <span className="typing" /> : null)}
          </div>
          {m.role === "assistant" && m.content && !busy && (
            <button className="msg-speak" onClick={() => onSpeak(m.content)} title="Przeczytaj na głos">
              <SpeakerIcon size={15} />
              Przeczytaj
            </button>
          )}
        </article>
      ))}

      {listening && interim && (
        <article className="msg msg-user msg-interim">
          <div className="msg-head">
            <span className="msg-who">Ty</span>
            <span className="msg-badge">słucham</span>
          </div>
          <div className="msg-body">{interim}</div>
        </article>
      )}

      <div ref={endRef} />
    </div>
  );
}
