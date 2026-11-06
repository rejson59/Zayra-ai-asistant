import type { TtsProvider, TtsSettings } from "./types";

export type TtsPreset = {
  label: string;
  /** krótki opis w UI */
  hint: string;
  /** gdzie wziąć klucz / jak uruchomić */
  keyUrl: string;
  models: string[];
  needsKey: boolean;
  /** czy potrzebny własny adres serwera */
  needsBaseUrl: boolean;
  /** czy głos wybieramy ręcznie (id) */
  needsVoiceId: boolean;
};

export const TTS_PRESETS: Record<TtsProvider, TtsPreset> = {
  browser: {
    label: "Głos systemowy (offline)",
    hint: "Darmowy, natychmiastowy, bez internetu. Brzmi jak syntezator Androida.",
    keyUrl: "",
    models: [],
    needsKey: false,
    needsBaseUrl: false,
    needsVoiceId: false,
  },
  elevenlabs: {
    label: "ElevenLabs",
    hint: "Najbardziej ludzki głos i klonowanie z próbki. Darmowe 10 tys. znaków miesięcznie.",
    keyUrl: "https://elevenlabs.io/app/settings/api-keys",
    models: ["eleven_flash_v2_5", "eleven_turbo_v2_5", "eleven_multilingual_v2"],
    needsKey: true,
    needsBaseUrl: false,
    needsVoiceId: true,
  },
  fishaudio: {
    label: "Fish Audio",
    hint: "Tanie klonowanie głosu, dobre wsparcie polskiego. Darmowe kredyty na start.",
    keyUrl: "https://fish.audio/go-api/",
    models: ["s1", "speech-1.6"],
    needsKey: true,
    needsBaseUrl: false,
    needsVoiceId: true,
  },
  local: {
    label: "Własny serwer (XTTS / Piper)",
    hint: "Zero opłat, pełna prywatność, prawdziwe klonowanie z Twojej próbki. Wymaga komputera w sieci.",
    keyUrl: "",
    models: ["xtts", "piper"],
    needsKey: false,
    needsBaseUrl: true,
    needsVoiceId: true,
  },
};

/** Usuwa z tekstu rzeczy, których nie powinno się czytać na głos. */
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export type SynthesizeArgs = {
  text: string;
  tts: TtsSettings;
  signal?: AbortSignal;
};

/**
 * Syntezuje mowę i zwraca gotowy plik audio.
 * Dla providera "browser" zwraca null — wtedy używamy Web Speech API.
 *
 * ElevenLabs i Fish Audio idą przez /api/tts (klucz nie jest wystawiony w przeglądarce
 * bardziej niż musi). Własny serwer w LAN wołamy bezpośrednio — Vercel go nie dosięgnie.
 */
export async function synthesizeSpeech({ text, tts, signal }: SynthesizeArgs): Promise<Blob | null> {
  if (tts.provider === "browser" || !text.trim()) return null;

  if (tts.provider === "local") {
    const url = `${tts.baseUrl.replace(/\/+$/, "")}/audio/speech`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tts.apiKey ? { Authorization: `Bearer ${tts.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: tts.model || "xtts",
        input: text,
        voice: tts.voiceId || "pl",
        response_format: "mp3",
        speed: 1,
      }),
      signal,
    });
    if (!res.ok) throw new Error(await ttsError(res, "Własny serwer TTS"));
    return await res.blob();
  }

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: tts.provider,
      apiKey: tts.apiKey,
      voiceId: tts.voiceId,
      model: tts.model,
      text,
    }),
    signal,
  });

  if (!res.ok) throw new Error(await ttsError(res, TTS_PRESETS[tts.provider].label));
  return await res.blob();
}

async function ttsError(res: Response, label: string): Promise<string> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message || body?.message || body?.error || "";
    if (typeof detail === "object") detail = body?.error?.message || JSON.stringify(detail);
  } catch {
    /* ignore */
  }
  const map: Record<number, string> = {
    401: "Klucz głosu został odrzucony.",
    402: "Brak kredytów na koncie głosowym.",
    403: "Brak dostępu do tego głosu.",
    422: "Nieprawidłowy głos lub model.",
    429: "Limit zapytań głosowych wyczerpany — spróbuj za chwilę.",
  };
  const base = map[res.status] || `${label}: błąd HTTP ${res.status}.`;
  return detail ? `${base} (${String(detail).slice(0, 200)})` : base;
}
