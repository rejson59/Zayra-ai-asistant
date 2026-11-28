import type { MLCEngine } from '@mlc-ai/web-llm';

/** Mózg Zayry: federacja darmowych chmur (bez klucza) + lokalny model w przeglądarce. */
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
    hint: 'GPT-6 + Kilo + OVH · online · tysiące odpowiedzi dziennie',
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

// ---------- wykrywanie zdań w strumieniu ----------

const SENT_END = /[.!?…]+["»)]?\s/g;
/** Wyłuskuje gotowe zdania z narastającego tekstu (od indeksu `from`). */
function drainSentences(full: string, from: number): { out: string[]; next: number } {
  const out: string[] = [];
  let last = from;
  SENT_END.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = SENT_END.exec(full))) {
    const end = m.index + m[0].length;
    const s = full.slice(last, end).trim();
    if (s) out.push(s);
    last = end;
  }
  return { out, next: last };
}
const splitAll = (t: string): string[] =>
  t
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const dayKey = () => new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  onSentence?: (s: string) => void,
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
  let emitted = 0;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) full += delta;
    if (onSentence) {
      const { out, next } = drainSentences(full, emitted);
      emitted = next;
      for (const s of out) onSentence(s);
    }
  }
  if (onSentence) {
    const tail = full.slice(emitted).trim();
    if (tail) onSentence(tail);
  }
  return full.trim();
}

// ---------- federacja darmowych chmur (bez klucza, bez konta) ----------
// Kilka niezależnych źródeł, każde z własnym limitem. Gdy jedno ma limit,
// odpowiada kolejne -> większy dzienny limit i brak czekania (szybciej).
//  - Pollinations: GPT-6 Luna, 100/dzień, 1/45 s.
//  - Kilo Gateway: Nemotron/Ernie, 200/godzinę (~4800/dzień), bez cooldownu.
//  - OVHcloud: Qwen3.6, 2/min na model, EU, nie przechowuje danych.

interface CloudProvider {
  id: string;
  label: string;
  url: string;
  model: string;
  cooldownMs: number;
  dailyLimit: number;
  timeoutMs: number;
}

const PROVIDERS: CloudProvider[] = [
  {
    id: 'pollinations',
    label: 'GPT-6',
    url: 'https://text.pollinations.ai/openai',
    model: 'openai-fast',
    cooldownMs: 45_000,
    dailyLimit: 100,
    timeoutMs: 60_000,
  },
  {
    id: 'kilo',
    label: 'Kilo · Nemotron',
    url: 'https://ai-gateway.kilo.ai/api/v1/chat/completions',
    model: 'kilo-auto/free',
    cooldownMs: 0,
    dailyLimit: 4000,
    timeoutMs: 30_000,
  },
  {
    id: 'ovh',
    label: 'OVH · Qwen (EU)',
    url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
    model: 'Qwen3.6-27B',
    cooldownMs: 30_000,
    dailyLimit: 2000,
    timeoutMs: 30_000,
  },
];

const pLast = (p: CloudProvider) => Number(localStorage.getItem('zayra-cl-at-' + p.id) ?? 0) || 0;
const pUsed = (p: CloudProvider) => {
  if (localStorage.getItem('zayra-cl-day-' + p.id) !== dayKey()) return 0;
  return Number(localStorage.getItem('zayra-cl-used-' + p.id) ?? 0) || 0;
};
const pCooldown = (p: CloudProvider) => Math.max(0, p.cooldownMs - (Date.now() - pLast(p)));
const pRemaining = (p: CloudProvider) => Math.max(0, p.dailyLimit - pUsed(p));
const pMark = (p: CloudProvider) => {
  localStorage.setItem('zayra-cl-at-' + p.id, String(Date.now()));
  localStorage.setItem('zayra-cl-day-' + p.id, dayKey());
  localStorage.setItem('zayra-cl-used-' + p.id, String(pUsed(p) + 1));
};

export interface CloudStatus {
  id: string;
  label: string;
  used: number;
  limit: number;
  cooldown: number;
}
export const cloudStatus = (): CloudStatus[] =>
  PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    used: pUsed(p),
    limit: p.dailyLimit,
    cooldown: pCooldown(p),
  }));

/** Sprawdza, które źródła są osiągalne z tej przeglądarki (CORS + sieć). */
export const testCloudSources = async (): Promise<
  Array<{ id: string; label: string; ok: boolean }>
> =>
  Promise.all(
    PROVIDERS.map(async (p) => {
      const modelsUrl =
        p.id === 'pollinations'
          ? 'https://text.pollinations.ai/models'
          : p.url.replace(/\/chat\/completions$/, '/models');
      try {
        const res = await fetch(modelsUrl, { signal: AbortSignal.timeout(8000) });
        return { id: p.id, label: p.label, ok: res.ok };
      } catch {
        return { id: p.id, label: p.label, ok: false };
      }
    }),
  );

// ---------- tryb cierpliwy + cache ----------

let patient = localStorage.getItem('zayra-patient') === '1';
export const setPatient = (v: boolean) => {
  patient = v;
  localStorage.setItem('zayra-patient', v ? '1' : '0');
};
export const isPatient = () => patient;

const CACHE_STORAGE = 'zayra-ans-cache';
const CACHE_MAX = 120;
type CacheMap = Record<string, { t: string; at: number }>;
const readCache = (): CacheMap => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_STORAGE) ?? '{}') as CacheMap;
  } catch {
    return {};
  }
};
const cacheKey = (history: ChatMessage[]) => {
  const last = history[history.length - 1]?.content ?? '';
  const ctx = history
    .slice(-3, -1)
    .map((m) => m.content)
    .join('|');
  return (ctx + '>>' + last).toLowerCase().replace(/\s+/g, ' ').trim();
};
const cacheGet = (k: string): string | null => readCache()[k]?.t ?? null;
const cacheSet = (k: string, t: string) => {
  const c = readCache();
  c[k] = { t, at: Date.now() };
  const top = Object.entries(c)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX);
  try {
    localStorage.setItem(CACHE_STORAGE, JSON.stringify(Object.fromEntries(top)));
  } catch {
    /* pełny storage — trudno */
  }
};

// ---------- pojedyncze źródło chmury (streaming SSE) ----------

async function callProvider(
  p: CloudProvider,
  history: ChatMessage[],
  onStatus?: (s: string | null) => void,
  cancelled?: () => boolean,
  wait = false,
  onSentence?: (s: string) => void,
): Promise<string> {
  if (pRemaining(p) <= 0) throw new Error('daily');
  let w = wait ? pCooldown(p) : 0;
  while (w > 0) {
    if (cancelled?.()) throw new Error('cancelled');
    onStatus?.(`${p.label}: odpowiedź za ${Math.ceil(w / 1000)} s…`);
    await sleep(Math.min(1000, w));
    w = pCooldown(p);
  }
  if (cancelled?.()) throw new Error('cancelled');
  onStatus?.(`Pytam: ${p.label}…`);
  const res = await fetch(p.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      stream: !!onSentence,
    }),
    signal: AbortSignal.timeout(p.timeoutMs),
  });
  if (res.status === 402 || res.status === 429) {
    pMark(p);
    throw new Error('rate');
  }
  if (!res.ok) throw new Error('http ' + res.status);
  pMark(p);

  const ctype = res.headers.get('content-type') ?? '';
  if (onSentence && ctype.includes('text/event-stream') && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let full = '';
    let emitted = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (cancelled?.()) {
          void reader.cancel();
          throw new Error('cancelled');
        }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const payload = t.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const d = j.choices?.[0]?.delta?.content;
            if (d) full += d;
          } catch {
            /* niepełny / sercowy wpis */
          }
        }
        const { out, next } = drainSentences(full, emitted);
        emitted = next;
        for (const s of out) onSentence(s);
      }
    } catch (e) {
      if (full.trim()) {
        const tail = full.slice(emitted).trim();
        if (tail) onSentence(tail);
        return full.trim();
      }
      throw e;
    }
    const tail = full.slice(emitted).trim();
    if (tail) onSentence(tail);
    return full.trim();
  }

  const raw = await res.text();
  let text = '';
  try {
    const data = JSON.parse(raw);
    const t = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text;
    if (typeof t === 'string') text = t.trim();
  } catch {
    /* odpowiedź zwykłym tekstem */
  }
  if (!text && raw.trim() && !raw.trim().startsWith('{')) text = raw.trim();
  if (!text) throw new Error('empty');
  if (onSentence) for (const s of splitAll(text)) onSentence(s);
  return text;
}

// ---------- routing ----------

export interface AnswerResult {
  text: string;
  source: 'cloud' | 'local';
  provider?: string;
}

export async function answer(
  brain: Brain,
  history: ChatMessage[],
  onStatus?: (s: string | null) => void,
  cancelled?: () => boolean,
  onSentence?: (s: string) => void,
): Promise<AnswerResult> {
  const useLocal = () =>
    localAnswer(brain.modelId ?? AUTO_LOCAL_MODEL, history, onStatus, onSentence).then((text) => ({
      text,
      source: 'local' as const,
    }));

  if (brain.kind === 'local') return useLocal();

  // cache: powtórzone pytanie -> natychmiast, bez limitu
  const k = cacheKey(history);
  const hit = cacheGet(k);
  if (hit) {
    onStatus?.(null);
    if (onSentence) for (const s of splitAll(hit)) onSentence(s);
    return { text: hit, source: 'cloud', provider: 'pamięć' };
  }

  const succeed = async (p: CloudProvider, wait: boolean) => {
    const text = await callProvider(p, history, onStatus, cancelled, wait, onSentence);
    cacheSet(k, text);
    onStatus?.(null);
    return { text, source: 'cloud' as const, provider: p.label };
  };

  if (navigator.onLine) {
    // 1) źródła gotowe od razu (bez czekania) — najszybciej
    for (const p of PROVIDERS) {
      if (pRemaining(p) <= 0 || pCooldown(p) > 0) continue;
      try {
        return await succeed(p, false);
      } catch (e) {
        if (cancelled?.() || (e instanceof Error && e.message === 'cancelled')) throw e;
        onStatus?.(null);
      }
    }
    // 2) wszystkie zajęte: poczekaj na najbliższe (gdy chmura/cierpliwy)
    if (brain.kind === 'cloud' || patient) {
      const avail = PROVIDERS.filter((p) => pRemaining(p) > 0).sort(
        (a, b) => pCooldown(a) - pCooldown(b),
      );
      for (const p of avail) {
        try {
          return await succeed(p, true);
        } catch (e) {
          if (cancelled?.() || (e instanceof Error && e.message === 'cancelled')) throw e;
          onStatus?.(null);
        }
      }
    }
  }

  if (brain.kind === 'cloud') {
    throw new Error('Chmury niedostępne — spróbuj później albo wybierz lokalny mózg.');
  }
  return useLocal();
}
