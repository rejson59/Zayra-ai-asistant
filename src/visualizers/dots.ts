import { rgba } from '../engine/palette';
import { edgeWindow, type DrawFn } from './util';

/** Kropki — jedwabna siatka punktów, przez którą przepływa fala. */
export const drawDots: DrawFn = (ctx, w, h, f, p) => {
  const cols = 44;
  const rows = 7;
  const span = w * 0.74;
  const x0 = (w - span) / 2;
  const sx = span / (cols - 1);
  const sy = Math.min(15, h * 0.06);
  const mid = h / 2;
  const midRow = (rows - 1) / 2;

  for (let r = 0; r < rows; r++) {
    const rw = 1 - (Math.abs(r - midRow) / midRow) * 0.6;
    for (let c = 0; c < cols; c++) {
      const xn = c / (cols - 1);
      const win = edgeWindow(xn);
      const travel = Math.sin(xn * Math.PI * 2 * 2.4 - f.t * 3.4 + r * 0.35);
      const amp = (2 + f.level * h * 0.2) * win * rw;
      const y = mid + (r - midRow) * sy + amp * travel;
      const e = Math.max(0, travel) * f.level;
      const rad = 1.5 + e * 1.6 * win;
      const alpha = (0.22 + 0.55 * rw) * (0.5 + 0.5 * Math.min(1, f.level * 1.6 + 0.25));
      ctx.fillStyle = rgba(p.accent, alpha);
      ctx.beginPath();
      ctx.arc(x0 + c * sx, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
