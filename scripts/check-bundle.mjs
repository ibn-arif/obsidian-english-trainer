// Fails if the built main.js contains patterns the Obsidian directory flags
// (script injection, eval / new Function). Run after `npm run build`.
import { readFileSync } from "node:fs";

const code = readFileSync("main.js", "utf8");
const forbidden = [
  [/createElement\(\s*["']script["']\s*\)/g, "createElement('script')"],
  [/\bnew Function\s*\(/g, "new Function()"],
  [/(?<![.\w$])eval\s*\(/g, "eval()"],
];
let failed = false;
for (const [re, name] of forbidden) {
  const n = (code.match(re) ?? []).length;
  if (n) {
    console.error(`main.js contains ${name} × ${n}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("bundle check: ok");
