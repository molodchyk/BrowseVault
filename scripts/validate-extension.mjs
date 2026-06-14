import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "manifest.json",
  "README.md",
  "PRIVACY.md",
  "src/background.js",
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

for (const permission of ["history", "storage", "tabs"]) {
  assert(manifest.permissions.includes(permission), `Missing permission: ${permission}`);
}

const packageJson = readJson("package.json");
assert(packageJson.keywords.includes("browser-history"), "Missing browser-history keyword.");
assert(packageJson.keywords.includes("history-backup"), "Missing history-backup keyword.");

const sourceFiles = ["src/background.js", "src/app.js", "src/app.html", "src/app.css"];
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/https?:\/\//i.test(source), `Unexpected remote URL in ${file}`);
}

console.log("BrowseVault extension scaffold validated.");

