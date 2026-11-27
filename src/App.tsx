import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Captions, Info, Minimize2, Moon, Square, Sun, Volume2, VolumeX } from 'lucide-react';
import type { VoiceId } from '@diffusionstudio/vits-web';
import type { VoiceState } from './engine/sim';
import type { Theme } from './engine/palette';
import { VoiceEngine } from './engine/audio';
import { speak, ttsSupported } from './engine/tts';
import {
  CUSTOM_SLOT,
  DEFAULT_PROFILE,
  VOICE_PROFILES,
  applyVoiceProfile,
  clearSessionCache,
  enableSessionCache,
  splitSentences,
  synthesize,
  tryLoadPublishedVoice,
  type VoiceProfile,
} from './engine/piper';
import { Stage } from './components/Stage';
import { IconButton } from './components/IconButton';
import { StatusPill } from './components/StatusPill';
import { MicButton } from './components/MicButton';
import { LabPanel } from './components/LabPanel';
import { HelpMenu } from './components/HelpMenu';
import { VoiceSettings } from './components/VoiceSettings';
import { FloatingIsland } from './components/FloatingIsland';

const SENTENCE =
  'Jasne. Masz dziś trzy spotkania: o dziesiątej przegląd projektu, w południe lunch z Anną, a po południu krótki sync z zespołem.';
const WORDS = SENTENCE.split(' ');
const WORD_MS = 165;
const SPEAK_MS = WORDS.length * WORD_MS + 700;

const readTheme = (): Theme => {
  const saved = localStorage.getItem('zayra-theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export default function App() {
  const engineRef = useRef<VoiceEngine | null>(null);
  if (!engineRef.current) engineRef.current = new VoiceEngine();
  const engine = engineRef.current;

  const [theme, setTheme] = useState<Theme>(readTheme);
  const [state, setState] = useState<VoiceState>('idle');
  const [captions, setCaptions] = useState(() => localStorage.getItem('zayra-captions') !== 'off');
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem('zayra-voice') !== 'off');
  const [voiceId, setVoiceId] = useState<VoiceId>(
    () => (localStorage.getItem('zayra-voice-id') as VoiceId) || 'pl_PL-gosia-medium',
  );
  const [profile, setProfile] = useState<VoiceProfile>(() => {
    const saved = localStorage.getItem('zayra-profile');
    return VOICE_PROFILES.find((p) => p.id === saved) ?? DEFAULT_PROFILE;
  });
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const [micLive, setMicLive] = useState(false);
  const [islandMode, setIslandMode] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const voiceIdRef = useRef(voiceId);
  voiceIdRef.current = voiceId;
  const genRef = useRef(0);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const captionTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakRef = useRef<{ cancel: () => void } | null>(null);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (captionTimer.current) {
      clearInterval(captionTimer.current);
      captionTimer.current = null;
    }
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const cancelSpeech = () => {
    speakRef.current?.cancel();
    speakRef.current = null;
  };
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };

  const startCaptionTimer = (interval = WORD_MS) => {
    if (captionTimer.current) clearInterval(captionTimer.current);
    captionTimer.current = setInterval(() => {
      setRevealed((r) => {
        if (r >= WORDS.length) {
          if (captionTimer.current) {
            clearInterval(captionTimer.current);
            captionTimer.current = null;
          }
          return r;
        }
        return r + 1;
      });
    }, interval);
  };

  const finishSpeaking = () => {
    genRef.current++;
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.stopPlayback();
    setState('idle');
  };

  const startSpeaking = async () => {
    setRevealed(0);
    const gen = ++genRef.current;

    // Piper: prawdziwy głos + analiza audio + streaming zdaniowy (szybszy start)
    if (voiceOnRef.current) {
      setState('thinking');
      let started = false;
      try {
        const sentences = splitSentences(SENTENCE);
        for (let i = 0; i < sentences.length; i++) {
          const blob = await synthesize(sentences[i], voiceIdRef.current);
          if (gen !== genRef.current) return;
          const buffer = await engine.decodeAudio(blob);
          if (gen !== genRef.current) return;
          if (!started) {
            started = true;
            engine.beginStream(() => finishSpeaking());
            setState('speaking');
            startCaptionTimer(Math.max(70, WORD_MS));
          }
          engine.enqueue(buffer);
        }
        if (gen !== genRef.current) {
          engine.stopPlayback();
          return;
        }
        engine.endStream();
        later(() => finishSpeaking(), 60000);
        return;
      } catch {
        if (gen !== genRef.current) return;
        if (started) {
          engine.endStream();
          return;
        }
      }
    }

    // fallback: głos przeglądarki lub symulacja
    setState('speaking');
    if (voiceOnRef.current && ttsSupported()) {
      engine.startTts();
      let gotBoundary = false;
      speakRef.current = speak(SENTENCE, {
        onWord: (i) => {
          gotBoundary = true;
          if (captionTimer.current) {
            clearInterval(captionTimer.current);
            captionTimer.current = null;
          }
          setRevealed((r) => Math.max(r, i + 1));
          engine.wordBump();
        },
        onEnd: () => finishSpeaking(),
        onError: () => {
          engine.stopTts();
          clearTimers();
          startCaptionTimer();
          later(() => finishSpeaking(), SPEAK_MS);
        },
      });
      later(() => {
        if (!gotBoundary) startCaptionTimer();
      }, 700);
      later(() => finishSpeaking(), 30000);
    } else {
      startCaptionTimer();
      later(() => finishSpeaking(), SPEAK_MS);
    }
  };

  const finishListening = () => {
    clearTimers();
    engine.disableMic();
    setMicLive(false);
    setState('thinking');
    later(() => void startSpeaking(), 600);
  };

  const beginListening = () => {
    genRef.current++;
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.stopPlayback();
    setState('listening');
    engine.resetVad();
    setRevealed(0);
    void engine.enableMic().then((ok) => {
      setMicLive(ok);
      if (!ok) showToast('Mikrofon niedostępny — tryb demo');
    });
  };

  const micAction = () => {
    const s = stateRef.current;
    if (s === 'idle' || s === 'speaking') beginListening();
    else if (s === 'listening') finishListening();
  };

  const stop = () => {
    genRef.current++;
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.stopPlayback();
    engine.disableMic();
    setMicLive(false);
    setState('idle');
    setRevealed(0);
  };

  const runDemo = () => {
    genRef.current++;
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.stopPlayback();
    engine.disableMic();
    setMicLive(false);
    setState('listening');
    setRevealed(0);
    later(() => setState('thinking'), 2300);
    later(() => void startSpeaking(), 3500);
  };

  const force = (s: VoiceState) => {
    genRef.current++;
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.stopPlayback();
    if (s !== 'listening') {
      engine.disableMic();
      setMicLive(false);
    }
    setState(s);
    setRevealed(s === 'speaking' ? WORDS.length : 0);
  };

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleCaptions = () => setCaptions((c) => !c);
  const toggleVoice = () => {
    const nv = !voiceOnRef.current;
    setVoiceOn(nv);
    if (!nv && stateRef.current === 'speaking') {
      genRef.current++;
      clearTimers();
      cancelSpeech();
      engine.stopTts();
      engine.stopPlayback();
      startCaptionTimer();
      const remaining = Math.max(600, (WORDS.length - revealedRef.current) * WORD_MS + 400);
      later(() => finishSpeaking(), remaining);
    }
  };

  const actionsRef = useRef({ micAction, stop, toggleTheme, toggleCaptions, toggleVoice, finishListening });
  actionsRef.current = { micAction, stop, toggleTheme, toggleCaptions, toggleVoice, finishListening };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('zayra-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#131417' : '#f6f5f1');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('zayra-captions', captions ? 'on' : 'off');
  }, [captions]);
  useEffect(() => {
    localStorage.setItem('zayra-voice', voiceOn ? 'on' : 'off');
  }, [voiceOn]);
  useEffect(() => {
    localStorage.setItem('zayra-voice-id', voiceId);
    clearSessionCache();
  }, [voiceId]);

  // cache sesji ONNX (przyspieszenie) + auto-wczytanie głosu + profil głosu
  useEffect(() => {
    void (async () => {
      await enableSessionCache();
      const ok = await tryLoadPublishedVoice();
      if (ok && !localStorage.getItem('zayra-voice-id')) setVoiceId(CUSTOM_SLOT);
      await applyVoiceProfile(profileRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('zayra-profile', profile.id);
    void applyVoiceProfile(profile);
  }, [profile]);

  useEffect(() => {
    engine.onListeningEnd = () => actionsRef.current.finishListening();
    window.speechSynthesis?.getVoices();
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const a = actionsRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        a.micAction();
      } else if (e.key === 't' || e.key === 'T') a.toggleTheme();
      else if (e.key === 'c' || e.key === 'C') a.toggleCaptions();
      else if (e.key === 'm' || e.key === 'M') a.toggleVoice();
      else if (e.key === 'i' || e.key === 'I') setIslandMode((v) => !v);
      else if (e.key === 'Escape') a.stop();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      engine.onListeningEnd = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      cancelSpeech();
      engine.dispose();
      window.speechSynthesis?.cancel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const active = state !== 'idle';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {islandMode ? (
        <div className="relative h-full w-full">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(120% 80% at 50% -10%, var(--accent-soft), transparent 60%)' }}
          />
          <FloatingIsland
            state={state}
            theme={theme}
            engine={engine}
            onExpand={() => setIslandMode(false)}
            onTalk={micAction}
          />
          <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-1.5 px-6 text-center">
            <p className="font-display text-[22px] italic text-ink">Zayra działa w tle</p>
            <p className="max-w-xs text-[12.5px] leading-snug text-dim">
              Kliknij wyspę, aby otworzyć · przytrzymaj, żeby mówić · przeciągnij, by przesunąć
            </p>
          </div>
        </div>
      ) : (
        <>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[12.5px] font-semibold text-ink shadow-lg shadow-black/10"
          >
            <Info size={15} className="text-accent" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[27px] leading-none tracking-tight italic">Zayra</h1>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
              active
                ? micLive
                  ? 'bg-accent'
                  : 'animate-[breathe_1.8s_ease-in-out_infinite] bg-accent'
                : 'bg-dim/40'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <VoiceSettings
            voiceId={voiceId}
            onVoiceChange={setVoiceId}
            profile={profile}
            onProfileChange={setProfile}
          />
          <IconButton label="Zminimalizuj do wyspy" onClick={() => setIslandMode(true)}>
            <Minimize2 size={18} />
          </IconButton>
          <IconButton
            label={voiceOn ? 'Wycisz głos Zayry' : 'Włącz głos Zayry'}
            active={voiceOn}
            onClick={toggleVoice}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
          <IconButton label={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'} onClick={toggleTheme}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 60, scale: 0.6 }}
                transition={{ duration: 0.22 }}
                className="grid place-items-center"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </motion.span>
            </AnimatePresence>
          </IconButton>
          <HelpMenu />
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center px-6">
        <div className="mx-auto h-[clamp(180px,36vh,320px)] w-full max-w-[860px]">
          <Stage concept="bars" state={state} theme={theme} engine={engine} />
        </div>
      </main>

      <footer className="relative flex flex-col items-center gap-5 px-6 pb-7">
        <StatusPill state={state} />

        <div
          aria-live="polite"
          className="flex h-6 max-w-xl items-center justify-center text-center text-[13.5px] leading-snug font-medium text-dim"
        >
          {captions && state === 'speaking' && (
            <p>
              {WORDS.map((word, i) => (
                <span
                  key={i}
                  className={`mr-[0.32em] inline-block transition-all duration-300 ${
                    i < revealed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                  }`}
                >
                  {word}
                </span>
              ))}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <IconButton label="Napisy na żywo" active={captions} onClick={toggleCaptions}>
            <Captions size={18} />
          </IconButton>
          <MicButton state={state} onClick={micAction} />
          <IconButton label="Zatrzymaj" onClick={stop} disabled={!active}>
            <Square size={15} />
          </IconButton>
        </div>

        <div className="absolute bottom-7 left-6 hidden lg:block">
          <LabPanel state={state} onForce={force} onDemo={runDemo} />
        </div>
      </footer>
        </>
      )}
    </div>
  );
}
