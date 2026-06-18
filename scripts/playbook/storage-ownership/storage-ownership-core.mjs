import fs from "node:fs";
import path from "node:path";

function collectMatches(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

export function collectStorageContracts(root) {
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  const metaFiles = [
    "src/storage.js",
    "src/background.js",
    "src/features/activity-log/core/activity-log.js",
    "src/features/backup-import/ui/actions.js",
    "src/features/background-runtime/background/chrome-history-removal.js",
    "src/features/background-runtime/background/chrome-history-sync.js"
  ];
  const localStorageFiles = [
    "src/features/app-shell/core/vault-invalidation.js",
    "src/features/display-preferences/core/preferences.js",
    "src/platform/chrome/storage.js"
  ];
  const metaKeys = new Set();
  const localKeys = new Set();

  for (const file of metaFiles) {
    const source = read(file);
    for (const key of collectMatches(source, /\b(?:deps\.)?setMeta\(\s*"([^"]+)"/g)) metaKeys.add(key);
    for (const key of collectMatches(source, /\bkey:\s*"([^"]+)"/g)) metaKeys.add(key);
    for (const key of collectMatches(source, /\b(?:export\s+)?const\s+[A-Z0-9_]*META\b\s*=\s*"([^"]+)"/g)) {
      metaKeys.add(key);
    }
  }

  for (const file of localStorageFiles) {
    const source = read(file);
    for (const key of collectMatches(source, /\b(?:export\s+)?const\s+[A-Z0-9_]*KEY\b\s*=\s*"([^"]+)"/g)) {
      localKeys.add(key);
    }
  }

  return {
    localKeys: [...localKeys].sort(),
    metaKeys: [...metaKeys].sort()
  };
}
