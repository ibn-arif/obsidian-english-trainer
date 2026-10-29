import type { Example } from "../types";

interface TSentence {
  text?: string;
  lang?: string;
}

/** Up to 3 sentence pairs; with `word`, only sentences that actually contain it (Tatoeba matches loosely). */
export function parseTatoeba(json: unknown, word?: string): Example[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: Example[] = [];
  for (const s of data as { text?: string; translations?: unknown[] }[]) {
    const all = (s.translations ?? []).flat() as TSentence[];
    const ru = all.find((t) => t?.lang === "rus")?.text;
    if (word && s.text && !s.text.toLowerCase().includes(word.toLowerCase())) continue;
    if (s.text && ru) out.push({ en: s.text, ru });
    if (out.length === 3) break;
  }
  return out;
}
