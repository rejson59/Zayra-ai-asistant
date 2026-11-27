/** Rozpoznawanie mowy po polsku (Web Speech API). Zwraca transkrypt na żywo i po zakończeniu. */
export const sttSupported = (): boolean =>
  typeof window !== 'undefined' &&
  ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

export interface SttCallbacks {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (err: string) => void;
}

export interface SttHandle {
  stop: () => void;
  abort: () => void;
}

export function startStt(cb: SttCallbacks): SttHandle | null {
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'pl-PL';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = '';
  let stopped = false;

  rec.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r[0]?.transcript ?? '';
      if (r.isFinal) finalText += txt + ' ';
      else interim += txt;
    }
    cb.onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (e: any) => {
    if (e.error !== 'aborted' && e.error !== 'no-speech') cb.onError?.(String(e.error));
  };
  rec.onend = () => {
    if (!stopped) {
      stopped = true;
      cb.onFinal?.(finalText.trim());
    }
  };

  try {
    rec.start();
  } catch {
    return null;
  }

  return {
    stop: () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort: () => {
      stopped = true;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
  };
}
