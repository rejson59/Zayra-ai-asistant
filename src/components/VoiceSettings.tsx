import { AnimatePresence, motion } from 'motion/react';
import { Check, FileJson, FileAudio, Loader2, Play, Settings2, Trash2, Upload } from 'lucide-react';
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
import { IconButton } from './IconButton';

interface Props {
  voiceId: VoiceId;
  onVoiceChange: (id: VoiceId) => void;
  profile: VoiceProfile;
  onProfileChange: (p: VoiceProfile) => void;
}

export function VoiceSettings({ voiceId, onVoiceChange, profile, onProfileChange }: Props) {
  const [open, setOpen] = useState(false);
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

  const Row = ({ id, label }: { id: VoiceId; label: string }) => {
    const active = voiceId === id;
    return (
      <button
        onClick={() => chooseBuiltin(id)}
        className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
          active ? 'border-accent/40 bg-accent-soft text-ink' : 'border-line text-dim hover:text-ink'
        }`}
      >
        {label}
        {active && <Check size={15} className="text-accent" />}
      </button>
    );
  };

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
              className="absolute top-13 right-0 z-40 w-72 rounded-3xl border border-line bg-surface p-4 shadow-xl shadow-black/10"
            >
              <p className="mb-3 text-[11px] font-bold tracking-wide text-dim uppercase">
                Głos Zayry · Piper (offline)
              </p>

              <div className="flex flex-col gap-1.5">
                {PL_VOICES.map((v) => (
                  <Row key={v.id} id={v.id} label={v.name} />
                ))}
                <button
                  onClick={chooseCustom}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                    isCustom(voiceId)
                      ? 'border-accent/40 bg-accent-soft text-ink'
                      : 'border-line text-dim hover:text-ink'
                  }`}
                >
                  Własny głos (wgrany)
                  {isCustom(voiceId) && <Check size={15} className="text-accent" />}
                </button>
              </div>

              {/* profile brzmienia i tempa własnego głosu */}
              {isCustom(voiceId) && (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-bold tracking-wide text-dim uppercase">
                    Brzmienie i tempo
                  </p>
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

              {/* wgrywanie własnego modelu */}
              <div className="mt-3 rounded-2xl border border-dashed border-line p-3">
                <p className="mb-2 text-[11px] font-medium text-dim">
                  Wgraj model z Colab: <span className="text-ink">.onnx</span> +{' '}
                  <span className="text-ink">.onnx.json</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onnxInput.current?.click()}
                    className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-2 py-1.5 text-[11px] font-semibold text-dim hover:text-ink"
                  >
                    <FileAudio size={14} />
                    <span className="truncate">{onnxFile ? onnxFile.name : 'model.onnx'}</span>
                  </button>
                  <button
                    onClick={() => cfgInput.current?.click()}
                    className="flex flex-1 cursor-pointer items-center gap-1.5 rounded-xl border border-line px-2 py-1.5 text-[11px] font-semibold text-dim hover:text-ink"
                  >
                    <FileJson size={14} />
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
                    className="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[11.5px] font-bold text-on-accent disabled:opacity-40"
                  >
                    <Upload size={13} /> Zainstaluj
                  </button>
                  {customInstalled && (
                    <button
                      onClick={removeCustom}
                      className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-[11px] font-semibold text-dim hover:text-ink"
                    >
                      <Trash2 size={13} /> Usuń
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={test}
                  disabled={testBusy || busy}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11.5px] font-bold text-ink disabled:opacity-40"
                >
                  {testBusy ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
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
              {status && <p className="mt-2 text-[11px] font-medium text-dim">{status}</p>}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
