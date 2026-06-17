import fs from "node:fs";
import path from "node:path";
import { crc32 } from "./zip-utils.mjs";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packagePath = path.join(root, "dist", `browsevault-${manifest.version}.zip`);
const requiredEntries = [
  "manifest.json",
  "_locales/en/messages.json",
  "README.md",
  "PRIVACY.md",
  "LICENSE",
  "assets/icons/icon16.png",
  "assets/icons/icon32.png",
  "assets/icons/icon48.png",
  "assets/icons/icon128.png",
  "src/app.html",
  "src/app.css",
  "src/app.js",
  "src/background.js",
  "src/storage.js",
  "src/query.js",
  "src/browser-memory.js",
  "src/export-format.js"
];

const disallowedEntryPatterns = [
  /^docs\//,
  /^test\//,
  /^scripts\//,
  /^store\//,
  /^store-listing\//,
  /^dist\//,
  /^node_modules\//,
  /^\.git\//,
  /\.map$/i,
  /\.test\.js$/i,
  /^src\/.*\.md$/i
];

const forbiddenPackagedSourcePatterns = [
  { pattern: /https?:\/\//i, message: "remote URL" },
  { pattern: /\bfetch\s*\(/, message: "fetch network call" },
  { pattern: /\bXMLHttpRequest\b/, message: "XMLHttpRequest network API" },
  { pattern: /\bWebSocket\b/, message: "WebSocket network API" },
  { pattern: /\bEventSource\b/, message: "EventSource network API" },
  { pattern: /\bnavigator\.sendBeacon\b/, message: "sendBeacon network API" },
  { pattern: /\bimportScripts\s*\(/, message: "importScripts remote-code loader" },
  { pattern: /\beval\s*\(/, message: "eval remote-code risk" },
  { pattern: /\bnew\s+Function\s*\(/, message: "Function constructor remote-code risk" },
  { pattern: /\bimport\s*\(/, message: "dynamic import remote-code risk" }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readZipEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 4 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }
    assert(signature === 0x04034b50, `Unexpected ZIP signature at offset ${offset}.`);

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const expectedCrc = buffer.readUInt32LE(offset + 14);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const data = buffer.subarray(dataStart, dataEnd);

    assert(compressionMethod === 0, `Unexpected compressed ZIP entry: ${name}`);
    assert(data.length === uncompressedSize, `ZIP size mismatch for ${name}.`);
    assert(crc32(data) === expectedCrc, `ZIP CRC mismatch for ${name}.`);

    entries.push({ data, name });
    offset = dataEnd;
  }

  return entries;
}

assert(fs.existsSync(packagePath), `Missing package: ${packagePath}`);

const entries = readZipEntries(fs.readFileSync(packagePath));
const entryNames = entries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right));
const entrySet = new Set(entryNames);

assert(entries.length > 0, "Package ZIP cannot be empty.");
for (const required of requiredEntries) {
  assert(entrySet.has(required), `Package missing required entry: ${required}`);
}

for (const entryName of entryNames) {
  assert(
    entryName === "manifest.json"
      || entryName === "README.md"
      || entryName === "PRIVACY.md"
      || entryName === "LICENSE"
      || entryName.startsWith("_locales/")
      || entryName.startsWith("assets/")
      || entryName.startsWith("src/"),
    `Unexpected package entry root: ${entryName}`
  );
  for (const pattern of disallowedEntryPatterns) {
    assert(!pattern.test(entryName), `Disallowed package entry: ${entryName}`);
  }
}

const packagedManifest = JSON.parse(entries.find((entry) => entry.name === "manifest.json").data.toString("utf8"));
assert(packagedManifest.manifest_version === 3, "Packaged manifest must use MV3.");
assert(packagedManifest.default_locale === "en", "Packaged manifest must include default_locale.");
assert(packagedManifest.background?.service_worker === "src/background.js", "Packaged manifest points to the wrong background worker.");
assert(!packagedManifest.host_permissions?.length, "Packaged manifest must not request host permissions.");
assert(!packagedManifest.content_scripts?.length, "Packaged manifest must not include content scripts.");
assert(!packagedManifest.chrome_url_overrides, "Packaged manifest must not replace Chrome pages.");

for (const entry of entries) {
  if (!/\.(js|html|css)$/i.test(entry.name)) {
    continue;
  }

  const source = entry.data.toString("utf8");
  for (const { pattern, message } of forbiddenPackagedSourcePatterns) {
    assert(!pattern.test(source), `Unexpected packaged ${message} in ${entry.name}`);
  }
}

console.log(`Verified package ${path.relative(root, packagePath)} with ${entries.length} files.`);
