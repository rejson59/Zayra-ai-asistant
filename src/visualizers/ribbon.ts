import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

const LAYERS = [
  { amp: 1.0, alpha: 0.95, speed: 1.0, k: 2.1, off: 0, w: 2.2 },
  { amp: 0.7, alpha: 0.5, speed: 0.8, k: 2.7, off: 4, w: 1.8 },
  { amp: 0.5, alpha: 0.3, speed: 0.62, k: 3.3, off: -4, w: 1.6 },
  { amp: 0.33, alpha: 0.16, speed: 0.5, k: 3.9, off: 7, w: 1.4 },
];

/** Wstęga — cztery warstwy płynących linii, amplitude napędza głos. */
export const drawRibbon: DrawFn = (ctx, w, h, f, p) => {
  const mid = h / 2;
  const N = 140;
  const maxAmp = h * 0.34;

  for (const L of LAYERS) {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const xn = i / N;
      const x = xn * w;
      const win = edgeWindow(xn);
      const amp = Math.min(maxAmp, (5 + f.level * h * 0.3) * L.amp) * win;
      const ph = f.t * L.speed * 2.4;
      const y =
        mid +
        L.off * win +
        amp * Math.sin(xn * Math.PI * 2 * L.k + ph) +
        amp * 0.4 * Math.sin(xn * Math.PI * 2 * L.k * 2.3 - ph * 1.6);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(p.accent, L.alpha);
    ctx.lineWidth = L.w;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
};
