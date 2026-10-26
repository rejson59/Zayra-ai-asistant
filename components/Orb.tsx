"use client";

import type { SpeechState } from "@/hooks/useSpeech";

type OrbProps = {
  state: SpeechState;
  busy?: boolean;
  progress?: number;
  size?: "lg" | "sm";
};

const LABELS: Record<string, string> = {
  idle: "Gotowa",
  listening: "Słucham",
  thinking: "Myślę",
  speaking: "Mówię",
};

/** Żywa kula głosowa: pulsuje w rytm stanu asystentki. */
export function Orb({ state, busy, progress = 0, size = "lg" }: OrbProps) {
  const effective: SpeechState = busy ? "thinking" : state;
  const bars = Array.from({ length: 5 });

  return (
    <div className={`orb-wrap orb-${size}`} data-state={effective}>
      <div className="orb-halo" aria-hidden />
      <div className="orb" aria-hidden>
        <div className="orb-core" />
        <div className="orb-sheen" />
        {effective === "listening" && (
          <div className="orb-wave">
            {bars.map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
        )}
        {effective === "thinking" && (
          <div className="orb-spin">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" />
            </svg>
          </div>
        )}
      </div>
      <div className="orb-caption">
        <span className="orb-dot" />
        {LABELS[effective]}
        {effective === "thinking" && <span className="orb-ellipsis" />}
      </div>
      {effective === "speaking" && (
        <div className="orb-progress" aria-hidden>
          <span style={{ width: `${Math.min(100, Math.max(2, progress * 100))}%` }} />
        </div>
      )}
    </div>
  );
}
