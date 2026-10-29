import { Editor, MarkdownView, Plugin, TAbstractFile, TFile, debounce } from "obsidian";
import { DEFAULT_SETTINGS, SettingsTab, type Settings } from "./settings";
import { AddWordModal } from "./ui/AddWordModal";
import { generalDict, rebuildIndex, type DictRef } from "./vault/dictionary";

export default class EnglishTrainerPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addSettingTab(new SettingsTab(this.app, this));

    this.addRibbonIcon("languages", "Добавить английское слово", () => this.openAddWord());
    this.addCommand({ id: "add-word", name: "Добавить слово", callback: () => this.openAddWord() });
    this.addCommand({
      id: "add-selection-general",
      name: "Добавить выделенное в общий словарь",
      editorCallback: (editor: Editor) => this.openAddWord(editor.getSelection()),
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const sel = editor.getSelection().trim();
        if (!sel || sel.length > 60) return;
        menu.addItem((i) => i.setTitle(`В словарь: «${sel}»`).setIcon("languages").onClick(() => this.openAddWord(sel)));
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

  /** Dictionary a card path belongs to, if any. */
  dictForPath(path: string): DictRef | null {
    const g = generalDict(this.settings);
    if (path.startsWith(g.folder + "/")) return g;
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
