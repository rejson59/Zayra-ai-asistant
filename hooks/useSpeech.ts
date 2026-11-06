"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeForSpeech, synthesizeSpeech } from "@/lib/tts";
import type { TtsSettings } from "@/lib/types";

/* ---------- Typy Web Speech API (nie ma ich w lib.dom) ---------- */

type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
};
type SpeechRecognitionErrorEventLike = { error: string; message?: string };

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
};

type RecognitionCtor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

export type SpeechState = "idle" | "listening" | "thinking" | "speaking";

type UseSpeechArgs = {
  lang?: string;
  rate: number;
  voiceURI: string | null;
  autoSpeak: boolean;
  handsFree: boolean;
  tts: TtsSettings;
  onFinalTranscript: (text: string) => void;
  onSpeechEnd?: () => void;
};

export function useSpeech({
  lang = "pl-PL",
  rate,
  voiceURI,
  autoSpeak,
  handsFree,
  tts,
  onFinalTranscript,
  onSpeechEnd,
}: UseSpeechArgs) {
  const [state, setState] = useState<SpeechState>("idle");
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimer = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const wantListeningRef = useRef(false);
  const finalTextRef = useRef("");
  const onFinalRef = useRef(onFinalTranscript);
  const onEndRef = useRef(onSpeechEnd);
  const handsFreeRef = useRef(handsFree);

  onFinalRef.current = onFinalTranscript;
  onEndRef.current = onSpeechEnd;
  handsFreeRef.current = handsFree;

  /* ---------- Głosy systemowe ---------- */

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const polishVoices = useMemo(() => {
    const pl = voices.filter((v) => v.lang?.toLowerCase().startsWith("pl"));
    return (pl.length ? pl : voices).sort((a, b) => Number(b.localService) - Number(a.localService));
  }, [voices]);

  const chosenVoice = useMemo(() => {
    if (!polishVoices.length) return null;
    return polishVoices.find((v) => v.voiceURI === voiceURI) ?? polishVoices[0];
  }, [polishVoices, voiceURI]);

  /* ---------- Rozpoznawanie mowy ---------- */

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setError(null);
      setState("listening");
    };

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) finalTextRef.current = finalText.trim();
    };

    recognition.onerror = (event) => {
      const map: Record<string, string> = {
        "not-allowed": "Brak dostępu do mikrofonu. Zezwól na mikrofon w ustawieniach przeglądarki.",
        "service-not-allowed": "Przeglądarka zablokowała rozpoznawanie mowy.",
        "audio-capture": "Nie znaleziono mikrofonu.",
        network: "Brak połączenia z usługą rozpoznawania mowy.",
        "no-speech": "Nie usłyszałam nic. Spróbuj jeszcze raz.",
        aborted: "",
      };
      const message = map[event.error] ?? `Błąd mikrofonu: ${event.error}`;
      if (message) setError(message);
      wantListeningRef.current = false;
      setState("idle");
      setInterim("");
    };

    recognition.onend = () => {
      const text = finalTextRef.current;
      finalTextRef.current = "";
      setInterim("");
      wantListeningRef.current = false;
      if (text) {
        onFinalRef.current(text);
        return;
      }
      // Cisza — nie zapętlamy mikrofonu, czekamy na gest użytkownika.
      setState("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, [lang]);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (speakingRef.current) {
      abortRef.current?.abort();
      audioRef.current?.pause();
      audioRef.current = null;
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
    }
    finalTextRef.current = "";
    setInterim("");
    setError(null);
    setProgress(0);
    wantListeningRef.current = true;
    try {
      recognition.start();
      setState("listening");
    } catch {
      // start() rzuca, jeśli nasłuch już trwa — ignorujemy
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setState("idle");
  }, []);

  /* ---------- Postęp czytania ---------- */

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  /** Web Speech API nie raportuje postępu — szacujemy go z liczby słów. */
  const estimateProgress = useCallback(
    (text: string) => {
      stopProgress();
      const words = Math.max(1, text.split(/\s+/).length);
      const seconds = ((words / 165) * 60) / Math.max(0.5, rate);
      const started = performance.now();
      setProgress(0.02);
      progressTimer.current = window.setInterval(() => {
        const ratio = Math.min(1, (performance.now() - started) / 1000 / Math.max(1.2, seconds));
        setProgress(ratio);
        if (ratio >= 1) stopProgress();
      }, 120);
    },
    [rate, stopProgress]
  );

  /* ---------- Mowa ---------- */

  const stopSpeaking = useCallback(() => {
    stopProgress();
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    setProgress(0);
    setState("idle");
  }, [stopProgress]);

  const finishSpeaking = useCallback(() => {
    speakingRef.current = false;
    stopProgress();
    setProgress(1);
    setState("idle");
    onEndRef.current?.();
    if (handsFreeRef.current) {
      window.setTimeout(() => startListening(), 420);
    }
    window.setTimeout(() => setProgress(0), 700);
  }, [startListening, stopProgress]);

  /** Synteza systemowa (offline) — plan B i domyślny tryb. */
  const speakWithSystemVoice = useCallback(
    (clean: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        setState("idle");
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = 1.03;
      if (chosenVoice) utterance.voice = chosenVoice;

      utterance.onstart = () => {
        speakingRef.current = true;
        setState("speaking");
      };
      utterance.onend = finishSpeaking;
      utterance.onerror = () => {
        speakingRef.current = false;
        stopProgress();
        setState("idle");
      };

      estimateProgress(clean);
      window.speechSynthesis.speak(utterance);
    },
    [chosenVoice, estimateProgress, finishSpeaking, lang, rate, stopProgress]
  );

  /** Mowa z modelu (ElevenLabs / Fish Audio / własny serwer). */
  const speakWithModel = useCallback(
    async (clean: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const blob = await synthesizeSpeech({ text: clean, tts, signal: controller.signal });
        if (!blob) return false;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          finishSpeaking();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          speakingRef.current = false;
          setState("idle");
        };
        audio.ontimeupdate = () => {
          if (audio.duration && Number.isFinite(audio.duration)) {
            setProgress(Math.min(1, audio.currentTime / audio.duration));
          }
        };

        speakingRef.current = true;
        setState("speaking");
        await audio.play();
        return true;
      } catch (err) {
        if ((err as Error).name === "AbortError") return true;
        audioRef.current = null;
        speakingRef.current = false;
        setProgress(0);
        return false;
      } finally {
        abortRef.current = null;
      }
    },
    [finishSpeaking, tts]
  );

  const speak = useCallback(
    async (text: string) => {
      if (!autoSpeak) {
        setState("idle");
        return;
      }
      const clean = sanitizeForSpeech(text);
      if (!clean) return;

      if (tts.provider !== "browser") {
        const ok = await speakWithModel(clean);
        if (ok) return;
        // Model głosu zawiódł — mówimy systemowym, żeby rozmowa się nie urwała.
        setError("Nie udało się wygenerować głosu z modelu. Przeczytałam głosem systemowym.");
      }

      speakWithSystemVoice(clean);
    },
    [autoSpeak, speakWithModel, speakWithSystemVoice, tts.provider]
  );

  useEffect(() => {
    return () => {
      stopProgress();
      abortRef.current?.abort();
      audioRef.current?.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopProgress]);

  return {
    state,
    setState,
    supported,
    interim,
    voices: polishVoices,
    chosenVoice,
    error,
    setError,
    progress,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
