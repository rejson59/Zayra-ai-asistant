import { VoiceSim, type VoiceFrame, type VoiceState } from './sim';
import { SpeechPulse } from './tts';

const BANDS = 32;

/** Analiza mikrofonu w czasie rzeczywistym (RMS + pasma logarytmiczne). */
class MicAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private time: Uint8Array<ArrayBuffer> | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;
  private bands = new Float32Array(BANDS);
  private level = 0;
  private t = 0;
  active = false;

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    await ctx.resume();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    src.connect(analyser);

    this.ctx = ctx;
    this.analyser = analyser;
    this.stream = stream;
    this.time = new Uint8Array(analyser.fftSize);
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.active = true;
  }

  read(dt: number, state: VoiceState): VoiceFrame {
    this.t += dt;
    const a = this.analyser!;
    const time = this.time!;
    const freq = this.freq!;

    a.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) {
      const v = (time[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / time.length);
    const raw = Math.min(1, Math.max(0, (rms - 0.008) * 4.5));
    const rate = raw > this.level ? 30 : 8;
    this.level += (raw - this.level) * (1 - Math.exp(-dt * rate));

    a.getByteFrequencyData(freq);
    const n = freq.length;
    const nyq = this.ctx!.sampleRate / 2;
    for (let b = 0; b < BANDS; b++) {
      const f0 = 60 * Math.pow(8000 / 60, b / BANDS);
      const f1 = 60 * Math.pow(8000 / 60, (b + 1) / BANDS);
      const i0 = Math.max(0, Math.floor((f0 / nyq) * n));
      const i1 = Math.min(n - 1, Math.max(i0 + 1, Math.ceil((f1 / nyq) * n)));
      let s = 0;
      for (let i = i0; i < i1; i++) s += freq[i];
      const v = s / (i1 - i0) / 255;
      const r = v > this.bands[b] ? 26 : 9;
      this.bands[b] += (v - this.bands[b]) * (1 - Math.exp(-dt * r));
    }

    return { t: this.t, level: this.level, bands: this.bands, state };
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.active = false;
    this.level = 0;
  }
}

/**
 * Jedno źródło prawdy dla wizualizacji:
 *  - słuchanie z mikrofonem  → prawdziwe dane audio
 *  - mówienie z TTS          → obwiednia synchronizowana ze słowami
 *  - pozostałe stany         → symulator
 */
export class VoiceEngine {
  private sim = new VoiceSim();
  private mic = new MicAnalyser();
  private pulse = new SpeechPulse();
  private starting = false;
  private voiceHeard = false;
  private silence = 0;
  micActive = false;
  ttsActive = false;
  onListeningEnd: (() => void) | null = null;

  async enableMic(): Promise<boolean> {
    if (this.micActive) return true;
    if (this.starting) return false;
    this.starting = true;
    try {
      await this.mic.start();
      this.micActive = true;
      this.resetVad();
      return true;
    } catch {
      this.micActive = false;
      return false;
    } finally {
      this.starting = false;
    }
  }

  disableMic() {
    this.mic.stop();
    this.micActive = false;
  }

  resetVad() {
    this.voiceHeard = false;
    this.silence = 0;
  }

  startTts() {
    this.ttsActive = true;
    this.pulse.reset();
  }
  stopTts() {
    this.ttsActive = false;
  }
  wordBump() {
    this.pulse.bump();
  }

  update(dt: number, state: VoiceState): VoiceFrame {
    if (state === 'listening' && this.micActive) {
      const f = this.mic.read(dt, state);
      if (f.level > 0.09) {
        this.voiceHeard = true;
        this.silence = 0;
      } else if (this.voiceHeard) {
        this.silence += dt;
        if (this.silence > 2.4) {
          this.resetVad();
          this.onListeningEnd?.();
        }
      }
      return f;
    }
    if (state === 'speaking' && this.ttsActive) return this.pulse.update(dt, state);
    return this.sim.update(dt, state);
  }

  dispose() {
    this.disableMic();
  }
}
