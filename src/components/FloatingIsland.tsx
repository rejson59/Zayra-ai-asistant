import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import { AudioLines, Brain, Mic, Volume2, type LucideIcon } from 'lucide-react';
import type { VoiceState } from '../engine/sim';
import type { VoiceEngine } from '../engine/audio';
import { PALETTES, clonePalette, lerpPalette, type Theme } from '../engine/palette';
import { createBars } from '../visualizers/bars';

interface Props {
  state: VoiceState;
  theme: Theme;
  engine: VoiceEngine;
  onExpand: () => void;
  onTalk: () => void;
}

const STATE_ICON: Record<VoiceState, LucideIcon> = {
  idle: AudioLines,
  listening: Mic,
  thinking: Brain,
  speaking: Volume2,
};

const STATE_LABEL: Record<VoiceState, string> = {
  idle: 'Zayra czuwa',
  listening: 'Słucham…',
  thinking: 'Myślę…',
  speaking: 'Mówię',
};

const readPos = () => {
  try {
    const s = JSON.parse(localStorage.getItem('zayra-island-pos') || 'null');
    if (s && typeof s.x === 'number' && typeof s.y === 'number') return s as { x: number; y: number };
  } catch {
    /* ignore */
  }
  return { x: window.innerWidth / 2, y: 20 };
};

/** Pływająca wyspa: pigułka z mini-falą i ikoną stanu, zawsze na wierzchu. */
export function FloatingIsland({ state, theme, engine, onExpand, onTalk }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(readPos);
  const posRef = useRef(pos);
  posRef.current = pos;
  const stateRef = useRef(state);
  stateRef.current = state;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    const bars = createBars();
    const cur = clonePalette(PALETTES[themeRef.current]);
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = wrap.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const frame = engineRef.current.update(dt, stateRef.current);
      lerpPalette(cur, PALETTES[themeRef.current], 1 - Math.exp(-dt * 8));
      ctx.clearRect(0, 0, w, h);
      bars(ctx, w, h, frame, cur);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const clearHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, ox: posRef.current.x, oy: posRef.current.y, moved: false };
    heldRef.current = false;
    clearHold();
    holdTimer.current = setTimeout(() => {
      if (drag.current && !drag.current.moved) {
        heldRef.current = true;
        onTalk();
      }
    }, 420);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.sx;
    const dy = e.clientY - drag.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) {
      drag.current.moved = true;
      clearHold();
    }
    if (drag.current.moved) {
      const x = Math.min(window.innerWidth - 70, Math.max(70, drag.current.ox + dx));
      const y = Math.min(window.innerHeight - 44, Math.max(10, drag.current.oy + dy));
      setPos({ x, y });
    }
  };

  const onPointerUp = () => {
    clearHold();
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      localStorage.setItem('zayra-island-pos', JSON.stringify(posRef.current));
    } else if (!heldRef.current) {
      onExpand();
    }
  };

  const Icon = STATE_ICON[state];
  const active = state !== 'idle';

  return (
    <motion.div
      initial={{ opacity: 0, y: -18, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -18, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="fixed z-50"
      style={{ left: pos.x, top: pos.y, transform: 'translateX(-50%)' }}
    >
      <div
        role="button"
        aria-label={`${STATE_LABEL[state]} — kliknij, aby otworzyć Zayrę`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative flex cursor-pointer touch-none items-center gap-2.5 rounded-full border bg-surface/90 py-2 pr-4 pl-2.5 shadow-xl shadow-black/20 backdrop-blur-md transition-colors select-none ${
          active ? 'border-accent/40' : 'border-line'
        }`}
        style={{ width: 236 }}
      >
        {active && (
          <span className="pointer-events-none absolute inset-0 rounded-full bg-accent-soft animate-[breathe_2.2s_ease-in-out_infinite]" />
        )}
        <span
          className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${
            active ? 'bg-accent-soft text-accent' : 'bg-surface2 text-dim'
          }`}
        >
          <Icon size={16} className={state === 'thinking' ? 'animate-pulse' : ''} />
        </span>
        <div ref={wrapRef} className="relative h-9 min-w-0 flex-1">
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10.5px] font-semibold tracking-wide text-dim">
        {STATE_LABEL[state]}
      </p>
    </motion.div>
  );
}
