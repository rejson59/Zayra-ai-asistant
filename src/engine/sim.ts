export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface VoiceFrame {
  /** czas w sekundach */
  t: number;
  /** wygładzona obwiednia głosu 0..1 */
  level: number;
  /** pasma „widma" 0..1 */
  bands: Float32Array;
  state: VoiceState;
}

const BANDS = 32;

/**
 * Symulator głosu — sylabiczne bursty z pauzami, wygładzane attack/release.
 * Docelowo zastąpiony danymi z AnalyserNode (mikrofon / TTS), interfejs zostaje.
 */
export class VoiceSim {
  private t = 0;
  private level = 0;
  private target = 0;
  private nextAt = 0;
  private pauseUntil = 0;
  private bands = new Float32Array(BANDS);
  private phase = Array.from({ length: BANDS }, () => Math.random() * Math.PI * 2);
  private speed = Array.from(
    { length: BANDS },
    (_, i) => 1.5 + (i / BANDS) * 4 + Math.random() * 1.5,
  );
  private frame: VoiceFrame = { t: 0, level: 0, bands: this.bands, state: 'idle' };

  update(dt: number, state: VoiceState): VoiceFrame {
    this.t += dt;

    if (state === 'listening' || state === 'speaking') {
      if (this.t >= this.nextAt) {
        if (this.t < this.pauseUntil) {
          this.target = 0.04;
        } else if (Math.random() < 0.13) {
          this.pauseUntil = this.t + 0.1 + Math.random() * 0.25;
          this.target = 0.04;
          this.nextAt = this.pauseUntil;
        } else {
          const base = state === 'speaking' ? 0.35 : 0.28;
          const range = state === 'speaking' ? 0.65 : 0.6;
          this.target = base + Math.random() * range;
          this.nextAt = this.t + 0.06 + Math.random() * 0.17;
        }
      }
    } else if (state === 'thinking') {
      this.target = 0.13 + 0.05 * Math.sin(this.t * 2.6);
    } else {
      this.target = 0.045 + 0.02 * Math.sin(this.t * 0.9);
    }

    const rate = this.target > this.level ? 16 : 6;
    this.level += (this.target - this.level) * (1 - Math.exp(-dt * rate));

    for (let i = 0; i < BANDS; i++) {
      const tilt = 0.3 + 0.7 * Math.pow(1 - i / BANDS, 0.65);
      const n = 0.5 + 0.5 * Math.sin(this.t * this.speed[i] + this.phase[i]);
      const n2 = 0.5 + 0.5 * Math.sin(this.t * this.speed[i] * 0.41 + this.phase[i] * 2.3);
      const v = this.level * tilt * (0.3 + 0.7 * (n * 0.65 + n2 * 0.35));
      const r = v > this.bands[i] ? 20 : 7;
      this.bands[i] += (v - this.bands[i]) * (1 - Math.exp(-dt * r));
    }

    this.frame.t = this.t;
    this.frame.level = this.level;
    this.frame.state = state;
    return this.frame;
  }
}
