import { isDue, statusOf } from "../srs";
import type { CardInfo } from "../vault/dictionary";

export type Format = "flash" | "choice-en" | "choice-ru" | "type" | "cloze";

export interface QuizItem {
  card: CardInfo;
  format: Format;
  prompt: string;
  answer: string;
  options?: string[];
}

const RANK: Record<Format, number> = { flash: 0, "choice-en": 1, "choice-ru": 1, type: 2, cloze: 3 };

/** Deterministic PRNG (mulberry32) for tests; the view passes Math.random. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function makeOptions(answer: string, pool: string[], rng: () => number): string[] {
  const others = shuffle([...new Set(pool.filter((p) => p && p !== answer))], rng).slice(0, 3);
  return shuffle([answer, ...others], rng);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clozeOf(sentence: string, word: string): string | null {
  const whole = new RegExp(`\\b${escapeRe(word)}\\b`, "gi");
  if (whole.test(sentence)) return sentence.replace(whole, "_____");
  const part = new RegExp(escapeRe(word), "gi");
  return part.test(sentence) ? sentence.replace(part, "_____") : null;
}

/**
 * Picks due words (oldest first), then new ones (≤ maxNew) until `size` words,
 * and lays the items out from easy to hard: flash → choice → type → cloze.
 */
export function buildSession(cards: CardInfo[], today: string, size: number, maxNew: number, rng: () => number): QuizItem[] {
  const dueOld = cards.filter((c) => c.srs.reps > 0 && isDue(c.srs, today)).sort((a, b) => a.srs.due.localeCompare(b.srs.due));
  const fresh = shuffle(cards.filter((c) => c.srs.reps === 0), rng).slice(0, Math.max(0, maxNew));
  const chosen = [...dueOld.slice(0, size), ...fresh].slice(0, size);

  const words = cards.map((c) => c.word);
  const translations = cards.map((c) => c.translation).filter(Boolean);
  const items: QuizItem[] = [];
  const choice = (c: CardInfo): QuizItem | null => {
    const enToRu = rng() < 0.5;
    const answer = enToRu ? c.translation : c.word;
    const options = makeOptions(answer, enToRu ? translations : words, rng);
    if (!answer || options.length < 2) return null;
    return { card: c, format: enToRu ? "choice-en" : "choice-ru", prompt: enToRu ? c.word : c.translation, answer, options };
  };
  const typed = (c: CardInfo): QuizItem => ({ card: c, format: "type", prompt: c.translation || c.word, answer: c.word });
  const cloze = (c: CardInfo): QuizItem | null => {
    for (const ex of shuffle(c.examples, rng)) {
      const p = clozeOf(ex.en, c.word);
      if (p) return { card: c, format: "cloze", prompt: ex.ru ? `${p}\n(${ex.ru})` : p, answer: c.word };
    }
    return null;
  };

  for (const c of chosen) {
    const st = statusOf(c.srs);
    if (st === "новое") {
      items.push({ card: c, format: "flash", prompt: c.word, answer: c.translation });
      const ch = choice(c);
      if (ch) items.push(ch);
    } else if (st === "учу") {
      const pick = Math.floor(rng() * 4);
      const it = pick === 0 || pick === 1 ? choice(c) : pick === 2 ? typed(c) : cloze(c);
      items.push(it ?? typed(c));
    } else {
      items.push((rng() < 0.5 ? cloze(c) : null) ?? typed(c));
    }
  }
  const ranked = shuffle(items, rng);
  return ranked.sort((a, b) => RANK[a.format] - RANK[b.format]);
}
