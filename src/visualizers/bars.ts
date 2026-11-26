import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

/** Słupki — lustrzane pigułki jak w nowoczesnym dyktafonie, środek = niskie pasma. */
export const drawBars: DrawFn = (ctx, w, h, f, p) => {
  const N = 44;
  const span = w * 0.74;
  const x0 = (w - span) / 2;
  const step = span / N;
  const bw = Math.max(3, step * 0.5);
  const mid = h / 2;

  for (let i = 0; i < N; i++) {
    const xn = (i + 0.5) / N;
    const win = edgeWindow(xn);
    const bi = Math.min(31, Math.floor(Math.abs(xn - 0.5) * 2 * 32));
    const v = f.bands[bi] * (0.35 + 0.65 * win);
    const bh = 4 + v * h * 0.42;
    const x = x0 + i * step + (step - bw) / 2;
    ctx.fillStyle = rgba(p.accent, 0.4 + 0.55 * win);
    ctx.beginPath();
    ctx.roundRect(x, mid - bh / 2, bw, bh, bw / 2);
    ctx.fill();
  }
};
