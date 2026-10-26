import { NextResponse } from "next/server";
import { buildSystemPrompt, trimHistory } from "@/lib/persona";
import { streamCompletion, type ProviderTarget } from "@/lib/providers";
import type { AddressForm, AssistantMode, Message, ProviderId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function resolveTarget(): ProviderTarget | null {
  const env = process.env;
  if (env.GROQ_API_KEY) {
    return {
      provider: "groq",
      apiKey: env.GROQ_API_KEY,
      model: env.AI_MODEL || "llama-3.3-70b-versatile",
      baseUrl: "https://api.groq.com/openai/v1",
    };
  }
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return {
      provider: "gemini",
      apiKey: (env.GEMINI_API_KEY || env.GOOGLE_API_KEY)!,
      model: env.AI_MODEL || "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    };
  }
  if (env.OPENROUTER_API_KEY) {
    return {
      provider: "openrouter",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }
  if (env.OPENAI_BASE_URL) {
    return {
      provider: "custom",
      apiKey: env.OPENAI_API_KEY || "",
      model: env.AI_MODEL || "llama3.1",
      baseUrl: env.OPENAI_BASE_URL,
    };
  }
  return null;
}

export async function POST(req: Request) {
  let body: {
    messages?: Message[];
    mode?: AssistantMode;
    address?: AddressForm;
    aboutMe?: string;
    memory?: string[];
    provider?: ProviderId;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane żądania." }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  if (!history.some((m) => m.role === "user")) {
    return NextResponse.json({ error: "Brak treści wiadomości." }, { status: 400 });
  }

  const target = resolveTarget();
  if (!target) {
    return NextResponse.json(
      {
        error:
          "Serwer nie ma skonfigurowanego modelu. Dodaj klucz w Ustawieniach aplikacji albo w zmiennych środowiskowych (GROQ_API_KEY).",
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  const systemPrompt = buildSystemPrompt({
    mode: body.mode ?? "auto",
    address: body.address ?? "formal",
    aboutMe: body.aboutMe,
    memory: Array.isArray(body.memory) ? body.memory : [],
  });

  const messages = [{ role: "system" as const, content: systemPrompt }, ...trimHistory(history)];

  try {
    const stream = streamCompletion(target, messages, req.signal);
    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Nie udało się pobrać odpowiedzi z modelu.";
          controller.enqueue(encoder.encode(`\u0000ERROR:${message}`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Błąd modelu." },
      { status: 502 }
    );
  }
}
