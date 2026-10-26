import { streamCompletion } from "../lib/providers.ts";

async function main() {
  const target = {
    provider: "groq" as const,
    apiKey: "test-key",
    model: "mock-model",
    baseUrl: "http://127.0.0.1:4010/v1",
  };
  let out = "";
  for await (const chunk of streamCompletion(target, [
    { role: "system", content: "test" },
    { role: "user", content: "cześć" },
  ])) {
    out += chunk;
  }
  console.log("STRUMIEŃ:", JSON.stringify(out));
  if (out !== "Dzień dobry. Jestem Zayra.") {
    console.error("BŁĄD: nieoczekiwana treść");
    process.exit(1);
  }
  console.log("OK: parsowanie SSE działa poprawnie");
}
main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
