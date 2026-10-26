import { NextResponse } from "next/server";
import type { ServerConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Mówi aplikacji, czy na serwerze (Vercel) jest już klucz API.
 * Nie ujawnia kluczy — tylko informację, który dostawca jest aktywny.
 */
export async function GET() {
  const env = process.env;
  let config: ServerConfig = { configured: false, provider: null, model: null };

  if (env.GROQ_API_KEY) {
    config = { configured: true, provider: "groq", model: env.AI_MODEL || "llama-3.3-70b-versatile" };
  } else if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    config = { configured: true, provider: "gemini", model: env.AI_MODEL || "gemini-2.5-flash" };
  } else if (env.OPENROUTER_API_KEY) {
    config = {
      configured: true,
      provider: "openrouter",
      model: env.AI_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
    };
  } else if (env.OPENAI_BASE_URL) {
    config = { configured: true, provider: "custom", model: env.AI_MODEL || "llama3.1" };
  }

  return NextResponse.json(config);
}
