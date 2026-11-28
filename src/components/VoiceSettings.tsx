import { AnimatePresence, motion } from 'motion/react';
import { Check, FileJson, FileAudio, Loader2, Play, Settings2, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VoiceId } from '@diffusionstudio/vits-web';
import {
  CUSTOM_SLOT,
  PL_VOICES,
  VOICE_PROFILES,
  ensureBuiltin,
  hasCustomVoice,
  installCustomVoice,
  isCustom,
  removeCustomVoice,
  synthesize,
  type VoiceProfile,
} from '../engine/piper';
import { BRAINS, hasWebGPU, isPatient, setPatient, type Brain } from '../engine/llm';
import { IconButton } from './IconButton';

interface Props {
  voiceId: VoiceId;
  onVoiceChange: (id: VoiceId) => void;
  profile: VoiceProfile;
  onProfileChange: (p: VoiceProfile) => void;
  brain: Brain;
  onBrainChange: (b: Brain) => void;
}

type Tab = 'voice' | 'sound' | 'brain';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'voice', label: 'Głos' },
  { id: 'sound', label: 'Brzmienie' },
  { id: 'brain', label: 'Mózg' },
];

export function VoiceSettings({
  voiceId,
  onVoiceChange,
  profile,
  onProfileChange,
  brain,
  onBrainChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('voice');
  const [patient, setPatientState] = useState(isPatient());
  const [customInstalled, setCustomInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [onnxFile, setOnnxFile] = useState<File | null>(null);
  const [cfgFile, setCfgFile] = useState<File | null>(null);
  const onnxInput = useRef<HTMLInputElement>(null);
  const cfgInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) void hasCustomVoice().then(setCustomInstalled);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const chooseBuiltin = async (id: VoiceId) => {
    onVoiceChange(id);
    setBusy(true);
    setProgress(0);
    setStatus('Pobieranie głosu (raz, potem offline)…');
    try {
      await ensureBuiltin(id, (p) => p.total && setProgress(p.loaded / p.total));
      setStatus('Głos gotowy ✓');
    } catch {
      setStatus('Nie udało się pobrać — sprawdź sieć.');
    } finally {
      setBusy(false);
    }
  };

  const chooseCustom = () => {
    if (customInstalled) {
      onVoiceChange(CUSTOM_SLOT);
      setStatus('Własny głos aktywny ✓');
    } else {
      setStatus('Najpierw wgraj własny model poniżej.');
    }
  };

  const install = async () => {
    if (!onnxFile || !cfgFile) return;
    setBusy(true);
    setStatus('Instalowanie własnego głosu…');
    try {
      await installCustomVoice(onnxFile, cfgFile);
      setCustomInstalled(true);
      onVoiceChange(CUSTOM_SLOT);
      setOnnxFile(null);
      setCfgFile(null);
      setStatus('Własny głos gotowy ✓');
    } catch {
      setStatus('Błąd instalacji — przeglądarka musi wspierać OPFS.');
    } finally {
      setBusy(false);
    }
  };

  const removeCustom = async () => {
    await removeCustomVoice();
    setCustomInstalled(false);
    if (isCustom(voiceId)) onVoiceChange('pl_PL-gosia-medium');
    setStatus('Usunięto własny głos.');
  };

  const test = async () => {
    setTestBusy(true);
    setStatus('Generuję próbkę…');
    try {
      const blob = await synthesize('Cześć, jestem Zayra. To jest test twojego głosu.', voiceId);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setStatus('');
    } catch {
      setStatus('Test nieudany — głos nie jest gotowy.');
    } finally {
      setTestBusy(false);
    }
  };

  const rowCls = (active: boolean) =>
    `flex w-full cursor-pointer items-center justify-between rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
      active ? 'border-accent/40 bg-accent-soft text-ink' : 'border-line text-dim hover:text-ink'
    }`;

  const SectionLabel = ({ children }: { children: string }) => (
    <p className="mb-2 text-[10.5px] font-bold tracking-wide text-dim uppercase">{children}</p>
  );

  return (
    <div className="relative">
      <IconButton label="Głos Zayry" active={open} onClick={() => setOpen((o) => !o)}>
        <Settings2 size={18} />
      </IconButton>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="absolute top-13 right-0 z-40 flex max-h-[calc(100dvh-120px)] w-80 max-w-[calc(100vw-24px)] origin-top-right flex-col rounded-3xl border border-line bg-surface shadow-xl shadow-black/10"
            >
              {/* nagłówek + zakładki */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <p className="text-[10.5px] font-bold tracking-wide text-dim uppercase">
                  Ustawienia Zayry
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Zamknij ustawienia"
                  className="grid size-6 cursor-pointer place-items-center rounded-full text-dim transition-colors hover:bg-surface2 hover:text-ink"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="px-4 pb-2.5">
                <div className="flex rounded-full border border-line bg-surface2 p-0.5">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex-1 cursor-pointer rounded-full px-2 py-1 text-[11px] font-bold transition-colors ${
                        tab === t.id ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* przewijana treść zakładki */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
                {tab === 'voice' && (
                  <div>
                    <SectionLabel>Głos Zayry · Piper (offline)</SectionLabel>
                    <div className="flex flex-col gap-1.5">
                      {PL_VOICES.map((v) => (
                        <button key={v.id} onClick={() => chooseBuiltin(v.id)} className={rowCls(voiceId === v.id)}>
                          {v.name}
                          {voiceId === v.id && <Check size={14} className="text-accent" />}
                        </button>
                      ))}
                      <button onClick={chooseCustom} className={rowCls(isCustom(voiceId))}>
                        Własny głos (wgrany)
                        {isCustom(voiceId) && <Check size={14} className="text-accent" />}
                      </button>
                    </div>

                    <div className="mt-2.5 rounded-2xl border border-dashed border-line p-2.5">
                      <p className="mb-2 text-[10.5px] font-medium text-dim">
                        Wgraj model: <span className="text-ink">.onnx</span> +{' '}
                        <span className="text-ink">.onnx.json</span>
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onnxInput.current?.click()}
                          className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-2 py-1.5 text-[10.5px] font-semibold text-dim hover:text-ink"
                        >
                          <FileAudio size={13} className="shrink-0" />
                          <span className="truncate">{onnxFile ? onnxFile.name : 'model.onnx'}</span>
                        </button>
                        <button
                          onClick={() => cfgInput.current?.click()}
                          className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-2 py-1.5 text-[10.5px] font-semibold text-dim hover:text-ink"
                        >
                          <FileJson size={13} className="shrink-0" />
                          <span className="truncate">{cfgFile ? cfgFile.name : 'config.json'}</span>
                        </button>
                      </div>
                      <input
                        ref={onnxInput}
                        type="file"
                        accept=".onnx"
                        className="hidden"
                        onChange={(e) => setOnnxFile(e.target.files?.[0] ?? null)}
                      />
                      <input
                        ref={cfgInput}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => setCfgFile(e.target.files?.[0] ?? null)}
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={install}
                          disabled={!onnxFile || !cfgFile || busy}
                          className="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11px] font-bold text-on-accent disabled:opacity-40"
                        >
                          <Upload size={12} /> Zainstaluj
                        </button>
                        {customInstalled && (
                          <button
                            onClick={removeCustom}
                            className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[10.5px] font-semibold text-dim hover:text-ink"
                          >
                            <Trash2 size={12} /> Usuń
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'sound' && (
                  <div>
                    <SectionLabel>Brzmienie i tempo</SectionLabel>
                    {!isCustom(voiceId) && (
                      <p className="mb-2 rounded-xl border border-line px-2.5 py-1.5 text-[10.5px] leading-snug text-dim">
                        Profile stroją własny głos Zayry. Wybierz „Własny głos" w zakładce Głos, by
                        je usłyszeć.
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {VOICE_PROFILES.map((p) => {
                        const active = profile.id === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => onProfileChange(p)}
                            className={`flex cursor-pointer flex-col items-start rounded-2xl border px-3 py-2 text-left transition-colors ${
                              active
                                ? 'border-accent/40 bg-accent-soft'
                                : 'border-line hover:border-accent/30'
                            }`}
                          >
                            <span className={`text-[12px] font-bold ${active ? 'text-ink' : 'text-dim'}`}>
                              {p.name}
                            </span>
                            <span className="text-[10.5px] text-dim">{p.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {tab === 'brain' && (
                  <div>
                    <SectionLabel>Mózg Zayry · AI</SectionLabel>
                    {!hasWebGPU() && (
                      <p className="mb-2 rounded-xl border border-line px-2.5 py-1.5 text-[10.5px] leading-snug text-dim">
                        Ta przeglądarka nie ma WebGPU — lokalny mózg nie zadziała, ale chmura tak.
                      </p>
                    )}
                    <div className="flex flex-col gap-1.5">
                      {BRAINS.map((m) => {
                        const active = brain.id === m.id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => onBrainChange(m)}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 text-left transition-colors ${
                              active ? 'border-accent/40 bg-accent-soft' : 'border-line hover:border-accent/30'
                            }`}
                          >
                            <span className="flex flex-col">
                              <span className={`text-[12px] font-bold ${active ? 'text-ink' : 'text-dim'}`}>
                                {m.name} <span className="font-medium text-dim">· {m.size}</span>
                              </span>
                              <span className="text-[10.5px] text-dim">{m.hint}</span>
                            </span>
                            {active && <Check size={14} className="shrink-0 text-accent" />}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => {
                        const v = !patient;
                        setPatientState(v);
                        setPatient(v);
                      }}
                      className="mt-2 flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border border-line px-3 py-2 text-left transition-colors hover:border-accent/30"
                    >
                      <span className="flex flex-col">
                        <span className="text-[12px] font-bold text-ink">Cierpliwa chmura</span>
                        <span className="text-[10.5px] text-dim">
                          zawsze mądra odpowiedź, nawet gdy trzeba chwilę poczekać
                        </span>
                      </span>
                      <span
                        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                          patient ? 'bg-accent' : 'bg-surface2'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${
                            patient ? 'left-4.5' : 'left-0.5'
                          }`}
                        />
                      </span>
                    </button>
                    <p className="mt-2 text-[10px] leading-snug text-dim">
                      Chmura jest darmowa i bez klucza (pytania wychodzą online). Lokalny mózg pobiera
                      się raz i działa offline na Twoim urządzeniu.
                    </p>
                  </div>
                )}
              </div>

              {/* stała stopka: test + status */}
              <div className="border-t border-line px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={test}
                    disabled={testBusy || busy}
                    className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-bold text-ink disabled:opacity-40"
                  >
                    {testBusy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                    Posłuchaj
                  </button>
                  {busy && (
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
                      <div
                        className="h-full rounded-full bg-accent transition-all"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
                {status && <p className="mt-1.5 text-[10.5px] font-medium text-dim">{status}</p>}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
