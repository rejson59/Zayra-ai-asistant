import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

const N = 17;

/** Słupki — garść lustrzanych pigułek ze sprężynowym, satysfakcjonującym overshootem. */
export function createBars(): DrawFn {
  const heights = new Float32Array(N).fill(5);
  const vels = new Float32Array(N);
  let lastT = -1;

  return (ctx, w, h, f, p) => {
    const dt = lastT < 0 ? 0.016 : Math.min(0.05, f.t - lastT);
    lastT = f.t;

    const span = Math.min(w * 0.62, 360);
    const x0 = (w - span) / 2;
    const step = span / N;
    const bw = Math.min(9, step * 0.44);
    const mid = h / 2;

    for (let i = 0; i < N; i++) {
      const xn = (i + 0.5) / N;
      const win = edgeWindow(xn);
      const bi = Math.min(31, Math.floor(Math.abs(xn - 0.5) * 2 * 32));
      const v = f.bands[bi] * (0.35 + 0.65 * win);
      const target = 5 + v * h * 0.34;

      // sprężyna: szybki atak z miękkim overshootem, spokojny powrót
      const k = 190;
      const d = 15;
      const acc = k * (target - heights[i]) - d * vels[i];
      vels[i] += acc * dt;
      heights[i] = Math.max(4, heights[i] + vels[i] * dt);

      const bh = heights[i];
      const x = x0 + i * step + (step - bw) / 2;
      ctx.fillStyle = rgba(p.accent, 0.45 + 0.5 * win);
      ctx.beginPath();
      ctx.roundRect(x, mid - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
  };
}
