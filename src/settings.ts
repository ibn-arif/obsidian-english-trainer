import { App, Plugin, PluginSettingTab, Setting } from "obsidian";

export interface Settings {
  dictFolder: string;
  dictIndex: string;
  booksFolder: string;
  sessionSize: number;
  maxNew: number;
}

export const DEFAULT_SETTINGS: Settings = {
  dictFolder: "English/Словарь",
  dictIndex: "English/Словарь.md",
  booksFolder: "English/Книги",
  sessionSize: 15,
  maxNew: 10,
};

interface SettingsHost extends Plugin {
  settings: Settings;
  saveSettings(): Promise<void>;
}

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private host: SettingsHost) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.host.settings;
    const text = (name: string, desc: string, key: "dictFolder" | "dictIndex" | "booksFolder") =>
      new Setting(containerEl).setName(name).setDesc(desc).addText((t) =>
        t.setValue(s[key]).onChange(async (v) => {
          s[key] = v.trim() || DEFAULT_SETTINGS[key];
          await this.host.saveSettings();
        }),
      );
    text("Папка общего словаря", "Здесь создаются карточки слов", "dictFolder");
    text("Оглавление общего словаря", "Заметка со списком всех слов", "dictIndex");
    text("Папка книг", "Каждая книга — отдельная папка внутри", "booksFolder");
    new Setting(containerEl).setName("Слов в сессии").setDesc("От 10 до 20").addSlider((sl) =>
      sl.setLimits(10, 20, 1).setValue(s.sessionSize).onChange(async (v) => {
        s.sessionSize = v;
        await this.host.saveSettings();
      }),
    );
    new Setting(containerEl).setName("Новых слов за сессию").setDesc("Максимум новых слов в одной сессии").addSlider((sl) =>
      sl.setLimits(1, 20, 1).setValue(s.maxNew).onChange(async (v) => {
        s.maxNew = v;
        await this.host.saveSettings();
      }),
    );
  }
}
