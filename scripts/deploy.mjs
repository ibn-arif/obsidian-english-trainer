// Copies the built plugin into the Obsidian vault.
import { copyFileSync, mkdirSync } from "node:fs";

const target = process.env.VAULT_PLUGIN_DIR ?? "/Applications/Obsidian/.obsidian/plugins/english-trainer";
mkdirSync(target, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) copyFileSync(f, `${target}/${f}`);
console.log(`deployed to ${target}`);
