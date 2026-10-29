import { Editor, MarkdownView, Notice, Plugin, TAbstractFile, TFile, debounce } from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { AddWordModal } from "./ui/AddWordModal";
import { ImportBookModal } from "./ui/ImportBookModal";
import { QuizView, VIEW_TYPE_QUIZ } from "./ui/QuizView";
import { bookOfPath, captureFromEditor, captureFromPdf } from "./books/capture";
import { bookDict, generalDict, rebuildIndex, type DictRef } from "./vault/dictionary";

export default class EnglishTrainerPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerView(VIEW_TYPE_QUIZ, (leaf) => new QuizView(leaf, () => this.settings));
    this.addRibbonIcon("languages", "Добавить английское слово", () => this.openAddWord());
    this.addRibbonIcon("graduation-cap", "Заучивание слов", () => void this.openQuiz());
    this.addRibbonIcon("book-plus", "Загрузить книгу (EPUB/FB2/PDF)", () => new ImportBookModal(this.app, this.settings).open());
    this.addCommand({ id: "open-quiz", name: "Заучивание", callback: () => void this.openQuiz() });
    this.addCommand({ id: "add-word", name: "Добавить слово", callback: () => this.openAddWord() });
    this.addCommand({ id: "import-book", name: "Загрузить книгу (EPUB/FB2/PDF)", callback: () => new ImportBookModal(this.app, this.settings).open() });
    this.addCommand({
      id: "add-selection-general",
      name: "Добавить выделенное в общий словарь",
      editorCallback: (editor: Editor) => this.openAddWord(editor.getSelection()),
    });
    this.addCommand({
      id: "add-selection-book",
      name: "Добавить выделенное в словарь книги",
      callback: () => this.captureFromBook(),
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, info) => {
        const sel = editor.getSelection().trim();
        if (!sel || sel.length > 60) return;
        const file = info.file;
        if (file && bookOfPath(this.settings.booksFolder, file.path)) {
          menu.addItem((i) => i.setTitle(`В словарь книги: «${sel}»`).setIcon("book-open").onClick(() => captureFromEditor(this.app, this.settings, editor, file)));
        }
        menu.addItem((i) => i.setTitle(`В общий словарь: «${sel}»`).setIcon("languages").onClick(() => this.openAddWord(sel)));
      }),
    );

    // keep dictionary indexes in sync when cards are deleted or renamed
    const pending = new Map<string, DictRef>();
    const flush = debounce(async () => {
      const refs = [...pending.values()];
      pending.clear();
      for (const d of refs) await rebuildIndex(this.app, d);
    }, 1000, true);
    const touched = (f: TAbstractFile, oldPath?: string) => {
      for (const p of [f.path, oldPath ?? ""]) {
        const d = this.dictForPath(p);
        if (d && f instanceof TFile) pending.set(d.index, d);
      }
      if (pending.size) flush();
    };
    this.registerEvent(this.app.vault.on("delete", (f) => touched(f)));
    this.registerEvent(this.app.vault.on("rename", (f, old) => touched(f, old)));
  }

  openAddWord(word?: string, dict: DictRef = generalDict(this.settings)): void {
    new AddWordModal(this.app, { word: word?.trim() || undefined, dict }).open();
  }

  async openQuiz(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_QUIZ)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE_QUIZ, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  captureFromBook(): void {
    const md = this.activeMarkdown();
    if (md?.file) return captureFromEditor(this.app, this.settings, md.editor, md.file);
    const file = this.app.workspace.getActiveFile();
    if (file?.extension === "pdf") return captureFromPdf(this.app, this.settings, file);
    new Notice("Откройте главу или PDF книги и выделите слово");
  }

  /** Dictionary a card path belongs to, if any. */
  dictForPath(path: string): DictRef | null {
    const g = generalDict(this.settings);
    if (path.startsWith(g.folder + "/")) return g;
    const book = bookOfPath(this.settings.booksFolder, path);
    if (book) {
      const d = bookDict(this.settings, book);
      if (path.startsWith(d.folder + "/")) return d;
    }
    return null;
  }

  activeMarkdown(): MarkdownView | null {
    return this.app.workspace.getActiveViewOfType(MarkdownView);
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
