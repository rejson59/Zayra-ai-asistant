import type { ProviderId } from "./types";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ProviderTarget = {
  provider: Exclude<ProviderId, "server" | "demo">;
  apiKey: string;
  model: string;
  baseUrl: string;
};

/** Odczytuje strumień SSE z serwera i zwraca kolejne fragmenty tekstu. */
async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error("Brak odpowiedzi ze strumienia.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        yield payload;
      } catch {
        /* ignore */
      }
    }
  }
}

async function describeError(res: Response): Promise<string> {
  let detail = "";
  try {
    const text = await res.text();
    const parsed = JSON.parse(text);
    detail = parsed?.error?.message || parsed?.message || text;
  } catch {
    /* ignore */
  }
  const map: Record<number, string> = {
    401: "Klucz API został odrzucony. Sprawdź, czy jest poprawny i aktywny.",
    402: "Model wymaga płatnego konta. Wybierz wariant darmowy.",
    403: "Brak dostępu do tego modelu na Twoim koncie.",
    404: "Nie znaleziono modelu — sprawdź nazwę w ustawieniach.",
    429: "Limit darmowych zapytań został chwilowo wyczerpany. Spróbuj za chwilę.",
    500: "Model chwilowo nie odpowiada. Spróbuj ponownie.",
    503: "Model jest przeciążony. Spróbuj ponownie.",
  };
  const base = map[res.status] || `Błąd modelu (HTTP ${res.status}).`;
  return detail ? `${base} (${String(detail).slice(0, 240)})` : base;
}

/** OpenAI-compatible: Groq, OpenRouter, Ollama, LM Studio, OpenAI… */
async function* streamOpenAICompatible(target: ProviderTarget, messages: ChatMsg[], signal?: AbortSignal) {
  const url = `${target.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (target.apiKey) headers.Authorization = `Bearer ${target.apiKey}`;
  if (target.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://zayra.app";
    headers["X-Title"] = "Zayra";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: target.model,
      messages,
      stream: true,
      temperature: 0.6,
      max_tokens: 800,
    }),
    signal,
  });

  if (!res.ok) throw new Error(await describeError(res));

  for await (const payload of readSSE(res)) {
    try {
      const json = JSON.parse(payload);
      const delta = json?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) yield delta;
    } catch {
      /* pomijamy niepełne fragmenty */
    }
  }
}

/** Google Gemini (generateContent + alt=sse) */
async function* streamGemini(target: ProviderTarget, messages: ChatMsg[], signal?: AbortSignal) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const url = `${target.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(
    target.model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(target.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    }),
    signal,
  });

  if (!res.ok) throw new Error(await describeError(res));

  for await (const payload of readSSE(res)) {
    try {
      const json = JSON.parse(payload);
      const parts = json?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const p of parts) {
          if (typeof p?.text === "string" && p.text) yield p.text;
        }
      }
    } catch {
      /* ignore */
    }
  }
}

export function streamCompletion(target: ProviderTarget, messages: ChatMsg[], signal?: AbortSignal) {
  return target.provider === "gemini"
    ? streamGemini(target, messages, signal)
    : streamOpenAICompatible(target, messages, signal);
}

/** Modele, które realnie istnieją w danym dostawcy — podpowiedzi w ustawieniach. */
export const MODEL_SUGGESTIONS: Record<Exclude<ProviderId, "server" | "demo">, string[]> = {
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "gemma2-9b-it"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
  openrouter: [
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-3-27b-it:free",
    "qwen/qwen3-235b-a22b:free",
    "deepseek/deepseek-chat-v3-0324:free",
  ],
  custom: ["llama3.1", "llama3.2", "qwen2.5", "mistral"],
};
