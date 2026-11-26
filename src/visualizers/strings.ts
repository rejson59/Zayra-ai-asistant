import { rgba } from '../engine/palette';
import type { DrawFn } from './util';

const STRINGS = [
  { mode: 1, w: 0.5, sp: 1.0 },
  { mode: 2, w: 0.8, sp: 1.35 },
  { mode: 1, w: 1.0, sp: 1.7 },
  { mode: 3, w: 0.85, sp: 2.1 },
  { mode: 2, w: 0.65, sp: 2.5 },
  { mode: 1, w: 0.4, sp: 2.9 },
];

/** Struny — sześć napiętych linii drgających falą stojącą, jak instrument. */
export const drawStrings: DrawFn = (ctx, w, h, f, p) => {
  const mid = h / 2;
  const gap = Math.min(18, h * 0.075);
  const N = 120;
  const x0 = w * 0.08;
  const x1 = w * 0.92;
  const span = x1 - x0;

  STRINGS.forEach((s, i) => {
    const base = mid + (i - 2.5) * gap;
    const amp = (1.2 + f.level * h * 0.17) * s.w;
    const ph = f.t * s.sp * 3.2 + i * 1.7;

    ctx.beginPath();
    for (let j = 0; j <= N; j++) {
      const xn = j / N;
      const x = x0 + xn * span;
      const y =
        base +
        amp * Math.sin(Math.PI * s.mode * xn) * Math.sin(ph) +
        f.level * h * 0.05 * s.w * Math.sin(Math.PI * (s.mode + 1) * xn) * Math.sin(ph * 1.3 + 1);
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const center = 1 - Math.abs(i - 2.5) / 2.5;
    ctx.strokeStyle = rgba(p.accent, 0.3 + 0.6 * center);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // kołki na końcach — detal „instrumentu"
    ctx.fillStyle = rgba(p.neutral, 0.5);
    ctx.beginPath();
    ctx.arc(x0 - 7, base, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x1 + 7, base, 2, 0, Math.PI * 2);
    ctx.fill();
  });
};
