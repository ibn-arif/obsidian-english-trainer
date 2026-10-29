import { App, Modal, Notice } from "obsidian";
import { importBook } from "../books/importBook";
import type { Settings } from "../settings";

export class ImportBookModal extends Modal {
  constructor(app: App, private settings: Settings) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("et-modal");
    this.titleEl.setText("Загрузить книгу");
    const { contentEl } = this;
    contentEl.createEl("p", { text: "EPUB и FB2 (в том числе .fb2.zip) раскладываются на главы-заметки, PDF открывается встроенным просмотрщиком.", cls: "et-muted" });
    const input = contentEl.createEl("input", { type: "file", attr: { accept: ".epub,.fb2,.zip,.pdf,application/epub+zip,application/pdf,application/x-fictionbook+xml" } });
    const status = contentEl.createEl("p", { cls: "et-muted" });
    input.addEventListener("change", async () => {
      const f = input.files?.[0];
      if (!f) return;
      status.setText(`Загружаю «${f.name}»…`);
      try {
        const note = await importBook(this.app, this.settings, { name: f.name, data: await f.arrayBuffer() });
        new Notice(`Книга загружена: ${note.basename}`);
        this.close();
        await this.app.workspace.getLeaf(false).openFile(note);
      } catch (e) {
        status.setText(`Не получилось: ${(e as Error).message}`);
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
