import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

const N = 9;
const MIN_H = 6;
const TAU = Math.PI * 2;

const wrapPi = (x: number) => {
  let y = x % TAU;
  if (y > Math.PI) y -= TAU;
  if (y < -Math.PI) y += TAU;
  return y;
};

/**
 * 9 pigułek, przez które płynie organiczna fala lewo→prawo.
 * Wędrujący impuls (nie metronom) + drugie, szybsze pasmo; tempo rośnie z głośnością,
 * a każdy słupek reaguje snappiej, dzięki czemu ruch nie jest „sztywny”.
 */
export function createBars(): DrawFn {
  const heights = new Float32Array(N).fill(MIN_H);
  let lastT = -1;
  let travel = 0;
  let travel2 = 0;
  let speed = 1.4;

  return (ctx, w, h, f, p) => {
    const dt = lastT < 0 ? 0.016 : Math.min(0.05, Math.max(0.001, f.t - lastT));
    lastT = f.t;

    // głos napędza tempo fali — im głośniej, tym szybciej płynie
    const base =
      f.state === 'speaking' ? 4.6 :
      f.state === 'listening' ? 4.0 :
      f.state === 'thinking' ? 2.0 : 1.0;
    const targetSpeed = base + f.level * 4.4;
    speed += (targetSpeed - speed) * (1 - Math.exp(-dt * 3.4));
    travel += speed * dt;
    travel2 += speed * 1.62 * dt;

    const span = Math.min(w * 0.5, 240);
    const x0 = (w - span) / 2;
    const gap = span / (N - 1);
    const bw = Math.min(10, gap * 0.36);
    const mid = h / 2;
    const maxAmp = h * 0.46;
    const phaseStep = 0.78;

    for (let i = 0; i < N; i++) {
      const xn = (i + 0.5) / N;
      const taper = 0.72 + 0.28 * edgeWindow(xn);

      const bi = Math.min(31, Math.floor((i / N) * 18));
      const band = f.bands[bi];
      const jitter = (band - 0.5) * 0.5;

      // główny wędrujący grzbiet + drugie, szybsze pasmo dla organiczności
      const ph = wrapPi(travel - i * phaseStep + jitter);
      const pulse = Math.exp(-(ph * ph) / (2 * 0.95 * 0.95));
      const ph2 = wrapPi(travel2 + 1.7 - i * phaseStep * 1.35);
      const pulse2 = Math.exp(-(ph2 * ph2) / (2 * 1.15 * 1.15)) * 0.55;
      const shape = Math.min(1, pulse + pulse2);

      const energy = f.level * (0.8 + 0.2 * band);
      const target = MIN_H + maxAmp * energy * shape * taper;

      // szybki atak, miękkie opadanie — blisko głosu, bez sztywności
      const rate = target > heights[i] ? 24 : 11;
      heights[i] += (target - heights[i]) * (1 - Math.exp(-dt * rate));

      const bh = Math.max(MIN_H, heights[i]);
      const x = x0 + i * gap - bw / 2;
      const alpha = 0.45 + 0.5 * shape;
      ctx.fillStyle = rgba(p.accent, alpha);
      ctx.beginPath();
      ctx.roundRect(x, mid - bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
  };
}
