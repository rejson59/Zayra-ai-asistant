import { VoiceSim, type VoiceFrame, type VoiceState } from './sim';
import { SpeechPulse } from './tts';

const BANDS = 32;

/** Wspólny odczyt AnalyserNode: RMS (poziom) + pasma logarytmiczne. */
class AnalyserReader {
  private bands = new Float32Array(BANDS);
  private level = 0;
  private t = 0;
  private time: Uint8Array<ArrayBuffer> | null = null;
  private freq: Uint8Array<ArrayBuffer> | null = null;

  read(a: AnalyserNode, sampleRate: number, dt: number, state: VoiceState): VoiceFrame {
    this.t += dt;
    if (!this.time || this.time.length !== a.fftSize) this.time = new Uint8Array(a.fftSize);
    if (!this.freq || this.freq.length !== a.frequencyBinCount)
      this.freq = new Uint8Array(a.frequencyBinCount);
    const time = this.time;
    const freq = this.freq;

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
    const nyq = sampleRate / 2;
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

  reset() {
    this.level = 0;
  }
}

/** Mikrofon w czasie rzeczywistym. */
class MicAnalyser {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private reader = new AnalyserReader();
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
    this.active = true;
  }

  read(dt: number, state: VoiceState): VoiceFrame {
    return this.reader.read(this.analyser!, this.ctx!.sampleRate, dt, state);
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.active = false;
    this.reader.reset();
  }
}

/** Odtwarzanie głosu Zayry (Piper) z analizą prawdziwego audio → fala sync. */
export class PiperPlayback {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private reader = new AnalyserReader();
  private startedAt = 0;
  private duration = 0;
  active = false;
  onEnded: (() => void) | null = null;

  // streaming zdaniowy
  private queue: AudioBuffer[] = [];
  private streamDone = false;
  private streamCb: (() => void) | null = null;
  private streamTotal = 0;
  private streamStarted = 0;

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.5;
      this.analyser.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async decode(blob: Blob): Promise<AudioBuffer> {
    const ctx = this.ensureCtx();
    return ctx.decodeAudioData(await blob.arrayBuffer());
  }

  async play(buffer: AudioBuffer): Promise<void> {
    const ctx = this.ensureCtx();
    await ctx.resume();
    this.stopSource();
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.analyser!);
    src.onended = () => {
      if (this.source === src) {
        this.active = false;
        this.source = null;
        this.onEnded?.();
      }
    };
    src.start();
    this.source = src;
    this.startedAt = ctx.currentTime;
    this.duration = buffer.duration;
    this.reader.reset();
    this.active = true;
  }

  /** Rozpoczyna streaming zdaniowy: pierwsze zdanie gra od razu. */
  beginStream(onAllEnded: () => void) {
    this.stop();
    this.queue = [];
    this.streamDone = false;
    this.streamCb = onAllEnded;
    this.streamTotal = 0;
    this.streamStarted = 0;
    this.active = true;
  }

  /** Dokłada zsyntezowane zdanie do kolejki; startuje odtwarzanie jeśli idle. */
  enqueue(buffer: AudioBuffer) {
    this.queue.push(buffer);
    this.streamTotal += buffer.duration;
    if (!this.source) this.playNext();
  }

  /** Sygnalizuje, że nie będzie więcej zdań. */
  endStream() {
    this.streamDone = true;
    if (!this.source && this.queue.length === 0) this.finishStream();
  }

  private playNext() {
    const buf = this.queue.shift();
    if (!buf) {
      if (this.streamDone) this.finishStream();
      return;
    }
    const ctx = this.ensureCtx();
    void ctx.resume();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.analyser!);
    src.onended = () => {
      if (this.source === src) {
        this.source = null;
        this.playNext();
      }
    };
    src.start();
    this.source = src;
    if (!this.streamStarted) this.streamStarted = ctx.currentTime;
    this.active = true;
  }

  private finishStream() {
    this.active = false;
    this.source = null;
    const cb = this.streamCb;
    this.streamCb = null;
    cb?.();
  }

  read(dt: number, state: VoiceState): VoiceFrame {
    return this.reader.read(this.analyser!, this.ctx!.sampleRate, dt, state);
  }

  get progress(): number {
    if (!this.ctx) return 0;
    if (this.streamTotal)
      return Math.min(1, (this.ctx.currentTime - this.streamStarted) / this.streamTotal);
    if (!this.duration) return 0;
    return Math.min(1, (this.ctx.currentTime - this.startedAt) / this.duration);
  }

  private stopSource() {
    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch {
        /* już zatrzymany */
      }
      this.source = null;
    }
  }

  stop() {
    this.stopSource();
    this.queue = [];
    this.streamDone = true;
    this.streamCb = null;
    this.streamTotal = 0;
    this.active = false;
    this.reader.reset();
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.analyser = null;
  }
}

/** Jedno źródło prawdy dla wizualizacji. */
export class VoiceEngine {
  private sim = new VoiceSim();
  private mic = new MicAnalyser();
  private pulse = new SpeechPulse();
  readonly playback = new PiperPlayback();
  private starting = false;
  private voiceHeard = false;
  private silence = 0;
  micActive = false;
  ttsActive = false;
  piperActive = false;
  onListeningEnd: (() => void) | null = null;

  micError: string | null = null;

  async enableMic(): Promise<boolean> {
    if (this.micActive) return true;
    if (this.starting) return false;
    this.starting = true;
    this.micError = null;
    try {
      await this.mic.start();
      this.micActive = true;
      this.resetVad();
      return true;
    } catch (err) {
      this.micActive = false;
      this.micError = err instanceof Error ? err.name : 'unknown';
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

  decodeAudio(blob: Blob): Promise<AudioBuffer> {
    return this.playback.decode(blob);
  }

  async startPlayback(buffer: AudioBuffer, onEnded: () => void): Promise<void> {
    this.playback.onEnded = () => {
      this.piperActive = false;
      onEnded();
    };
    await this.playback.play(buffer);
    this.piperActive = true;
  }

  /** Streaming zdaniowy: Zayra zaczyna mówić po pierwszym zdaniu. */
  beginStream(onAllEnded: () => void) {
    this.playback.onEnded = null;
    this.playback.beginStream(() => {
      this.piperActive = false;
      onAllEnded();
    });
    this.piperActive = true;
  }

  enqueue(buffer: AudioBuffer) {
    this.playback.enqueue(buffer);
  }

  endStream() {
    this.playback.endStream();
  }

  stopPlayback() {
    this.playback.stop();
    this.piperActive = false;
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
    if (state === 'speaking' && this.piperActive) return this.playback.read(dt, state);
    if (state === 'speaking' && this.ttsActive) return this.pulse.update(dt, state);
    return this.sim.update(dt, state);
  }

  dispose() {
    this.disableMic();
    this.playback.dispose();
  }
}
