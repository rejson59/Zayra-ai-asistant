import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Captions, Moon, Square, Sun } from 'lucide-react';
import type { VoiceState } from './engine/sim';
import type { Theme } from './engine/palette';
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
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [state, setState] = useState<VoiceState>('idle');
  const [captions, setCaptions] = useState(() => localStorage.getItem('zayra-captions') !== 'off');
  const [revealed, setRevealed] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const startSpeaking = () => {
    setState('speaking');
    later(() => setState('idle'), SPEAK_MS);
  };

  const runDemo = () => {
    clearTimers();
    setState('listening');
    later(() => setState('thinking'), 2300);
    later(startSpeaking, 3500);
  };

  const micAction = () => {
    const s = stateRef.current;
    clearTimers();
    if (s === 'idle') runDemo();
    else if (s === 'listening') {
      setState('thinking');
      later(startSpeaking, 1100);
    } else if (s === 'speaking') runDemo();
  };

  const stop = () => {
    clearTimers();
    setState('idle');
  };

  const force = (s: VoiceState) => {
    clearTimers();
    setState(s);
  };

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

  // napisy na żywo — słowa odsłaniane w rytm mowy
  useEffect(() => {
    if (state !== 'speaking') {
      setRevealed(0);
      return;
    }
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((r) => {
        if (r >= WORDS.length) {
          clearInterval(id);
          return r;
        }
        return r + 1;
      });
    }, WORD_MS);
    return () => clearInterval(id);
  }, [state]);

  // skróty klawiszowe
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Space') {
        e.preventDefault();
        micAction();
      } else if (e.key === 't' || e.key === 'T') {
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
      } else if (e.key === 'c' || e.key === 'C') {
        setCaptions((c) => !c);
      } else if (e.key === 'Escape') {
        stop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => clearTimers(), []);

  const active = state !== 'idle';

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* nagłówek */}
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[27px] leading-none tracking-tight italic">
            Zayra
          </h1>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${
              active
                ? 'animate-[breathe_1.8s_ease-in-out_infinite] bg-accent'
                : 'bg-dim/40'
            }`}
          />
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            label={theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'}
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
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
          <Stage concept="bars" state={state} theme={theme} />
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
          <IconButton
            label="Napisy na żywo"
            active={captions}
            onClick={() => setCaptions((c) => !c)}
          >
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
