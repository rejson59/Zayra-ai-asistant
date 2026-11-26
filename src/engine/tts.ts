import type { VoiceFrame, VoiceState } from './sim';

const BANDS = 32;

/** Obwiednia mowy Zayry — energia podszywana pod słowa (onboundary), bez analizy TTS. */
export class SpeechPulse {
  private t = 0;
  private energy = 0;
  private level = 0;
  private bands = new Float32Array(BANDS);
  private phase = Array.from({ length: BANDS }, () => Math.random() * Math.PI * 2);
  private speed = Array.from({ length: BANDS }, (_, i) => 2 + (i / BANDS) * 5 + Math.random() * 2);

  reset() {
    this.energy = 0;
    this.level = 0;
  }

  bump() {
    this.energy = Math.min(1, this.energy + 0.85);
  }

  update(dt: number, state: VoiceState): VoiceFrame {
    this.t += dt;
    this.energy *= Math.exp(-dt * 3.2);
    const syll = 0.55 + 0.45 * Math.abs(Math.sin(this.t * Math.PI * 2 * 6.2));
    const raw = Math.min(1, this.energy) * syll + 0.03;
    const rate = raw > this.level ? 26 : 10;
    this.level += (raw - this.level) * (1 - Math.exp(-dt * rate));

    for (let i = 0; i < BANDS; i++) {
      const tilt = 0.35 + 0.65 * Math.pow(1 - i / BANDS, 0.6);
      const n = 0.5 + 0.5 * Math.sin(this.t * this.speed[i] + this.phase[i]);
      const v = this.level * tilt * (0.4 + 0.6 * n);
      const r = v > this.bands[i] ? 24 : 9;
      this.bands[i] += (v - this.bands[i]) * (1 - Math.exp(-dt * r));
    }
    return { t: this.t, level: this.level, bands: this.bands, state };
  }
}

export const ttsSupported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

export interface SpeakHandle {
  cancel: () => void;
}

/** Mówi po polsku (jeśli jest głos PL), odsłania słowa przez onboundary. */
export function speak(
  text: string,
  opts: { onWord: (index: number) => void; onEnd: () => void; onError: () => void },
): SpeakHandle | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;

  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pl-PL';
  u.rate = 1.0;
  u.pitch = 1.02;
  const pl = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('pl'));
  if (pl) u.voice = pl;

  const starts: number[] = [];
  let acc = 0;
  for (const word of text.split(' ')) {
    starts.push(acc);
    acc += word.length + 1;
  }

  let ended = false;
  u.onboundary = (e) => {
    const ci = e.charIndex ?? 0;
    let idx = 0;
    for (let i = 0; i < starts.length; i++) if (starts[i] <= ci) idx = i;
    opts.onWord(idx);
  };
  u.onend = () => {
    if (!ended) {
      ended = true;
      opts.onEnd();
    }
  };
  u.onerror = () => {
    if (!ended) {
      ended = true;
      opts.onError();
    }
  };

  synth.cancel();
  synth.speak(u);

  return {
    cancel: () => {
      ended = true;
      synth.cancel();
    },
  };
}
