"use client";

import { useState } from "react";
import { MODEL_SUGGESTIONS } from "@/lib/providers";
import { PROVIDER_PRESETS, type ProviderId, type Settings } from "@/lib/types";
import { BrainIcon, CloseIcon, TrashIcon } from "./Icons";

type SettingsPanelProps = {
  open: boolean;
  settings: Settings;
  memory: string[];
  activeModel: string | null;
  connection: "checking" | "demo" | "device" | "server" | "error";
  serverProvider: string | null;
  voices: SpeechSynthesisVoice[];
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => void;
  onRemoveMemory: (fact: string) => void;
  onClearConversation: () => void;
  onExport: () => void;
};

type Tab = "model" | "glos" | "profil";

const CONNECTION_LABEL: Record<SettingsPanelProps["connection"], string> = {
  checking: "Sprawdzam połączenie…",
  demo: "Tryb demo — bez modelu",
  device: "Klucz zapisany na tablecie",
  server: "Klucz na serwerze",
  error: "Problem z połączeniem",
};

export function SettingsPanel({
  open,
  settings,
  memory,
  activeModel,
  connection,
  serverProvider,
  voices,
  onClose,
  onChange,
  onRemoveMemory,
  onClearConversation,
  onExport,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>("model");
  const [provider, setProvider] = useState<keyof typeof PROVIDER_PRESETS>(
    settings.device?.provider ?? "groq"
  );
  const [apiKey, setApiKey] = useState(settings.device?.apiKey ?? "");
  const [model, setModel] = useState(
    settings.device?.model ?? PROVIDER_PRESETS[settings.device?.provider ?? "groq"].model
  );
  const [baseUrl, setBaseUrl] = useState(settings.device?.baseUrl ?? "");
  const [saved, setSaved] = useState<string | null>(null);

  if (!open) return null;

  const preset = PROVIDER_PRESETS[provider];

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(null), 2600);
  };

  const saveKey = () => {
    const trimmed = apiKey.trim();
    if (!trimmed && provider !== "custom") {
      flash("Wklej najpierw klucz API.");
      return;
    }
    onChange({
      device: {
        provider,
        apiKey: trimmed,
        model: (model || preset.model).trim(),
        baseUrl: (baseUrl || preset.baseUrl).trim(),
      },
    });
    flash("Zapisane. Zayra korzysta teraz z tego modelu.");
  };

  const removeKey = () => {
    onChange({ device: null });
    setApiKey("");
    flash("Klucz usunięty. Wracam do trybu demo lub klucza serwera.");
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Ustawienia Zayry">
      <div className="sheet">
        <header className="sheet-head">
          <h2>Ustawienia</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Zamknij ustawienia">
            <CloseIcon size={20} />
          </button>
        </header>

        <nav className="tabs" role="tablist">
          {(
            [
              ["model", "Model"],
              ["glos", "Głos"],
              ["profil", "Profil i pamięć"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? "is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sheet-body">
          {tab === "model" && (
            <>
              <div className={`status-card status-${connection}`}>
                <span className="status-dot" />
                <div>
                  <strong>{CONNECTION_LABEL[connection]}</strong>
                  <p>
                    {connection === "demo" &&
                      "Zayra odpowiada przykładowo. Dodaj darmowy klucz poniżej, aby zaczęła myśleć naprawdę."}
                    {connection === "device" && `Aktywny model: ${activeModel ?? "—"}`}
                    {connection === "server" &&
                      `Serwer używa ${serverProvider ?? "modelu"} · ${activeModel ?? "—"}`}
                    {connection === "checking" && "Chwila cierpliwości."}
                    {connection === "error" && "Nie mogę sprawdzić konfiguracji serwera."}
                  </p>
                </div>
              </div>

              <label className="field">
                <span className="field-label">Dostawca modelu</span>
                <div className="provider-grid">
                  {(Object.keys(PROVIDER_PRESETS) as (keyof typeof PROVIDER_PRESETS)[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={`provider-card ${provider === id ? "is-active" : ""}`}
                      onClick={() => {
                        setProvider(id);
                        setModel(PROVIDER_PRESETS[id].model);
                        setBaseUrl(PROVIDER_PRESETS[id].baseUrl);
                      }}
                    >
                      <strong>{PROVIDER_PRESETS[id].label}</strong>
                      <small>{PROVIDER_PRESETS[id].hint}</small>
                    </button>
                  ))}
                </div>
              </label>

              {provider !== "custom" ? (
                <label className="field">
                  <span className="field-label">Klucz API</span>
                  <input
                    type="password"
                    className="input"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="wklej klucz…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <span className="field-hint">
                    Darmowy klucz:{" "}
                    <a href={preset.keyUrl} target="_blank" rel="noreferrer">
                      {preset.keyUrl.replace("https://", "")}
                    </a>{" "}
                    · klucz zostaje na tym tablecie, nie wysyłamy go nigdzie poza dostawcę modelu.
                  </span>
                </label>
              ) : (
                <>
                  <label className="field">
                    <span className="field-label">Adres serwera</span>
                    <input
                      className="input"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="http://192.168.1.10:11434/v1"
                      spellCheck={false}
                    />
                    <span className="field-hint">
                      Ollama: <code>OLLAMA_HOST=0.0.0.0 ollama serve</code>, a w Ustawieniach Androida
                      zezwól na „niezabezpieczony ruch HTTP” dla tej aplikacji.
                    </span>
                  </label>
                  <label className="field">
                    <span className="field-label">Klucz (opcjonalny)</span>
                    <input
                      type="password"
                      className="input"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="jeśli serwer wymaga"
                      autoComplete="off"
                    />
                  </label>
                </>
              )}

              <label className="field">
                <span className="field-label">Model</span>
                <input
                  className="input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={preset.model}
                  spellCheck={false}
                />
                <div className="chips-inline">
                  {MODEL_SUGGESTIONS[provider].map((m) => (
                    <button key={m} type="button" className="chip chip-sm" onClick={() => setModel(m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </label>

              <div className="row">
                <button className="btn btn-primary" onClick={saveKey}>
                  Zapisz model
                </button>
                {settings.device && (
                  <button className="btn btn-ghost" onClick={removeKey}>
                    Usuń klucz
                  </button>
                )}
              </div>
              {saved && <p className="saved-note">{saved}</p>}
            </>
          )}

          {tab === "glos" && (
            <>
              <label className="field">
                <span className="field-label">Głos Zayry</span>
                <select
                  className="input"
                  value={settings.voiceURI ?? ""}
                  onChange={(e) => onChange({ voiceURI: e.target.value || null })}
                >
                  {voices.length === 0 && <option value="">Brak głosów w tej przeglądarce</option>}
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}){v.localService ? " · offline" : ""}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  {voices.some((v) => v.lang.toLowerCase().startsWith("pl"))
                    ? "Zalecany jest głos polski. W Chrome na Androidzie: Ustawienia → Dostępność → Zamiana tekstu na mowę → język polski."
                    : "Nie widzę polskiego głosu. Zainstaluj go w ustawieniach systemu (Zamiana tekstu na mowę), żeby Zayra mówiła po polsku."}
                </span>
              </label>

              <label className="field">
                <span className="field-label">
                  Tempo mowy: <strong>{settings.voiceRate.toFixed(2)}×</strong>
                </span>
                <input
                  type="range"
                  min={0.7}
                  max={1.4}
                  step={0.02}
                  value={settings.voiceRate}
                  onChange={(e) => onChange({ voiceRate: Number(e.target.value) })}
                  className="range"
                />
              </label>

              <Toggle
                label="Czytaj odpowiedzi na głos"
                hint="Wyłącz, jeśli chcesz tylko czytać."
                checked={settings.autoSpeak}
                onChange={(v) => onChange({ autoSpeak: v })}
              />
              <Toggle
                label="Tryb głośnomówiący"
                hint="Po odpowiedzi Zayra sama włącza mikrofon — rozmawiasz bez dotykania tabletu."
                checked={settings.handsFree}
                onChange={(v) => onChange({ handsFree: v })}
              />
            </>
          )}

          {tab === "profil" && (
            <>
              <label className="field">
                <span className="field-label">Forma zwracania się</span>
                <div className="segmented">
                  <button
                    className={settings.address === "formal" ? "is-active" : ""}
                    onClick={() => onChange({ address: "formal" })}
                  >
                    Pani / Pan
                  </button>
                  <button
                    className={settings.address === "informal" ? "is-active" : ""}
                    onClick={() => onChange({ address: "informal" })}
                  >
                    na Ty
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="field-label">Tryb pracy Zayry</span>
                <div className="segmented segmented-3">
                  {(
                    [
                      ["auto", "Auto"],
                      ["praca", "Praca"],
                      ["osobiste", "Osobiste"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      className={settings.mode === id ? "is-active" : ""}
                      onClick={() => onChange({ mode: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </label>

              <label className="field">
                <span className="field-label">Co Zayra ma o Tobie wiedzieć</span>
                <textarea
                  className="input textarea"
                  rows={4}
                  value={settings.aboutMe}
                  onChange={(e) => onChange({ aboutMe: e.target.value })}
                  placeholder="Np. Prowadzę małą firmę budowlaną. Pracuję 8–16, mam dwoje dzieci. Wolę krótkie odpowiedzi i konkrety."
                />
                <span className="field-hint">
                  Ten opis trafia do kontekstu każdej rozmowy. Trzymaj go zwięźle.
                </span>
              </label>

              <div className="field">
                <span className="field-label">
                  <BrainIcon size={16} /> Pamięć trwała ({memory.length})
                </span>
                {memory.length === 0 ? (
                  <p className="field-hint">
                    Pusta. Powiedz „zapamiętaj, że mam spotkania w poniedziałki” — zapiszę to na stałe.
                  </p>
                ) : (
                  <ul className="memory-list">
                    {memory.map((m) => (
                      <li key={m}>
                        <span>{m}</span>
                        <button
                          className="icon-btn tiny"
                          onClick={() => onRemoveMemory(m)}
                          aria-label={`Usuń: ${m}`}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="row row-spread">
                <button className="btn btn-ghost" onClick={onExport}>
                  Eksportuj rozmowę
                </button>
                <button className="btn btn-danger" onClick={onClearConversation}>
                  Wyczyść rozmowę
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </label>
  );
}

export type { ProviderId };
