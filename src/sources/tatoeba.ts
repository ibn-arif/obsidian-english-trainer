import type { Example } from "../types";

interface TSentence {
  text?: string;
  lang?: string;
}

export function parseTatoeba(json: unknown): Example[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const out: Example[] = [];
  for (const s of data as { text?: string; translations?: unknown[] }[]) {
    const all = (s.translations ?? []).flat() as TSentence[];
    const ru = all.find((t) => t?.lang === "rus")?.text;
    if (s.text && ru) out.push({ en: s.text, ru });
    if (out.length === 3) break;
  }
  return out;
}
