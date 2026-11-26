import type { VoiceFrame } from '../engine/sim';
import type { Palette } from '../engine/palette';

export type DrawFn = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  f: VoiceFrame,
  p: Palette,
) => void;

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Miękkie wygaszenie przy krawędziach — fale „znikają" w powietrzu. */
export const edgeWindow = (xn: number) =>
  Math.pow(Math.sin(Math.PI * clamp01(xn)), 0.85);
