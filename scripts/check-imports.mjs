import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["src", "scripts", "test"];
const allowedLocalExtensions = new Set([".js", ".mjs"]);
const importPattern = /(?:^|[;\n\r])\s*import\s+(?:[^'"]*?\s+from\s*)?["']([^"']+)["']/gm;
const exportPattern = /(?:^|[;\n\r])\s*export\s+[^'"]*?\s+from\s*["']([^"']+)["']/gm;
const scriptTagPattern = /<script\b[^>]*>/gi;

function collectFiles(entry, extensions) {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    return extensions.has(path.extname(entry)) ? [entry] : [];
  }

  return fs
    .readdirSync(fullPath)
    .flatMap((child) => collectFiles(path.join(entry, child), extensions));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function isRelativeSpecifier(specifier) {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

function isRemoteSpecifier(specifier) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(specifier);
}

function resolveLocalSpecifier(fromFile, specifier) {
  const [specifierPath] = specifier.split(/[?#]/, 1);
  if (!allowedLocalExtensions.has(path.extname(specifierPath))) {
    fail(`${fromFile}: relative import must include a .js or .mjs extension: ${specifier}`);
    return;
  }

  const resolved = path.resolve(root, path.dirname(fromFile), specifierPath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail(`${fromFile}: relative import escapes the repository: ${specifier}`);
    return;
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    fail(`${fromFile}: unresolved import: ${specifier}`);
  }
}

function checkSpecifier(fromFile, specifier) {
  if (specifier.startsWith("node:")) {
    return;
  }

  if (isRemoteSpecifier(specifier)) {
    fail(`${fromFile}: remote imports are not allowed: ${specifier}`);
    return;
  }

  if (!isRelativeSpecifier(specifier)) {
    fail(`${fromFile}: bare imports are not allowed in this extension repo: ${specifier}`);
    return;
  }

  resolveLocalSpecifier(fromFile, specifier);
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

function checkJavaScriptFile(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const specifier of collectStaticSpecifiers(source)) {
    checkSpecifier(file, specifier);
  }
}

function checkHtmlFile(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of source.matchAll(scriptTagPattern)) {
    const tag = match[0];
    if (!/\btype\s*=\s*["']module["']/i.test(tag)) {
      continue;
    }

    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      checkSpecifier(file, srcMatch[1]);
    }
  }
}

const scriptFiles = roots
  .flatMap((entry) => collectFiles(entry, new Set([".js", ".mjs"])))
  .sort((left, right) => left.localeCompare(right));
const htmlFiles = collectFiles("src", new Set([".html"]))
  .sort((left, right) => left.localeCompare(right));

for (const file of scriptFiles) {
  checkJavaScriptFile(file);
}

for (const file of htmlFiles) {
  checkHtmlFile(file);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Static imports checked ${scriptFiles.length} scripts and ${htmlFiles.length} HTML files.`);
