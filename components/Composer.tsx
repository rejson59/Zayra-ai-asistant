"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, SendIcon, StopIcon } from "./Icons";

type ComposerProps = {
  onSend: (text: string) => void;
  onStop: () => void;
  onMic: () => void;
  busy: boolean;
  listening: boolean;
  micSupported: boolean;
  progress: number;
};

/** Pasek pisania — na tablecie działa też z klawiatury ekranowej. */
export function Composer({
  onSend,
  onStop,
  onMic,
  busy,
  listening,
  micSupported,
  progress,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    setValue("");
    onSend(text);
  };

  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {progress > 0 && (
        <div className="composer-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </div>
      )}
      <div className="composer-inner">
        <button
          type="button"
          className={`icon-btn mic-mini ${listening ? "is-live" : ""}`}
          onClick={onMic}
          disabled={!micSupported || busy}
          aria-label={listening ? "Zatrzymaj słuchanie" : "Powiedz do Zayry"}
          title={micSupported ? "Mów (spacja)" : "Przeglądarka nie obsługuje mikrofonu"}
        >
          <MicIcon size={21} />
        </button>

        <textarea
          ref={textareaRef}
          className="composer-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Napisz do Zayry…"
          rows={1}
          inputMode="text"
          autoComplete="off"
          aria-label="Wiadomość do Zayry"
        />

        {busy ? (
          <button type="button" className="send-btn is-stop" onClick={onStop} aria-label="Przerwij">
            <StopIcon size={20} />
          </button>
        ) : (
          <button
            type="submit"
            className="send-btn"
            disabled={!value.trim()}
            aria-label="Wyślij wiadomość"
          >
            <SendIcon size={20} />
          </button>
        )}
      </div>
    </form>
  );
}
