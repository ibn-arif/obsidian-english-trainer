import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { QuizRunner, checkTyped } from "../quiz/runner";
import { buildSession, type QuizItem } from "../quiz/session";
import type { Settings } from "../settings";
import { isDue, review, statusOf, today } from "../srs";
import { bookDict, bookTitles, generalDict, listCards, rebuildIndex, saveReview, type CardInfo, type DictRef } from "../vault/dictionary";

export const VIEW_TYPE_QUIZ = "english-trainer-quiz";

type Source = "all" | "general" | `book:${string}`;

export class QuizView extends ItemView {
  private runner: QuizRunner | null = null;
  private total = 0;
  private touched = new Map<string, DictRef>();
  private source: Source = "all";

  constructor(leaf: WorkspaceLeaf, private settings: () => Settings) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_QUIZ;
  }
  getDisplayText(): string {
    return "Заучивание слов";
  }
  getIcon(): string {
    return "graduation-cap";
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("et-quiz");
    await this.renderStart();
  }

  private dictOf(src: Source): DictRef | "all" {
    if (src === "all") return "all";
    if (src === "general") return generalDict(this.settings());
    return bookDict(this.settings(), src.slice(5));
  }

  private async renderStart(): Promise<void> {
    const el = this.contentEl;
    el.empty();
    el.createEl("h2", { text: "Заучивание" });
    const select = el.createEl("select", { cls: "dropdown et-select" });
    const add = (value: Source, label: string) => select.createEl("option", { value, text: label });
    add("all", "Все словари");
    add("general", "Общий словарь");
    for (const t of bookTitles(this.app, this.settings())) add(`book:${t}`, `Книга: ${t}`);
    select.value = this.source;
    const stats = el.createEl("p", { cls: "et-muted" });
    const start = el.createEl("button", { text: "Начать", cls: "mod-cta et-btn et-wide" });
    const refresh = async () => {
      this.source = select.value as Source;
      const cards = await listCards(this.app, this.settings(), this.dictOf(this.source));
      const day = today();
      const due = cards.filter((c) => c.srs.reps > 0 && isDue(c.srs, day)).length;
      const fresh = cards.filter((c) => c.srs.reps === 0).length;
      stats.setText(`Слов: ${cards.length} · пора повторить: ${due} · новых: ${fresh}`);
      start.disabled = due + fresh === 0;
      return cards;
    };
    select.addEventListener("change", () => void refresh());
    await refresh();
    start.addEventListener("click", () => void this.startSession(refresh));
  }

  private async startSession(refresh: () => Promise<CardInfo[]>): Promise<void> {
    const cards = await refresh();
    const s = this.settings();
    const items = buildSession(cards, today(), s.sessionSize, s.maxNew, Math.random);
    if (!items.length) return;
    this.runner = new QuizRunner(items);
    this.total = items.length;
    this.touched.clear();
    this.renderItem();
  }

  private renderItem(): void {
    const item = this.runner?.current();
    if (!item) return void this.renderSummary();
    const el = this.contentEl;
    el.empty();
    const done = this.total - this.runner!.remaining();
    const bar = el.createDiv({ cls: "et-progress" });
    bar.createDiv({ cls: "et-progress-fill" }).setCssProps({ "--et-progress": `${Math.min(100, (done / this.total) * 100)}%` });
    el.createDiv({ text: `${Math.min(done + 1, this.total)} из ${this.total}`, cls: "et-muted et-center" });
    const card = el.createDiv({ cls: "et-card" });
    if (item.format === "flash") this.flash(card, item);
    else if (item.format === "choice-en" || item.format === "choice-ru") this.choice(card, item);
    else this.typed(card, item);
  }

  private label(card: HTMLElement, text: string): void {
    card.createDiv({ text, cls: "et-hint" });
  }

  private flash(card: HTMLElement, item: QuizItem): void {
    this.label(card, "Вспомните перевод");
    card.createDiv({ text: item.prompt, cls: "et-prompt" });
    const show = card.createEl("button", { text: "Показать", cls: "et-btn et-wide" });
    show.addEventListener("click", () => {
      show.remove();
      card.createDiv({ text: item.answer || "—", cls: "et-answer" });
      const ex = item.card.examples[0];
      if (ex) card.createDiv({ text: ex.ru ? `${ex.en} — ${ex.ru}` : ex.en, cls: "et-muted et-example" });
      const row = card.createDiv({ cls: "et-row et-row-wide" });
      row.createEl("button", { text: "Не знаю", cls: "et-btn et-no" }).addEventListener("click", () => void this.answer(false, item));
      row.createEl("button", { text: "Знаю", cls: "et-btn et-yes" }).addEventListener("click", () => void this.answer(true, item));
    });
  }

  private choice(card: HTMLElement, item: QuizItem): void {
    this.label(card, item.format === "choice-en" ? "Выберите перевод" : "Выберите английское слово");
    card.createDiv({ text: item.prompt, cls: "et-prompt" });
    const grid = card.createDiv({ cls: "et-options" });
    const buttons = (item.options ?? []).map((o) => {
      const b = grid.createEl("button", { text: o, cls: "et-btn et-option" });
      b.addEventListener("click", () => {
        const ok = o === item.answer;
        for (const x of buttons) {
          x.disabled = true;
          if (x.textContent === item.answer) x.addClass("et-right");
        }
        if (!ok) b.addClass("et-wrong");
        window.setTimeout(() => void this.answer(ok, item), ok ? 700 : 1500);
      });
      return b;
    });
  }

  private typed(card: HTMLElement, item: QuizItem): void {
    this.label(card, item.format === "cloze" ? "Впишите пропущенное слово" : "Напишите по-английски");
    const [main, hint] = item.prompt.split("\n");
    card.createDiv({ text: main, cls: item.format === "cloze" ? "et-prompt et-sentence" : "et-prompt" });
    if (hint) card.createDiv({ text: hint, cls: "et-muted et-center" });
    const input = card.createEl("input", { type: "text", cls: "et-input", attr: { autocapitalize: "off", autocorrect: "off", spellcheck: "false", placeholder: "Ответ" } });
    const check = card.createEl("button", { text: "Проверить", cls: "mod-cta et-btn et-wide" });
    const go = () => {
      if (input.disabled) return;
      const ok = checkTyped(input.value, item.answer);
      input.disabled = true;
      check.remove();
      const fb = card.createDiv({ cls: ok ? "et-feedback et-right" : "et-feedback et-wrong" });
      fb.setText(ok ? "Верно!" : `Правильно: ${item.answer}`);
      if (ok) window.setTimeout(() => void this.answer(true, item), 700);
      else card.createEl("button", { text: "Дальше", cls: "et-btn et-wide" }).addEventListener("click", () => void this.answer(false, item));
    };
    input.addEventListener("keydown", (e) => e.key === "Enter" && go());
    check.addEventListener("click", go);
    window.setTimeout(() => input.focus(), 50);
  }

  private async answer(correct: boolean, item: QuizItem): Promise<void> {
    if (this.runner?.current() !== item) return;
    const finished = this.runner.answer(correct, item);
    const day = today();
    for (const { card, grade } of finished) {
      const next = review(card.srs, grade, day);
      await saveReview(this.app, card, next, statusOf(next));
      this.markTouched(card);
    }
    this.renderItem();
  }

  private markTouched(card: CardInfo): void {
    const d = card.dictionary === "general" ? generalDict(this.settings()) : bookDict(this.settings(), card.dictionary);
    this.touched.set(d.index, d);
  }

  private async renderSummary(): Promise<void> {
    const el = this.contentEl;
    el.empty();
    const s = this.runner!.summary();
    el.createEl("h2", { text: "Сессия окончена" });
    el.createDiv({ text: `Правильно с первого раза: ${s.correct} из ${s.total}`, cls: "et-score" });
    if (s.toRepeat.length) {
      el.createDiv({ text: "Стоит повторить:", cls: "et-label" });
      const ul = el.createEl("ul", { cls: "et-list" });
      for (const c of s.toRepeat) {
        const a = ul.createEl("li").createEl("a", { text: `${c.word} — ${c.translation}`, cls: "internal-link" });
        a.addEventListener("click", () => void this.app.workspace.getLeaf(false).openFile(c.file));
      }
    } else el.createDiv({ text: "Ошибок нет — отлично!", cls: "et-muted" });
    const row = el.createDiv({ cls: "et-row et-row-wide" });
    const again = row.createEl("button", { cls: "mod-cta et-btn" });
    setIcon(again, "rotate-ccw");
    again.appendText(" Ещё сессия");
    again.addEventListener("click", () => void this.renderStart());
    for (const d of this.touched.values()) await rebuildIndex(this.app, d);
    this.touched.clear();
  }
}
