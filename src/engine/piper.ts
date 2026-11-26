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
