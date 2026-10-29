import { App, Modal, Notice, Setting } from "obsidian";
import { obsidianHttp } from "../http";
import { lookupWord, normalizeWord } from "../sources/lookup";
import type { WordEntry } from "../types";
import { addWord, findCard, type DictRef } from "../vault/dictionary";

export interface AddWordOptions {
  word?: string;
  dict: DictRef;
  sourceLink?: string;
  quote?: string;
}

/** Type a word → automatic lookup → editable preview → save into the dictionary. */
export class AddWordModal extends Modal {
  private entry: WordEntry | null = null;

  constructor(app: App, private opts: AddWordOptions) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("et-modal");
    this.titleEl.setText(this.opts.dict.name === "general" ? "Добавить слово" : `Слово в словарь книги «${this.opts.dict.name}»`);
    if (this.opts.word) void this.lookup(this.opts.word);
    else this.renderInput();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderInput(value = ""): void {
    const { contentEl } = this;
    contentEl.empty();
    const input = contentEl.createEl("input", { type: "text", cls: "et-input", attr: { placeholder: "Английское слово или фраза", autocapitalize: "off", autocorrect: "off", spellcheck: "false" } });
    input.value = value;
    const go = () => input.value.trim() && void this.lookup(input.value);
    input.addEventListener("keydown", (ev) => ev.key === "Enter" && go());
    const btn = contentEl.createEl("button", { text: "Перевести", cls: "mod-cta et-btn" });
    btn.addEventListener("click", go);
    window.setTimeout(() => input.focus(), 50);
  }

  private async lookup(raw: string): Promise<void> {
    const word = normalizeWord(raw);
    const existing = findCard(this.app, this.opts.dict, word);
    if (existing) {
      new Notice(`«${word}» уже есть в словаре`);
      this.close();
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: `Ищу перевод «${word}»…`, cls: "et-muted" });
    this.entry = await lookupWord(word, obsidianHttp);
    this.renderPreview();
  }

  private renderPreview(): void {
    const e = this.entry!;
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: e.word, cls: "et-word" });
    const meta = [e.transcription, e.pos].filter(Boolean).join(" · ");
    if (meta) contentEl.createEl("div", { text: meta, cls: "et-muted" });
    if (!e.translation) contentEl.createEl("p", { text: "Перевод не найден (нет сети или слова нет в словарях). Впишите его сами.", cls: "et-warn" });
    new Setting(contentEl).setName("Перевод").addTextArea((t) => {
      t.setValue(e.translation).onChange((v) => (e.translation = v.trim()));
      t.inputEl.addClass("et-textarea");
    });
    if (e.meanings.length) {
      contentEl.createEl("div", { text: "Значения", cls: "et-label" });
      const ol = contentEl.createEl("ol", { cls: "et-list" });
      for (const m of e.meanings.slice(0, 6)) ol.createEl("li", { text: m.text });
    }
    if (e.examples.length) {
      contentEl.createEl("div", { text: "Примеры", cls: "et-label" });
      const ul = contentEl.createEl("ul", { cls: "et-list" });
      for (const x of e.examples) {
        const li = ul.createEl("li");
        li.createEl("em", { text: x.en });
        if (x.ru) li.appendText(` — ${x.ru}`);
      }
    }
    if (this.opts.quote) contentEl.createEl("blockquote", { text: this.opts.quote, cls: "et-quote" });
    const row = contentEl.createDiv({ cls: "et-row" });
    row.createEl("button", { text: "Другое слово", cls: "et-btn" }).addEventListener("click", () => this.renderInput(e.word));
    row.createEl("button", { text: "Сохранить", cls: "mod-cta et-btn" }).addEventListener("click", () => void this.save());
  }

  private async save(): Promise<void> {
    const e = this.entry!;
    const { file, created } = await addWord(this.app, this.opts.dict, e, { sourceLink: this.opts.sourceLink, quote: this.opts.quote });
    new Notice(created ? `«${e.word}» добавлено в словарь` : `«${e.word}» уже было в словаре`);
    this.close();
    if (this.opts.dict.name === "general" && !this.opts.sourceLink) await this.app.workspace.getLeaf(false).openFile(file);
  }
}
