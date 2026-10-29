// Minimal stand-ins for the Obsidian API so pure modules can be unit-tested.
export async function requestUrl(): Promise<never> {
  throw new Error("requestUrl is not available in tests");
}
export class Notice {
  constructor(public message: string) {}
}
export function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim();
}
export class Plugin {}
export class Modal {}
export class ItemView {}
export class PluginSettingTab {}
export class Setting {}
export class TFile {}
export class TFolder {}
export function normalizePath(p: string): string {
  return p.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}
