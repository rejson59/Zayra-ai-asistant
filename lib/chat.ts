import { buildSystemPrompt, trimHistory } from "./persona";
import { streamCompletion, type ProviderTarget } from "./providers";
import type { Message, Settings } from "./types";

export type ChatOptions = {
  messages: Message[];
  settings: Settings;
  signal?: AbortSignal;
};

function targetFromDevice(settings: Settings): ProviderTarget | null {
  const device = settings.device;
  if (!device?.apiKey && device?.provider !== "custom") return null;
  if (!device) return null;

  const baseUrls: Record<string, string> = {
    groq: "https://api.groq.com/openai/v1",
    openrouter: "https://openrouter.ai/api/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
  };

  return {
    provider: device.provider,
    apiKey: device.apiKey,
    model: device.model,
    baseUrl: device.provider === "custom" ? device.baseUrl : baseUrls[device.provider],
  };
}

/**
 * Strumieniuje odpowiedź Zayry jako zwykły tekst.
 * Priorytet: klucz zapisany na tablecie → klucz na serwerze.
 */
export async function* askZayra({ messages, settings, signal }: ChatOptions): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt({
    mode: settings.mode,
    address: settings.address,
    aboutMe: settings.aboutMe,
  });

  const device = targetFromDevice(settings);

  if (device) {
    const payload = [{ role: "system" as const, content: systemPrompt }, ...trimHistory(messages)];
    yield* streamCompletion(device, payload, signal);
    return;
  }

  // Serwer: personę buduje route handler, więc wysyłamy tylko kontekst.
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      mode: settings.mode,
      address: settings.address,
      aboutMe: settings.aboutMe,
    }),
    signal,
  });

  if (!res.ok) {
    let message = `Błąd ${res.status}.`;
    let code = "";
    try {
      const json = await res.json();
      message = json.error || message;
      code = json.code || "";
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(message), { code });
  }

  if (!res.body) throw new Error("Brak odpowiedzi z serwera.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const errorAt = buffer.indexOf("\u0000ERROR:");
    if (errorAt >= 0) {
      throw new Error(buffer.slice(errorAt + 8).trim() || "Błąd modelu.");
    }

    if (buffer) {
      const out = buffer;
      buffer = "";
      yield out;
    }
  }
}
