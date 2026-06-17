import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const messageReferencePattern = /__MSG_([A-Za-z0-9_@]+?)__/g;
const sourceRoots = ["src", "store-listing", "store", "docs", "README.md", "PRIVACY.md", "CHANGELOG.md"];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function collectFiles(entry) {
  const fullPath = path.join(root, entry);
  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return [entry];
  }

  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .flatMap((child) => collectFiles(path.join(entry, child.name)));
}

function collectManifestReferences(value, location = "manifest") {
  const references = [];
  if (typeof value === "string") {
    for (const match of value.matchAll(messageReferencePattern)) {
      references.push({
        key: match[1],
        location
      });
    }
    return references;
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectManifestReferences(item, `${location}[${index}]`));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => collectManifestReferences(child, `${location}.${key}`));
  }

  return references;
}

const manifest = readJson("manifest.json");
if (!manifest.default_locale) {
  fail("manifest.json must declare default_locale when using localized messages.");
}

const localePath = path.join("_locales", manifest.default_locale || "", "messages.json");
if (!fs.existsSync(path.join(root, localePath))) {
  fail(`Missing default locale messages file: ${localePath}`);
  process.exit(process.exitCode || 1);
}

const messages = readJson(localePath);
const references = collectManifestReferences(manifest);
const referencedKeys = new Set(references.map((reference) => reference.key));

for (const { key, location } of references) {
  const record = messages[key];
  if (!record) {
    fail(`${location}: missing locale key ${key} in ${localePath}.`);
    continue;
  }

  if (typeof record.message !== "string" || !record.message.trim()) {
    fail(`${localePath}: locale key ${key} must have a non-empty message.`);
  }

  if (typeof record.description !== "string" || !record.description.trim()) {
    fail(`${localePath}: locale key ${key} must explain its use with a description.`);
  }
}

for (const key of Object.keys(messages)) {
  if (!referencedKeys.has(key)) {
    fail(`${localePath}: unused locale key ${key}.`);
  }
}

for (const file of sourceRoots.flatMap((entry) => collectFiles(entry))) {
  if (file === "manifest.json" || file.startsWith("_locales")) {
    continue;
  }

  if (!/\.(css|html|js|json|md|mjs|txt)$/i.test(file)) {
    continue;
  }

  const source = fs.readFileSync(path.join(root, file), "utf8");
  if (messageReferencePattern.test(source)) {
    fail(`${file}: __MSG_*__ references are only supported in manifest.json for this extension.`);
  }
  messageReferencePattern.lastIndex = 0;
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Locale coverage checked ${references.length} manifest references against ${localePath}.`);
