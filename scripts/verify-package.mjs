import fs from "node:fs";
import path from "node:path";
import { crc32 } from "./zip-utils.mjs";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const packagePath = path.join(root, "dist", `browsevault-${manifest.version}.zip`);
const allowedLocalImportExtensions = new Set([".js", ".mjs"]);
const importPattern = /(?:^|[;\n\r])\s*import\s+(?:[^'"]*?\s+from\s*)?["']([^"']+)["']/gm;
const exportPattern = /(?:^|[;\n\r])\s*export\s+[^'"]*?\s+from\s*["']([^"']+)["']/gm;
const messageReferencePattern = /__MSG_([A-Za-z0-9_@]+?)__/g;
const scriptTagPattern = /<script\b[^>]*>/gi;
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

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isRemoteSpecifier(specifier) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(specifier);
}

function resolvePackagedSpecifier(fromEntry, specifier) {
  if (specifier.startsWith("node:")) {
    throw new Error(`Packaged extension entry must not import Node built-ins: ${fromEntry} imports ${specifier}`);
  }

  if (isRemoteSpecifier(specifier)) {
    throw new Error(`Packaged extension entry must not import remote code: ${fromEntry} imports ${specifier}`);
  }

  if (!isRelativeSpecifier(specifier)) {
    throw new Error(`Packaged extension entry must not use bare imports: ${fromEntry} imports ${specifier}`);
  }

  const [specifierPath] = specifier.split(/[?#]/, 1);
  if (!allowedLocalImportExtensions.has(path.posix.extname(specifierPath))) {
    throw new Error(`Packaged extension import must include a .js or .mjs extension: ${fromEntry} imports ${specifier}`);
  }

  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(fromEntry), specifierPath));
  if (resolved.startsWith("../") || resolved === ".." || path.posix.isAbsolute(resolved)) {
    throw new Error(`Packaged extension import escapes package root: ${fromEntry} imports ${specifier}`);
  }

  return resolved;
}

function collectStaticSpecifiers(source) {
  const specifiers = [];
  for (const pattern of [importPattern, exportPattern]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      specifiers.push(match[1]);
    }
  }
  return specifiers;
}

function collectMessageReferences(value) {
  if (typeof value === "string") {
    return [...value.matchAll(messageReferencePattern)].map((match) => match[1]);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMessageReferences(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((child) => collectMessageReferences(child));
  }

  return [];
}

function collectPackagedUiMessageReferences(entries) {
  const localizationMap = entries.find((entry) => entry.name === "src/features/app-shell/ui/localization-map.js");
  if (!localizationMap) {
    return [];
  }

  const source = localizationMap.data.toString("utf8");
  return [...source.matchAll(/\bkey:\s*"([A-Za-z0-9_@]+)"/g)].map((match) => match[1]);
}

function normalizeExtensionPath(value) {
  return String(value).replace(/^\/+/, "").replaceAll("\\", "/");
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function addManifestPath(paths, field, value) {
  if (typeof value === "string" && value.trim()) {
    paths.push({
      field,
      value: normalizeExtensionPath(value.trim())
    });
  }
}

function addManifestIconPaths(paths, field, icons) {
  if (!icons || typeof icons !== "object") {
    return;
  }

  for (const [size, iconPath] of Object.entries(icons)) {
    addManifestPath(paths, `${field}.${size}`, iconPath);
  }
}

function collectManifestPaths(manifestValue) {
  const paths = [];

  addManifestIconPaths(paths, "icons", manifestValue.icons);
  addManifestIconPaths(paths, "action.default_icon", manifestValue.action?.default_icon);
  addManifestPath(paths, "action.default_popup", manifestValue.action?.default_popup);
  addManifestPath(paths, "background.service_worker", manifestValue.background?.service_worker);
  addManifestPath(paths, "options_page", manifestValue.options_page);
  addManifestPath(paths, "devtools_page", manifestValue.devtools_page);
  addManifestPath(paths, "side_panel.default_path", manifestValue.side_panel?.default_path);
  addManifestPath(paths, "user_scripts.api_script", manifestValue.user_scripts?.api_script);

  if (manifestValue.chrome_url_overrides) {
    for (const [page, pagePath] of Object.entries(manifestValue.chrome_url_overrides)) {
      addManifestPath(paths, `chrome_url_overrides.${page}`, pagePath);
    }
  }

  for (const [index, script] of (manifestValue.content_scripts || []).entries()) {
    for (const [jsIndex, jsPath] of (script.js || []).entries()) {
      addManifestPath(paths, `content_scripts[${index}].js[${jsIndex}]`, jsPath);
    }
    for (const [cssIndex, cssPath] of (script.css || []).entries()) {
      addManifestPath(paths, `content_scripts[${index}].css[${cssIndex}]`, cssPath);
    }
  }

  for (const [index, resource] of (manifestValue.web_accessible_resources || []).entries()) {
    for (const [resourceIndex, resourcePath] of (resource.resources || []).entries()) {
      addManifestPath(paths, `web_accessible_resources[${index}].resources[${resourceIndex}]`, resourcePath);
    }
  }

  for (const [index, ruleResource] of (manifestValue.declarative_net_request?.rule_resources || []).entries()) {
    addManifestPath(paths, `declarative_net_request.rule_resources[${index}].path`, ruleResource.path);
  }

  for (const [index, sandboxPage] of (manifestValue.sandbox?.pages || []).entries()) {
    addManifestPath(paths, `sandbox.pages[${index}]`, sandboxPage);
  }

  return paths;
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

for (const { field, value } of collectManifestPaths(packagedManifest)) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw new Error(`Package manifest ${field} must not point at a remote URL: ${value}`);
  }
  if (value.startsWith("../") || path.posix.isAbsolute(value)) {
    throw new Error(`Package manifest ${field} escapes package root: ${value}`);
  }

  if (value.includes("*")) {
    const pattern = wildcardToRegExp(value);
    assert(entryNames.some((entryName) => pattern.test(entryName)), `Package manifest ${field} wildcard matches no entries: ${value}`);
  } else {
    assert(entrySet.has(value), `Package manifest ${field} references missing entry: ${value}`);
  }
}

const localeEntryName = `_locales/${packagedManifest.default_locale}/messages.json`;
assert(entrySet.has(localeEntryName), `Package missing default locale messages: ${localeEntryName}`);
const packagedLocaleMessages = JSON.parse(entries.find((entry) => entry.name === localeEntryName).data.toString("utf8"));
const packagedLocaleReferences = new Set(collectMessageReferences(packagedManifest));
for (const key of collectPackagedUiMessageReferences(entries)) {
  packagedLocaleReferences.add(key);
}
for (const key of packagedLocaleReferences) {
  const record = packagedLocaleMessages[key];
  assert(record, `Package locale missing key: ${key}`);
  assert(typeof record.message === "string" && record.message.trim(), `Package locale key has empty message: ${key}`);
}
for (const key of Object.keys(packagedLocaleMessages)) {
  assert(packagedLocaleReferences.has(key), `Package locale has unused key: ${key}`);
}

for (const entry of entries) {
  if (!/\.(js|html|css)$/i.test(entry.name)) {
    continue;
  }

  const source = entry.data.toString("utf8");
  for (const { pattern, message } of forbiddenPackagedSourcePatterns) {
    assert(!pattern.test(source), `Unexpected packaged ${message} in ${entry.name}`);
  }

  if (/\.m?js$/i.test(entry.name)) {
    for (const specifier of collectStaticSpecifiers(source)) {
      const resolved = resolvePackagedSpecifier(entry.name, specifier);
      assert(entrySet.has(resolved), `Package import missing target: ${entry.name} imports ${specifier}`);
    }
  }

  if (/\.html$/i.test(entry.name)) {
    for (const match of source.matchAll(scriptTagPattern)) {
      const tag = match[0];
      if (!/\btype\s*=\s*["']module["']/i.test(tag)) {
        continue;
      }

      const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (!srcMatch) {
        continue;
      }

      const resolved = resolvePackagedSpecifier(entry.name, srcMatch[1]);
      assert(entrySet.has(resolved), `Package module script missing target: ${entry.name} references ${srcMatch[1]}`);
    }
  }
}

console.log(`Verified package ${path.relative(root, packagePath)} with ${entries.length} files.`);
