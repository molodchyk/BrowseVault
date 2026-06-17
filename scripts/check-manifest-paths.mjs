import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = "manifest.json";

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function normalizeExtensionPath(value) {
  return String(value).replace(/^\/+/, "").replaceAll("\\", "/");
}

function isRemotePath(value) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

function isLocaleMessage(value) {
  return /^__MSG_[A-Za-z0-9_@]+__$/.test(value);
}

function collectFiles(entry = ".") {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return [normalizeExtensionPath(entry)];
  }

  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .filter((child) => ![".git", "dist", "node_modules"].includes(child.name))
    .flatMap((child) => collectFiles(path.join(entry, child.name)));
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", "[^/]*");
  return new RegExp(`^${escaped}$`);
}

function addPath(paths, field, value) {
  if (typeof value === "string" && value.trim()) {
    paths.push({
      field,
      value: normalizeExtensionPath(value.trim())
    });
  }
}

function addIconPaths(paths, field, icons) {
  if (!icons || typeof icons !== "object") {
    return;
  }

  for (const [size, iconPath] of Object.entries(icons)) {
    addPath(paths, `${field}.${size}`, iconPath);
  }
}

function collectManifestPaths(manifest) {
  const paths = [];

  addIconPaths(paths, "icons", manifest.icons);
  addIconPaths(paths, "action.default_icon", manifest.action?.default_icon);
  addPath(paths, "action.default_popup", manifest.action?.default_popup);
  addPath(paths, "background.service_worker", manifest.background?.service_worker);
  addPath(paths, "options_page", manifest.options_page);
  addPath(paths, "devtools_page", manifest.devtools_page);
  addPath(paths, "side_panel.default_path", manifest.side_panel?.default_path);
  addPath(paths, "user_scripts.api_script", manifest.user_scripts?.api_script);

  if (manifest.chrome_url_overrides) {
    for (const [page, pagePath] of Object.entries(manifest.chrome_url_overrides)) {
      addPath(paths, `chrome_url_overrides.${page}`, pagePath);
    }
  }

  for (const [index, script] of (manifest.content_scripts || []).entries()) {
    for (const [jsIndex, jsPath] of (script.js || []).entries()) {
      addPath(paths, `content_scripts[${index}].js[${jsIndex}]`, jsPath);
    }
    for (const [cssIndex, cssPath] of (script.css || []).entries()) {
      addPath(paths, `content_scripts[${index}].css[${cssIndex}]`, cssPath);
    }
  }

  for (const [index, resource] of (manifest.web_accessible_resources || []).entries()) {
    for (const [resourceIndex, resourcePath] of (resource.resources || []).entries()) {
      addPath(paths, `web_accessible_resources[${index}].resources[${resourceIndex}]`, resourcePath);
    }
  }

  for (const [index, ruleResource] of (manifest.declarative_net_request?.rule_resources || []).entries()) {
    addPath(paths, `declarative_net_request.rule_resources[${index}].path`, ruleResource.path);
  }

  for (const [index, sandboxPage] of (manifest.sandbox?.pages || []).entries()) {
    addPath(paths, `sandbox.pages[${index}]`, sandboxPage);
  }

  return paths;
}

function checkManifestPath(pathReference, allFiles) {
  const { field, value } = pathReference;
  if (isRemotePath(value)) {
    fail(`${manifestPath} ${field}: remote extension paths are not allowed: ${value}`);
    return;
  }

  if (isLocaleMessage(value)) {
    fail(`${manifestPath} ${field}: localized message tokens are not valid extension file paths: ${value}`);
    return;
  }

  if (value.startsWith("../") || path.posix.isAbsolute(value)) {
    fail(`${manifestPath} ${field}: extension path escapes package root: ${value}`);
    return;
  }

  if (value.includes("*")) {
    const pattern = wildcardToRegExp(value);
    if (!allFiles.some((file) => pattern.test(file))) {
      fail(`${manifestPath} ${field}: wildcard path matches no files: ${value}`);
    }
    return;
  }

  const fullPath = path.join(root, value);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    fail(`${manifestPath} ${field}: referenced file does not exist: ${value}`);
  }
}

const manifest = readJson(manifestPath);
const manifestPaths = collectManifestPaths(manifest);
const allFiles = collectFiles();

for (const pathReference of manifestPaths) {
  checkManifestPath(pathReference, allFiles);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Manifest paths checked ${manifestPaths.length} references.`);
