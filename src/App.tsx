import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Captions, Info, Moon, Square, Sun, Volume2, VolumeX } from 'lucide-react';
import type { VoiceState } from './engine/sim';
import type { Theme } from './engine/palette';
import { VoiceEngine } from './engine/audio';
import { speak, ttsSupported } from './engine/tts';
import { Stage } from './components/Stage';
import { IconButton } from './components/IconButton';
import { StatusPill } from './components/StatusPill';
import { MicButton } from './components/MicButton';
import { LabPanel } from './components/LabPanel';
import { HelpMenu } from './components/HelpMenu';

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
  const [micLive, setMicLive] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

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

  const startCaptionTimer = () => {
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
    }, WORD_MS);
  };

  const finishSpeaking = () => {
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    setState('idle');
  };

  const startSpeaking = () => {
    setState('speaking');
    setRevealed(0);
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
    later(startSpeaking, 900);
  };

  const beginListening = () => {
    clearTimers();
    cancelSpeech();
    engine.stopTts();
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
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.disableMic();
    setMicLive(false);
    setState('idle');
    setRevealed(0);
  };

  const runDemo = () => {
    clearTimers();
    cancelSpeech();
    engine.stopTts();
    engine.disableMic();
    setMicLive(false);
    setState('listening');
    setRevealed(0);
    later(() => setState('thinking'), 2300);
    later(startSpeaking, 3500);
  };

  const force = (s: VoiceState) => {
    clearTimers();
    cancelSpeech();
    engine.stopTts();
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
      clearTimers();
      cancelSpeech();
      engine.stopTts();
      startCaptionTimer();
      const remaining = Math.max(600, (WORDS.length - revealedRef.current) * WORD_MS + 400);
      later(() => finishSpeaking(), remaining);
    }
  };

  const actionsRef = useRef({
    micAction,
    stop,
    toggleTheme,
    toggleCaptions,
    toggleVoice,
    finishListening,
  });
  actionsRef.current = { micAction, stop, toggleTheme, toggleCaptions, toggleVoice, finishListening };

  // motyw
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

  // silnik + skróty klawiszowe
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
      {/* toast */}
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

      {/* nagłówek */}
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
          <IconButton
            label={voiceOn ? 'Wycisz głos Zayry' : 'Włącz głos Zayry'}
            active={voiceOn}
            onClick={toggleVoice}
          >
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </IconButton>
          <IconButton
            label={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
            onClick={toggleTheme}
          >
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

      {/* scena */}
      <main className="flex min-h-0 flex-1 items-center px-6">
        <div className="mx-auto h-[clamp(180px,36vh,320px)] w-full max-w-[860px]">
          <Stage concept="bars" state={state} theme={theme} engine={engine} />
        </div>
      </main>

      {/* sterowanie */}
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
    </div>
  );
}
