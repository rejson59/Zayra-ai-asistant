"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onFinalTranscript: (text: string) => void;
  onSpeechEnd?: () => void;
};

export function useSpeech({
  lang = "pl-PL",
  rate,
  voiceURI,
  autoSpeak,
  handsFree,
  onFinalTranscript,
  onSpeechEnd,
}: UseSpeechArgs) {
  const [state, setState] = useState<SpeechState>("idle");
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<RecognitionLike | null>(null);
  const speakingRef = useRef(false);
  const wantListeningRef = useRef(false);
  const finalTextRef = useRef("");
  const onFinalRef = useRef(onFinalTranscript);
  const onEndRef = useRef(onSpeechEnd);

  onFinalRef.current = onFinalTranscript;
  onEndRef.current = onSpeechEnd;

  /* ---------- Głosy ---------- */

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
      if (finalText.trim()) {
        finalTextRef.current = finalText.trim();
      }
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
    if (speakingRef.current) stopSpeaking();
    finalTextRef.current = "";
    setInterim("");
    setError(null);
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

  /* ---------- Synteza mowy ---------- */

  const stopSpeaking = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    speakingRef.current = false;
    setState("idle");
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!autoSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) {
        setState("idle");
        return;
      }
      const clean = text
        .replace(/[*_#`>]/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      if (!clean) return;

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
      utterance.onend = () => {
        speakingRef.current = false;
        setState("idle");
        onEndRef.current?.();
        if (handsFree) {
          window.setTimeout(() => startListening(), 420);
        }
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        setState("idle");
      };

      window.speechSynthesis.speak(utterance);
    },
    [autoSpeak, chosenVoice, handsFree, lang, rate, startListening]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    state,
    setState,
    supported,
    interim,
    voices: polishVoices,
    chosenVoice,
    error,
    setError,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
