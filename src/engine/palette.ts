export type Theme = 'dark' | 'light';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  accent: RGB;
  neutral: RGB;
}

export const PALETTES: Record<Theme, Palette> = {
  dark: {
    accent: { r: 110, g: 163, b: 255 },
    neutral: { r: 142, g: 146, b: 156 },
  },
  light: {
    accent: { r: 47, g: 107, b: 221 },
    neutral: { r: 110, g: 113, b: 120 },
  },
};

export const rgba = (c: RGB, a: number) =>
  `rgba(${c.r | 0},${c.g | 0},${c.b | 0},${a})`;

export const clonePalette = (p: Palette): Palette => ({
  accent: { ...p.accent },
  neutral: { ...p.neutral },
});

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Płynne przenikanie palety przy zmianie motywu (canvas nie dziedziczy transition CSS). */
export function lerpPalette(cur: Palette, target: Palette, k: number) {
  for (const key of ['accent', 'neutral'] as const) {
    cur[key].r = lerp(cur[key].r, target[key].r, k);
    cur[key].g = lerp(cur[key].g, target[key].g, k);
    cur[key].b = lerp(cur[key].b, target[key].b, k);
  }
}
