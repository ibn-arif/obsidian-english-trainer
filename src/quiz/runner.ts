import type { Grade } from "../types";
import type { CardInfo } from "../vault/dictionary";
import type { QuizItem } from "./session";

export function checkTyped(input: string, answer: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "").toLowerCase();
  return norm(input) === norm(answer);
}

interface Slot {
  item: QuizItem;
  requeued: boolean;
}

/** Walks a session: wrong answers come back once at the end; each word is graded once, after its last item. */
export class QuizRunner {
  private queue: Slot[];
  private missed = new Set<CardInfo>();
  private firstTry = { correct: 0, total: 0 };

  constructor(items: QuizItem[]) {
    this.queue = items.map((item) => ({ item, requeued: false }));
    this.firstTry.total = items.length;
  }

  remaining(): number {
    return this.queue.length;
  }

  current(): QuizItem | null {
    return this.queue[0]?.item ?? null;
  }

  /** Returns the words whose last item has just been answered, with their grade. */
  answer(correct: boolean): { card: CardInfo; grade: Grade }[] {
    const slot = this.queue.shift();
    if (!slot) return [];
    if (!slot.requeued && correct) this.firstTry.correct++;
    if (!correct) {
      this.missed.add(slot.item.card);
      if (!slot.requeued) this.queue.push({ item: slot.item, requeued: true });
    }
    const card = slot.item.card;
    if (this.queue.some((s) => s.item.card === card)) return [];
    return [{ card, grade: this.missed.has(card) ? 0 : 1 }];
  }

  summary(): { correct: number; total: number; toRepeat: CardInfo[] } {
    return { ...this.firstTry, toRepeat: [...this.missed] };
  }
}
