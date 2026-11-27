import { predict, download, type VoiceId, type ProgressCallback } from '@diffusionstudio/vits-web';

export interface PlVoice {
  id: VoiceId;
  name: string;
}

/** Gotowe polskie głosy Piper (pobierane raz, cache OPFS, potem offline). */
export const PL_VOICES: PlVoice[] = [
  { id: 'pl_PL-gosia-medium', name: 'Gosia · żeński' },
  { id: 'pl_PL-darkman-medium', name: 'Darkman · męski' },
  { id: 'pl_PL-mc_speech-medium', name: 'McSpeech · męski' },
];

/** Dedykowany slot na własny głos — pliki trafiają do OPFS pod tą nazwą. */
export const CUSTOM_SLOT: VoiceId = 'pl_PL-mls_6892-low';
const CUSTOM_ONNX = 'pl_PL-mls_6892-low.onnx';
const CUSTOM_CFG = `${CUSTOM_ONNX}.json`;

async function piperDir(create = true): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle('piper', { create });
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, blob: Blob) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

async function exists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** Prefetch gotowego głosu (z postępem). */
export function ensureBuiltin(id: VoiceId, onProgress?: ProgressCallback): Promise<void> {
  return download(id, onProgress);
}

/** Synteza do WAV (Blob). Dla własnego głosu czyta pliki z OPFS. */
export function synthesize(
  text: string,
  voiceId: VoiceId,
  onProgress?: ProgressCallback,
): Promise<Blob> {
  return predict({ text, voiceId }, onProgress);
}

/** Wgrywa własny model Piper (ONNX + config) do slotu custom. */
export async function installCustomVoice(onnx: Blob, config: Blob): Promise<void> {
  const dir = await piperDir();
  await writeFile(dir, CUSTOM_ONNX, onnx);
  await writeFile(dir, CUSTOM_CFG, config);
}

export async function hasCustomVoice(): Promise<boolean> {
  try {
    const dir = await piperDir(false);
    return await exists(dir, CUSTOM_ONNX);
  } catch {
    return false;
  }
}

export async function removeCustomVoice(): Promise<void> {
  try {
    const dir = await piperDir(false);
    await dir.removeEntry(CUSTOM_ONNX);
    await dir.removeEntry(CUSTOM_CFG);
  } catch {
    /* nic nie było */
  }
}

export const isCustom = (id: VoiceId) => id === CUSTOM_SLOT;

/* ------------------------------------------------------------------ */
/* Przyspieszenie: cache sesji ONNX.                                   */
/* vits-web tworzy nową sesję (63 MB) przy KAŻDYM predict() — to       */
/* sekundy na słabym CPU. Podmieniamy InferenceSession.create tak, by  */
/* sesja była tworzona raz i reuse'owana. Config jest czytany z OPFS   */
/* na żywo, więc strojenie głosu/tempa działa bez przeładowania.       */
/* ------------------------------------------------------------------ */
let cachePatched = false;
const sessionCache = new Map<number, Promise<unknown>>();

export async function enableSessionCache(): Promise<void> {
  if (cachePatched) return;
  const ort = await import('onnxruntime-web');
  const IS = ort.InferenceSession as unknown as {
    create: (model: ArrayBuffer | Uint8Array | string, opts?: unknown) => Promise<unknown>;
  };
  const orig = IS.create;
  IS.create = (model, opts) => {
    if (typeof model === 'string') return orig(model, opts);
    const buf = model instanceof Uint8Array ? (model.buffer as ArrayBuffer) : model;
    const key = buf.byteLength;
    let p = sessionCache.get(key);
    if (!p) {
      p = orig(buf, opts);
      sessionCache.set(key, p);
      p.catch(() => sessionCache.delete(key));
    }
    return p;
  };
  cachePatched = true;
}

export function clearSessionCache(): void {
  sessionCache.clear();
}

/* ------------------------------------------------------------------ */
/* Profile głosu — strojenie barwy i tempa przez config w OPFS.        */
/* ------------------------------------------------------------------ */
export interface VoiceProfile {
  id: string;
  name: string;
  hint: string;
  noise_scale: number;
  noise_w: number;
  length_scale: number;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  { id: 'natural', name: 'Naturalny', hint: 'zbalansowany', noise_scale: 0.62, noise_w: 0.75, length_scale: 0.96 },
  { id: 'clean', name: 'Czysty', hint: 'mniej szumu', noise_scale: 0.48, noise_w: 0.58, length_scale: 0.96 },
  { id: 'warm', name: 'Ciepły', hint: 'więcej ekspresji', noise_scale: 0.72, noise_w: 0.9, length_scale: 1.0 },
  { id: 'fast', name: 'Szybki', hint: 'żwawsza mowa', noise_scale: 0.55, noise_w: 0.68, length_scale: 0.86 },
];

export const DEFAULT_PROFILE = VOICE_PROFILES[0];

/** Zapisuje parametry profilu do configu własnego głosu w OPFS (działa od razu). */
export async function applyVoiceProfile(p: VoiceProfile): Promise<void> {
  try {
    const dir = await piperDir(false);
    const fh = await dir.getFileHandle(CUSTOM_CFG);
    const cfg = JSON.parse(await (await fh.getFile()).text());
    cfg.inference = {
      ...(cfg.inference ?? {}),
      noise_scale: p.noise_scale,
      noise_w: p.noise_w,
      length_scale: p.length_scale,
    };
    await writeFile(dir, CUSTOM_CFG, new Blob([JSON.stringify(cfg)], { type: 'application/json' }));
  } catch {
    /* brak własnego głosu — profile dotyczą tylko klonu */
  }
}

/** Dzieli tekst na zdania (do streamingu — pierwsze zdanie gra od razu). */
export function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * Wczytuje głos opublikowany przez GitHub Actions (/voice/zayra.onnx).
 * Jeśli własny głos jest już zainstalowany, nie nadpisuje go.
 * Zwraca true, gdy własny głos (z repo lub wgrany) jest dostępny.
 */
export async function tryLoadPublishedVoice(): Promise<boolean> {
  try {
    if (await hasCustomVoice()) return true;
    const head = await fetch('/voice/zayra.onnx', { method: 'HEAD' });
    if (!head.ok) return false;
    const [onnx, cfg] = await Promise.all([
      fetch('/voice/zayra.onnx').then((r) => r.blob()),
      fetch('/voice/zayra.onnx.json').then((r) => r.blob()),
    ]);
    await installCustomVoice(onnx, cfg);
    return true;
  } catch {
    return false;
  }
}
