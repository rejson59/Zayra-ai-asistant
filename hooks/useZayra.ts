"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { askZayra } from "@/lib/chat";
import { demoReply } from "@/lib/demo";
import {
  extractMemoryCommand,
  loadMemory,
  loadMessages,
  loadSettings,
  newId,
  saveMemory,
  saveMessages,
  saveSettings,
} from "@/lib/storage";
import { DEFAULT_SETTINGS, type Message, type ServerConfig, type Settings } from "@/lib/types";

export type ConnectionState = "checking" | "demo" | "device" | "server" | "error";

export function useZayra() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  messagesRef.current = messages;

  useEffect(() => {
    setSettings(loadSettings());
    setMessages(loadMessages());
    setMemory(loadMemory());
    setHydrated(true);

    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg: ServerConfig | null) => setServerConfig(cfg))
      .catch(() => setServerConfig({ configured: false, provider: null, model: null }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const connection: ConnectionState = !hydrated
    ? "checking"
    : settings.device?.apiKey
      ? "device"
      : serverConfig?.configured
        ? "server"
        : "demo";

  const activeModel =
    settings.device?.provider === "gemini"
      ? settings.device.model
      : settings.device?.model || serverConfig?.model || null;

  const addMemory = useCallback((fact: string) => {
    setMemory((prev) => {
      const clean = fact.trim();
      if (!clean) return prev;
      const exists = prev.some((m) => m.toLowerCase() === clean.toLowerCase());
      const next = exists ? prev : [...prev, clean];
      saveMemory(next);
      return next;
    });
  }, []);

  const removeMemory = useCallback((fact: string) => {
    setMemory((prev) => {
      const next = prev.filter((m) => m !== fact);
      saveMemory(next);
      return next;
    });
  }, []);

  const pushMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const next = [...prev, message];
      saveMessages(next);
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  /**
   * Wysyła wiadomość i strumieniuje odpowiedź.
   * Zwraca pełny tekst odpowiedzi (potrzebny do syntezy mowy).
   */
  const send = useCallback(
    async (rawText: string): Promise<string> => {
      const text = rawText.trim();
      if (!text || busy) return "";

      setError(null);
      const userMessage: Message = { id: newId(), role: "user", content: text, at: new Date().toISOString() };
      const assistantId = newId();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        at: new Date().toISOString(),
      };

      const history = [...messagesRef.current, userMessage];
      setMessages(history);
      saveMessages(history);
      setMessages((prev) => [...prev, assistantMessage]);
      setBusy(true);

      /** dopisuje fragment do odpowiedzi asystentki */
      const append = (chunk: string) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
        );
      };

      // 1. Polecenie pamięci obsługujemy lokalnie — działa też bez modelu.
      const fact = extractMemoryCommand(text);
      if (fact) {
        addMemory(fact);
        const reply = `Zapamiętałam: ${fact}. Będę o tym pamiętać w kolejnych rozmowach.`;
        append(reply);
        saveMessages([...history, { ...assistantMessage, content: reply }]);
        setBusy(false);
        return reply;
      }

      // 2. Tryb demo (brak klucza) — uczciwa odpowiedź lokalna.
      if (connection === "demo") {
        const reply = demoReply(text, settings.mode, settings.address);
        append(reply);
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, demo: true } : m)));
        saveMessages([...history, { ...assistantMessage, content: reply, demo: true }]);
        setBusy(false);
        return reply;
      }

      // 3. Prawdziwy model — strumień tokenów.
      const controller = new AbortController();
      abortRef.current = controller;
      let full = "";

      try {
        for await (const chunk of askZayra({ messages: history, settings, signal: controller.signal })) {
          full += chunk;
          append(chunk);
        }
        if (!full.trim()) {
          full = "Nie dostałam odpowiedzi z modelu. Spróbuj ponownie.";
          append(full);
        }
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m));
          saveMessages(next);
          return next;
        });
        return full;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          const note = "Przerwałam odpowiedź.";
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content || note } : m
            );
            saveMessages(next);
            return next;
          });
          return "";
        }
        const message = err instanceof Error ? err.message : "Nie udało się połączyć z modelem.";
        const isNotConfigured = (err as { code?: string }).code === "not_configured";
        setError(message);
        if (isNotConfigured) {
          const reply = demoReply(text, settings.mode, settings.address);
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === assistantId ? { ...m, content: reply, demo: true } : m
            );
            saveMessages(next);
            return next;
          });
          return reply;
        }
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Przepraszam, coś się zatrzymało. ${message}` } : m
          );
          saveMessages(next);
          return next;
        });
        return "";
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [addMemory, busy, connection, settings]
  );

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setMessages([]);
    saveMessages([]);
  }, []);

  const exportConversation = useCallback(() => {
    const lines = messagesRef.current.map((m) => {
      const who = m.role === "user" ? "Ty" : "Zayra";
      const time = new Date(m.at).toLocaleString("pl-PL");
      return `### ${who} · ${time}\n${m.content}\n`;
    });
    const blob = new Blob([`# Rozmowa z Zayrą\n\n${lines.join("\n")}`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zayra-rozmowa-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    settings,
    updateSettings,
    messages,
    memory,
    addMemory,
    removeMemory,
    busy,
    error,
    setError,
    connection,
    serverConfig,
    activeModel,
    hydrated,
    send,
    stop,
    clearConversation,
    exportConversation,
  };
}
