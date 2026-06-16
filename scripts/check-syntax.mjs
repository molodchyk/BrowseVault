import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const roots = ["src", "scripts"];

function collectJavaScriptFiles(entry) {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    return /\.(mjs|js)$/i.test(entry) ? [entry] : [];
  }

  return fs
    .readdirSync(fullPath)
    .flatMap((child) => collectJavaScriptFiles(path.join(entry, child)));
}

const files = roots
  .flatMap((entry) => collectJavaScriptFiles(entry))
  .sort((a, b) => a.localeCompare(b));

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`Syntax checked ${files.length} files.`);
