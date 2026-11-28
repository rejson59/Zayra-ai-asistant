import type { MLCEngine } from '@mlc-ai/web-llm';

/** Mózg Zayry: darmowa chmura (bez klucza) i/lub lokalny model w przeglądarce. */
export type BrainKind = 'auto' | 'cloud' | 'local';

export interface Brain {
  id: string;
  name: string;
  hint: string;
  size: string;
  kind: BrainKind;
  modelId?: string;
}

export const BRAINS: Brain[] = [
  {
    id: 'auto',
    name: 'Auto',
    hint: 'mądra chmura online, lokalnie gdy offline (polecany)',
    size: '—',
    kind: 'auto',
  },
  {
    id: 'cloud',
    name: 'Chmura',
    hint: 'najmądrzejsza · online · limit ok. 1 pytanie / 45 s',
    size: '0 MB',
    kind: 'cloud',
  },
  {
    id: 'qwen3-1.7b',
    name: 'Lokalny',
    hint: 'Qwen3 1.7B · offline · przyzwoita polszczyzna',
    size: '~1,1 GB',
    kind: 'local',
    modelId: 'Qwen3-1.7B-q4f16_1-MLC',
  },
  {
    id: 'qwen3-4b',
    name: 'Lokalny mądry',
    hint: 'Qwen3 4B · offline · lepszy, ale wymaga mocnego GPU',
    size: '~2,5 GB',
    kind: 'local',
    modelId: 'Qwen3-4B-q4f16_1-MLC',
  },
  {
    id: 'qwen3-0.6b',
    name: 'Lokalny lekki',
    hint: 'najszybszy · offline · słabsza polszczyzna',
    size: '~0,4 GB',
    kind: 'local',
    modelId: 'Qwen3-0.6B-q4f16_1-MLC',
  },
];

export const DEFAULT_BRAIN = BRAINS[0];
const AUTO_LOCAL_MODEL = 'Qwen3-1.7B-q4f16_1-MLC';

export const hasWebGPU = (): boolean =>
  typeof navigator !== 'undefined' && 'gpu' in navigator;

/** Model lokalny do preloadu dla danego mózgu (null = nie trzeba). */
export const localModelFor = (brain: Brain): string | null => {
  if (brain.kind === 'cloud') return null;
  return brain.modelId ?? AUTO_LOCAL_MODEL;
};

const SYSTEM_PROMPT =
  'Jesteś Zayrą — osobistą asystentką głosową. Odpowiadaj WYŁĄCZNIE po polsku. ' +
  'Odpowiedź ma być krótka (1–3 zdania), naturalna i konkretna — będzie czytana na głos. ' +
  'Bezwzględnie bez list, punktorów, myślników, nagłówków, markdown, emoji i kodu. ' +
  'Odpowiadaj dokładnie na to, o co pytają. Jeśli czegoś nie wiesz, przyznaj to jednym zdaniem.';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Usuwa markdown/listy z odpowiedzi, żeby głos brzmiał naturalnie. */
export function cleanAnswer(t: string): string {
  return t
    .replace(/<think>[\s\S]*?<\/think>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*[-–•*]\s+/gm, '')
    .replace(/[*#`>]/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ---------- lokalny silnik (WebLLM) ----------

let engine: MLCEngine | null = null;
let loadedId: string | null = null;
let loading: Promise<MLCEngine> | null = null;

export const isModelLoaded = (id: string) => loadedId === id && engine !== null;

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

async function localAnswer(
  modelId: string,
  history: ChatMessage[],
  onStatus?: (s: string | null) => void,
): Promise<string> {
  if (!hasWebGPU()) {
    throw new Error('Lokalny mózg wymaga WebGPU — użyj Chrome lub Edge.');
  }
  if (!isModelLoaded(modelId)) onStatus?.('Przygotowuję lokalny mózg…');
  const e = await loadModel(modelId);
  onStatus?.(null);
  const stream = await e.chat.completions.create({
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    stream: true,
    temperature: 0.5,
    max_tokens: 220,
    frequency_penalty: 0.2,
    // runtime WebLLM czyta enable_thinking z extra_body (typy w 0.2.89 tego nie nadążają)
    ...{ extra_body: { enable_thinking: false } },
  });
  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) full += delta;
  }
  return full.trim();
}

// ---------- darmowa chmura (Pollinations, bez klucza) ----------

async function cloudAnswer(history: ChatMessage[]): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai-fast',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      temperature: 0.5,
      max_tokens: 220,
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (res.status === 402 || res.status === 429) {
    throw new Error('Darmowa chmura ma limit ok. 1 pytania na 45 s — odczekaj chwilę.');
  }
  if (!res.ok) throw new Error(`Chmura nie odpowiada (${res.status}).`);
  const raw = await res.text();
  try {
    const data = JSON.parse(raw);
    const text = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
    if (typeof text === 'string' && text.trim()) return text.trim();
  } catch {
    /* odpowiedź zwykłym tekstem */
  }
  if (raw.trim() && !raw.trim().startsWith('{')) return raw.trim();
  throw new Error('Chmura nie zwróciła odpowiedzi.');
}

// ---------- routing ----------

export interface AnswerResult {
  text: string;
  source: 'cloud' | 'local';
}

export async function answer(
  brain: Brain,
  history: ChatMessage[],
  onStatus?: (s: string | null) => void,
): Promise<AnswerResult> {
  const useLocal = () =>
    localAnswer(brain.modelId ?? AUTO_LOCAL_MODEL, history, onStatus).then((text) => ({
      text,
      source: 'local' as const,
    }));

  if (brain.kind === 'local') return useLocal();
  if (brain.kind === 'cloud') {
    onStatus?.('Pytam chmurę…');
    const text = await cloudAnswer(history);
    onStatus?.(null);
    return { text, source: 'cloud' };
  }
  // auto: chmura gdy online, lokalny fallback
  if (navigator.onLine) {
    try {
      onStatus?.('Pytam chmurę…');
      const text = await cloudAnswer(history);
      onStatus?.(null);
      return { text, source: 'cloud' };
    } catch {
      onStatus?.(null);
    }
  }
  return useLocal();
}
