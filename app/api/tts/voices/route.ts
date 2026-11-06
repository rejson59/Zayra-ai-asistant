import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ELEVEN_BASE = process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io";

type Voice = { id: string; name: string; labels: Record<string, string> | null };

/** Lista głosów ElevenLabs dostępnych na koncie — żeby nie trzeba było przepisywać ID. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const apiKey = url.searchParams.get("key")?.trim() || process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: { message: "Brak klucza ElevenLabs." } }, { status: 401 });
  }

  try {
    const res = await fetch(`${ELEVEN_BASE}/v1/voices`, {
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: { message: text.slice(0, 300) || `ElevenLabs: HTTP ${res.status}` } },
        { status: res.status }
      );
    }

    const json = (await res.json()) as { voices?: Voice[] };
    const voices = (json.voices ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      labels: v.labels,
    }));

    return NextResponse.json({ voices });
  } catch (err) {
    return NextResponse.json(
      { error: { message: err instanceof Error ? err.message : "Błąd pobierania głosów." } },
      { status: 502 }
    );
  }
}
