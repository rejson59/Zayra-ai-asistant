import { useEffect, useRef } from 'react';
import { VoiceSim, type VoiceState } from '../engine/sim';
import { PALETTES, clonePalette, lerpPalette, type Theme } from '../engine/palette';
import { conceptById, type ConceptId } from '../visualizers';

interface Props {
  concept: ConceptId;
  state: VoiceState;
  theme: Theme;
}

/** Scena: jeden canvas, pętla rAF, symulator głosu i płynna paleta. */
export function Stage({ concept, state, theme }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<VoiceSim | null>(null);
  if (!simRef.current) simRef.current = new VoiceSim();

  const stateRef = useRef(state);
  stateRef.current = state;
  const conceptRef = useRef(concept);
  conceptRef.current = concept;
  const targetPal = useRef(PALETTES[theme]);
  targetPal.current = PALETTES[theme];
  const curPal = useRef(clonePalette(PALETTES[theme]));

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = wrap.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
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
      const frame = simRef.current!.update(dt, stateRef.current);
      lerpPalette(curPal.current, targetPal.current, 1 - Math.exp(-dt * 8));
      ctx.clearRect(0, 0, w, h);
      conceptById(conceptRef.current).draw(ctx, w, h, frame, curPal.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
