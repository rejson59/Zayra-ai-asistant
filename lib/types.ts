export type Role = "system" | "user" | "assistant";

export type Message = {
  id: string;
  role: Role;
  content: string;
  /** ISO timestamp */
  at: string;
  /** czy odpowiedź pochodzi z trybu demo (bez klucza API) */
  demo?: boolean;
};

export type AssistantMode = "auto" | "praca" | "osobiste";

export type AddressForm = "boss" | "formal" | "informal";

export type ProviderId = "groq" | "openrouter" | "gemini" | "custom" | "server" | "demo";

export type DeviceProviderConfig = {
  provider: Exclude<ProviderId, "server" | "demo">;
  apiKey: string;
  model: string;
  /** tylko dla provider === "custom" (Ollama / LM Studio / inny OpenAI-compatible) */
  baseUrl: string;
};

export type Settings = {
  mode: AssistantMode;
  address: AddressForm;
  autoSpeak: boolean;
  voiceRate: number;
  voiceURI: string | null;
  handsFree: boolean;
  device: DeviceProviderConfig | null;
  aboutMe: string;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "auto",
  address: "boss",
  autoSpeak: true,
  voiceRate: 1.02,
  voiceURI: null,
  handsFree: false,
  device: null,
  aboutMe: "",
};

export const PROVIDER_PRESETS: Record<
  Exclude<ProviderId, "server" | "demo">,
  { label: string; baseUrl: string; model: string; keyUrl: string; hint: string }
> = {
  groq: {
    label: "Groq (darmowy)",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    keyUrl: "https://console.groq.com/keys",
    hint: "Szybki i darmowy. Klucz bez karty płatniczej.",
  },
  gemini: {
    label: "Google Gemini (darmowy)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/apikey",
    hint: "Hojny limit darmowy. Dobry do rozmów głosowych.",
  },
  openrouter: {
    label: "OpenRouter (modele :free)",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    keyUrl: "https://openrouter.ai/keys",
    hint: "Wiele modeli, wybierz wariant z dopiskiem :free.",
  },
  custom: {
    label: "Własny serwer (Ollama / LM Studio)",
    baseUrl: "http://192.168.1.10:11434/v1",
    model: "llama3.1",
    keyUrl: "",
    hint: "W 100% lokalnie i prywatnie. Komputer musi być w tej samej sieci.",
  },
};

export type ServerConfig = {
  configured: boolean;
  provider: Exclude<ProviderId, "server" | "demo"> | null;
  model: string | null;
};
