import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

const N = 9;
const MIN_H = 6;

/**
 * 9 miękkich pigułek. Fala płynie od lewej do prawej:
 * każdy słupek przejmuje energię chwilę po poprzedniku, bez sztywnego overshootu.
 */
export function createBars(): DrawFn {
  const heights = new Float32Array(N).fill(MIN_H);
  let lastT = -1;
  let travel = 0;
  let speed = 1.6;

  return (ctx, w, h, f, p) => {
    const dt = lastT < 0 ? 0.016 : Math.min(0.05, Math.max(0.001, f.t - lastT));
    lastT = f.t;

    // prędkość fali zależy od stanu, ale zmienia się płynnie
    const targetSpeed =
      f.state === 'speaking' ? 5.0 :
      f.state === 'listening' ? 4.2 :
      f.state === 'thinking' ? 2.1 : 1.15;
    speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 2.6));
    travel += speed * dt;

    const span = Math.min(w * 0.5, 240);
    const x0 = (w - span) / 2;
    const gap = span / (N - 1);
    const bw = Math.min(10, gap * 0.36);
    const mid = h / 2;
    const maxAmp = h * 0.44;
    const phaseStep = 0.72;

    for (let i = 0; i < N; i++) {
      const xn = (i + 0.5) / N;
      const taper = 0.72 + 0.28 * edgeWindow(xn);

      // wędrujący grzbiet fali — lewy słupek zaczyna, prawy kontynuuje
      const crest = 0.5 + 0.5 * Math.sin(travel - i * phaseStep);
      const shaped = Math.pow(crest, 1.65);

      const bi = Math.min(31, Math.floor((i / N) * 14));
      const energy = f.level * (0.84 + 0.16 * f.bands[bi]);
      const target = MIN_H + maxAmp * energy * shaped * taper;

      // miękkie dojście do celu, bez sprężynowego „sztywniaka”
      const rate = target > heights[i] ? 13 : 8.5;
      heights[i] += (target - heights[i]) * (1 - Math.exp(-dt * rate));

      const bh = Math.max(MIN_H, heights[i]);
      const x = x0 + i * gap - bw / 2;
      const alpha = 0.5 + 0.42 * shaped;
      ctx.fillStyle = rgba(p.accent, alpha);
      ctx.beginPath();
      ctx.roundRect(x, mid - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
  };
}
