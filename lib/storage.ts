import { DEFAULT_SETTINGS, type Message, type Settings } from "./types";

const KEY_SETTINGS = "zayra.settings.v1";
const KEY_MESSAGES = "zayra.messages.v1";
const KEY_MEMORY = "zayra.memory.v1";

const isBrowser = () => typeof window !== "undefined";

export function loadSettings(): Settings {
  if (!isBrowser()) return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY_SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    /* brak miejsca / tryb prywatny */
  }
}

export function loadMessages(): Message[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY_MESSAGES);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages: Message[]) {
  if (!isBrowser()) return;
  try {
    // Trzymamy ostatnie 120 wiadomości, żeby nie zapychać pamięci tabletu.
    localStorage.setItem(KEY_MESSAGES, JSON.stringify(messages.slice(-120)));
  } catch {
    /* ignore */
  }
}

export function loadMemory(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY_MEMORY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveMemory(items: string[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY_MEMORY, JSON.stringify(items.slice(-60)));
  } catch {
    /* ignore */
  }
}

/**
 * Wyłapuje polecenia pamięci wypowiedziane naturalnie:
 * "zapamiętaj, że …", "zapamiętaj: …", "pamiętaj, że …".
 */
export function extractMemoryCommand(text: string): string | null {
  const m = text.match(/(?:zapami[ęe]taj|pami[ęe]taj)\s*(?:sobie)?\s*[,:]?\s*(?:że\s+)?(.+)/i);
  if (!m) return null;
  const fact = m[1].trim().replace(/[.!?]+$/, "");
  return fact.length >= 3 ? fact : null;
}

export function newId(): string {
  if (isBrowser() && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
