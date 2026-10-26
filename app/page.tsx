"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "@/components/Composer";
import { MutedIcon, PlusIcon, SettingsIcon, SparkIcon, SpeakerIcon } from "@/components/Icons";
import { Orb } from "@/components/Orb";
import { SettingsPanel } from "@/components/SettingsPanel";
import { Thread } from "@/components/Thread";
import { useSpeech } from "@/hooks/useSpeech";
import { useZayra } from "@/hooks/useZayra";

const MODE_LABEL: Record<string, string> = {
  auto: "Auto",
  praca: "Praca",
  osobiste: "Osobiste",
};

const CONNECTION_LABEL: Record<string, string> = {
  checking: "łączę…",
  demo: "tryb demo",
  device: "model lokalny",
  server: "model serwera",
  error: "brak połączenia",
};

export default function Home() {
  const zayra = useZayra();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimer = useRef<number | null>(null);
  const lastSpokenRef = useRef("");

  const sendRef = useRef<(text: string) => void>(() => {});

  const speech = useSpeech({
    rate: zayra.settings.voiceRate,
    voiceURI: zayra.settings.voiceURI,
    autoSpeak: zayra.settings.autoSpeak,
    handsFree: zayra.settings.handsFree,
    onFinalTranscript: (text) => sendRef.current(text),
  });

  const { speak, stopSpeaking, startListening, stopListening, state: speechState } = speech;

  /** szacowany postęp czytania (Web Speech API nie raportuje go natywnie) */
  const trackProgress = useCallback((text: string) => {
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    const words = Math.max(1, text.split(/\s+/).length);
    const seconds = (words / 165) * 60 / zayra.settings.voiceRate;
    const started = performance.now();
    setProgress(0.02);
    progressTimer.current = window.setInterval(() => {
      const elapsed = (performance.now() - started) / 1000;
      const ratio = Math.min(1, elapsed / Math.max(1.2, seconds));
      setProgress(ratio);
      if (ratio >= 1 && progressTimer.current) {
        window.clearInterval(progressTimer.current);
        progressTimer.current = null;
        window.setTimeout(() => setProgress(0), 600);
      }
    }, 120);
  }, [zayra.settings.voiceRate]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      stopSpeaking();
      setProgress(0);
      const answer = await zayra.send(text);
      if (answer && zayra.settings.autoSpeak) {
        lastSpokenRef.current = answer;
        trackProgress(answer);
        speak(answer);
      }
    },
    [speak, stopSpeaking, trackProgress, zayra]
  );

  sendRef.current = handleSend;

  const handleMic = useCallback(() => {
    if (speechState === "listening") {
      stopListening();
      return;
    }
    stopSpeaking();
    setProgress(0);
    startListening();
  }, [speechState, startListening, stopListening, stopSpeaking]);

  const handleSpeak = useCallback(
    (text: string) => {
      if (speechState === "speaking") {
        stopSpeaking();
        setProgress(0);
        return;
      }
      lastSpokenRef.current = text;
      trackProgress(text);
      speak(text);
    },
    [speak, speechState, stopSpeaking, trackProgress]
  );

  /* Skróty klawiszowe — tablet z klawiaturą lub desktop. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.code === "Space" && !typing && !settingsOpen) {
        e.preventDefault();
        handleMic();
      }
      if (e.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (speechState === "speaking") handleSpeak("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMic, handleSpeak, settingsOpen, speechState]);

  useEffect(() => {
    return () => {
      if (progressTimer.current) window.clearInterval(progressTimer.current);
    };
  }, []);

  const busy = zayra.busy;
  const orbState = busy ? "thinking" : speechState;

  return (
    <div className="app">
      <div className="aurora" aria-hidden>
        <span className="aurora-1" />
        <span className="aurora-2" />
        <span className="aurora-3" />
      </div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden>
            <SparkIcon size={18} />
          </div>
          <div>
            <h1>Zayra</h1>
            <p className="brand-sub">
              <span className={`conn-dot conn-${zayra.connection}`} />
              asystentka · {CONNECTION_LABEL[zayra.connection]}
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="mode-pill" title="Tryb pracy Zayry">
            {MODE_LABEL[zayra.settings.mode]}
          </div>
          <button
            className="icon-btn"
            onClick={() => {
              if (speechState === "speaking") {
                stopSpeaking();
                setProgress(0);
              }
              zayra.updateSettings({ autoSpeak: !zayra.settings.autoSpeak });
            }}
            aria-label={zayra.settings.autoSpeak ? "Wyłącz czytanie na głos" : "Włącz czytanie na głos"}
            title={zayra.settings.autoSpeak ? "Czytanie włączone" : "Czytanie wyłączone"}
          >
            {zayra.settings.autoSpeak ? <SpeakerIcon size={19} /> : <MutedIcon size={19} />}
          </button>
          <button
            className="icon-btn"
            onClick={zayra.clearConversation}
            aria-label="Nowa rozmowa"
            title="Nowa rozmowa"
          >
            <PlusIcon size={20} />
          </button>
          <button
            className="icon-btn"
            onClick={() => setSettingsOpen(true)}
            aria-label="Ustawienia"
            title="Ustawienia"
          >
            <SettingsIcon size={20} />
          </button>
        </div>
      </header>

      <main className="stage">
        <Thread
          messages={zayra.messages}
          mode={zayra.settings.mode}
          busy={busy}
          interim={speech.interim}
          listening={speechState === "listening"}
          onSuggestion={handleSend}
          onSpeak={handleSpeak}
        />

        <section className="voice-dock" aria-label="Sterowanie głosem">
          {zayra.error && (
            <div className="alert" role="alert">
              {zayra.error}
              <button onClick={() => zayra.setError(null)} aria-label="Zamknij komunikat">
                ×
              </button>
            </div>
          )}
          {speech.error && (
            <div className="alert alert-warn" role="alert">
              {speech.error}
              <button onClick={() => speech.setError(null)} aria-label="Zamknij komunikat">
                ×
              </button>
            </div>
          )}

          <button
            className="orb-button"
            onClick={handleMic}
            disabled={!speech.supported || busy}
            aria-label={
              speechState === "listening"
                ? "Zakończ mówienie"
                : "Zacznij mówić do Zayry"
            }
          >
            <Orb state={orbState} busy={busy} progress={progress} />
          </button>

          <p className="dock-hint">
            {!speech.supported
              ? "Ta przeglądarka nie obsługuje mikrofonu — użyj Chrome na Androidzie lub napisz wiadomość."
              : speechState === "listening"
                ? "Słucham… naciśnij, gdy skończysz."
                : speechState === "speaking"
                  ? "Mówię. Naciśnij, aby przerwać."
                  : busy
                    ? "Myślę…"
                    : zayra.settings.handsFree
                      ? "Tryb głośnomówiący włączony — po odpowiedzi włączę mikrofon."
                      : "Naciśnij kulę lub klawisz spacji, żeby mówić."}
          </p>
        </section>
      </main>

      <div className="bottom">
        <Composer
          onSend={handleSend}
          onStop={zayra.stop}
          onMic={handleMic}
          busy={busy}
          listening={speechState === "listening"}
          micSupported={speech.supported}
          progress={progress}
        />
      </div>

      <SettingsPanel
        open={settingsOpen}
        settings={zayra.settings}
        memory={zayra.memory}
        activeModel={zayra.activeModel}
        connection={zayra.connection}
        serverProvider={zayra.serverConfig?.provider ?? null}
        voices={speech.voices}
        onClose={() => setSettingsOpen(false)}
        onChange={zayra.updateSettings}
        onRemoveMemory={zayra.removeMemory}
        onClearConversation={() => {
          zayra.clearConversation();
          setSettingsOpen(false);
        }}
        onExport={zayra.exportConversation}
      />
    </div>
  );
}
