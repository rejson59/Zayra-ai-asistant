import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ELEVEN_BASE = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";
const FISH_BASE = process.env.FISH_AUDIO_BASE_URL || "https://api.fish.audio";

type Body = {
  provider?: "elevenlabs" | "fishaudio";
  apiKey?: string;
  voiceId?: string;
  model?: string;
  text?: string;
};

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: { message } }, { status });
}

/**
 * Proxy do syntezy mowy. Klucz może przyjść z tabletu (Ustawienia)
 * albo siedzieć na serwerze jako zmienna środowiskowa.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return badRequest("Nieprawidłowe dane żądania.");
  }

  const text = (body.text || "").trim().slice(0, 2000);
  if (!text) return badRequest("Brak tekstu do przeczytania.");

  const provider = body.provider;
  if (provider !== "elevenlabs" && provider !== "fishaudio") {
    return badRequest("Nieobsługiwany dostawca głosu.");
  }

  const apiKey =
    body.apiKey?.trim() ||
    (provider === "elevenlabs" ? process.env.ELEVENLABS_API_KEY : process.env.FISH_AUDIO_API_KEY);

  if (!apiKey) {
    return NextResponse.json(
      {
        error: {
          message:
            provider === "elevenlabs"
              ? "Brak klucza ElevenLabs. Dodaj go w Ustawieniach → Głos."
              : "Brak klucza Fish Audio. Dodaj go w Ustawieniach → Głos.",
        },
      },
      { status: 401 }
    );
  }

  const voiceId = (body.voiceId || "").trim();
  if (!voiceId) return badRequest("Brak identyfikatora głosu.");

  try {
    const upstream =
      provider === "elevenlabs"
        ? await elevenLabs({ apiKey, voiceId, text, model: body.model, signal: req.signal })
        : await fishAudio({ apiKey, voiceId, text, model: body.model, signal: req.signal });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      let parsed = detail;
      try {
        const json = JSON.parse(detail);
        parsed = json?.detail?.message || json?.detail || json?.message || detail;
        if (typeof parsed === "object") parsed = JSON.stringify(parsed);
      } catch {
        /* tekst zostaje */
      }
      return NextResponse.json(
        { error: { message: String(parsed || "Dostawca głosu zwrócił błąd.").slice(0, 400) } },
        { status: upstream.status }
      );
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return new Response(null, { status: 499 });
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Nie udało się wygenerować głosu." } },
      { status: 502 }
    );
  }
}

async function elevenLabs(args: {
  apiKey: string;
  voiceId: string;
  text: string;
  model?: string;
  signal?: AbortSignal;
}) {
  const model = args.model || "eleven_flash_v2_5";
  const url = `${ELEVEN_BASE}/v1/text-to-speech/${encodeURIComponent(
    args.voiceId
  )}/stream?output_format=mp3_44100_128`;

  return fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": args.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: args.text,
      model_id: model,
      // stabilność niżej = żywsza intonacja; asystentka ma brzmieć naturalnie, nie pomnikowo
      voice_settings: {
        stability: 0.42,
        similarity_boost: 0.82,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
    signal: args.signal,
  });
}

async function fishAudio(args: {
  apiKey: string;
  voiceId: string;
  text: string;
  model?: string;
  signal?: AbortSignal;
}) {
  const url = `${FISH_BASE}/v1/tts`;

  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      ...(args.model ? { model: args.model } : {}),
    },
    body: JSON.stringify({
      text: args.text,
      reference_id: args.voiceId,
      format: "mp3",
      mp3_bitrate: 128,
      chunk_length: 200,
      normalize: true,
      latency: "normal",
    }),
    signal: args.signal,
  });
}
