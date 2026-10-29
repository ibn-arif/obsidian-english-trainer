import { MarkdownView, Notice, Plugin, TAbstractFile, TFile, debounce } from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { AddWordModal } from "./ui/AddWordModal";
import { ImportBookModal } from "./ui/ImportBookModal";
import { QuizView, VIEW_TYPE_QUIZ } from "./ui/QuizView";
import { bookOfPath } from "./books/capture";
import { captureSnapshot, takeSnapshot, type Snapshot } from "./books/selection";
import { SelectionButton } from "./ui/SelectionButton";
import { bookDict, generalDict, rebuildIndex, type DictRef } from "./vault/dictionary";

export default class EnglishTrainerPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private lastSnapshot: Snapshot | null = null;
  private selectionButton: SelectionButton | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerView(VIEW_TYPE_QUIZ, (leaf) => new QuizView(leaf, () => this.settings));
    this.addRibbonIcon("languages", "Добавить английское слово", () => this.openAddWord());
    this.addRibbonIcon("graduation-cap", "Заучивание слов", () => void this.openQuiz());
    this.addRibbonIcon("book-plus", "Загрузить книгу", () => new ImportBookModal(this.app, this.settings).open());
    this.addCommand({ id: "open-quiz", name: "Заучивание", callback: () => void this.openQuiz() });
    this.addCommand({ id: "add-word", name: "Добавить слово", callback: () => this.openAddWord() });
    this.addCommand({ id: "import-book", name: "Загрузить книгу", callback: () => new ImportBookModal(this.app, this.settings).open() });
    this.addCommand({
      id: "add-selection-general",
      name: "Добавить выделенное в общий словарь",
      callback: () => {
        const snap = this.currentSnapshot();
        if (snap) this.openAddWord(snap.word);
        else new Notice("Сначала выделите слово");
      },
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
          const snap = this.currentSnapshot();
          if (snap) menu.addItem((i) => i.setTitle(`В словарь книги: «${sel}»`).setIcon("book-open").onClick(() => void captureSnapshot(this.app, this.settings, snap)));
        }
        menu.addItem((i) => i.setTitle(`В общий словарь: «${sel}»`).setIcon("languages").onClick(() => this.openAddWord(sel)));
      }),
    );

    // floating «+ в словарь» button next to any selection in a note or PDF
    const button = new SelectionButton(() => {
      const snap = this.lastSnapshot;
      button.hide();
      if (snap) void captureSnapshot(this.app, this.settings, snap);
    });
    this.selectionButton = button;
    const onSelection = debounce(() => {
      const snap = takeSnapshot(this.app);
      if (!snap?.rect) return button.hide();
      this.lastSnapshot = snap;
      const inBook = bookOfPath(this.settings.booksFolder, snap.file.path);
      button.show(snap.rect, inBook ? "+ в словарь книги" : "+ в словарь");
    }, 250, true);
    this.registerDomEvent(document, "selectionchange", onSelection);
    this.registerDomEvent(document, "scroll", () => button.hide(), { capture: true });

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
    await this.app.workspace.revealLeaf(leaf);
  }

  captureFromBook(): void {
    const snap = this.currentSnapshot();
    if (!snap) return void new Notice("Сначала выделите слово в книге");
    if (!bookOfPath(this.settings.booksFolder, snap.file.path)) return void new Notice("Это не книга из папки «Книги» — слово можно добавить в общий словарь");
    void captureSnapshot(this.app, this.settings, snap);
  }

  /** The live selection, or the one remembered within the last minute (palettes and menus clear selections). */
  currentSnapshot(): Snapshot | null {
    const live = takeSnapshot(this.app);
    if (live) return live;
    return this.lastSnapshot && Date.now() - this.lastSnapshot.at < 60_000 ? this.lastSnapshot : null;
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

  onunload(): void {
    this.selectionButton?.destroy();
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<Settings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
