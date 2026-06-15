import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "manifest.json",
  "README.md",
  "PRIVACY.md",
  "src/background.js",
  "src/storage.js",
  "src/query.js",
  "src/browser-memory.js",
  "src/app.html",
  "src/app.css",
  "src/app.js",
  "store/listing.md",
  "docs/README.md"
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
}

const manifest = readJson("manifest.json");
assert(manifest.manifest_version === 3, "Manifest must use version 3.");
assert(manifest.name === "BrowseVault: History Search & Backup", "Unexpected extension name.");
assert(manifest.short_name === "BrowseVault", "Unexpected short_name.");
assert(manifest.description.length <= 132, "Manifest description should stay within Chrome Web Store summary length.");
assert(manifest.background?.type === "module", "Background script should be an ES module.");

for (const permission of ["bookmarks", "downloads", "history", "sessions", "storage", "tabs"]) {
  assert(manifest.permissions.includes(permission), `Missing permission: ${permission}`);
}
assert(manifest.commands?.["open-browsevault"], "Missing open-browsevault command.");

const packageJson = readJson("package.json");
assert(packageJson.keywords.includes("browser-history"), "Missing browser-history keyword.");
assert(packageJson.keywords.includes("history-backup"), "Missing history-backup keyword.");

const appHtml = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
assert(appHtml.includes('type="module"'), "App script should load as a module.");

const sourceFiles = ["src/background.js", "src/storage.js", "src/query.js", "src/browser-memory.js", "src/app.js", "src/app.html", "src/app.css"];
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/https?:\/\//i.test(source), `Unexpected remote URL in ${file}`);
}

console.log("BrowseVault extension scaffold validated.");
