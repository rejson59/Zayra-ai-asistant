import type { MLCEngine } from '@mlc-ai/web-llm';

/** Lokalny mózg Zayry — działa w przeglądarce (WebGPU), offline po pobraniu, bez API. */
export interface LlmModel {
  id: string;
  name: string;
  hint: string;
  size: string;
}

export const LLM_MODELS: LlmModel[] = [
  { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', name: 'Lekki', hint: 'szybszy, słabsza polszczyzna', size: '~280 MB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Zrównoważony', hint: 'lepsza polszczyzna (polecany)', size: '~840 MB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 1B', hint: 'alternatywa, dobra instrukcja', size: '~670 MB' },
];

export const DEFAULT_LLM = LLM_MODELS[1];

export const hasWebGPU = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

const SYSTEM_PROMPT =
  'Jesteś Zayrą — osobistą asystentką głosową. Odpowiadaj po polsku, naturalnie, ciepło i zwięźle ' +
  '(zwykle 1–3 krótkie zdania), tak żeby odpowiedź dobrze brzmiała czytana na głos. ' +
  'Bez emoji, bez markdown, bez list i nagłówków. Jeśli nie czegoś wiesz, powiedz to krótko i zaproponuj pomoc.';

let engine: MLCEngine | null = null;
let loadedId: string | null = null;
let loading: Promise<MLCEngine> | null = null;

export const isModelLoaded = (id: string) => loadedId === id && engine !== null;

/** Ładuje (i cache'uje) model. Pierwsze pobranie trwa; potem offline z cache przeglądarki. */
export function loadModel(
  id: string,
  onProgress?: (p: number, text: string) => void,
): Promise<MLCEngine> {
  if (engine && loadedId === id) return Promise.resolve(engine);
  if (loading && loadedId === id) return loading;
  loadedId = id;
  loading = (async () => {
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    const e = await CreateMLCEngine(id, {
      initProgressCallback: (r) => onProgress?.(r.progress, r.text),
    });
    engine = e;
    loading = null;
    return e;
  })();
  loading.catch(() => {
    loading = null;
    engine = null;
    loadedId = null;
  });
  return loading;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Strumieniuje odpowiedź modelu; onToken woła się z pełnym tekstem do tej pory. */
export async function streamChat(
  id: string,
  history: ChatMessage[],
  onToken: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const e = await loadModel(id);
  const stream = await e.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    stream: true,
    temperature: 0.6,
    max_tokens: 400,
  });
  let full = '';
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      full += delta;
      onToken(full);
    }
  }
  return full.trim();
}
