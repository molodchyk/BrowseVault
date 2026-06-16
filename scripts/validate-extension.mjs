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
  "src/export-format.js",
  "src/app.html",
  "src/app.css",
  "src/app.js",
  "store/listing.md",
  "store-listing/chrome-web-store/README.md",
  "store-listing/chrome-web-store/listing/en.md",
  "store-listing/chrome-web-store/media/icon-128.png",
  "store-listing/chrome-web-store/media/promo/.gitkeep",
  "store-listing/chrome-web-store/media/screenshots/.gitkeep",
  "docs/README.md",
  "docs/chrome-web-store-additional-fields.md",
  "docs/chrome-web-store-category.md",
  "docs/chrome-web-store-privacy-form.md",
  "assets/icons/icon16.png",
  "assets/icons/icon32.png",
  "assets/icons/icon48.png",
  "assets/icons/icon128.png",
  "scripts/check-syntax.mjs",
  "scripts/generate-icons.mjs",
  "scripts/package-extension.mjs",
  "scripts/zip-utils.mjs"
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function collectFilesByExtension(entry, extensions) {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    return extensions.has(path.extname(entry)) ? [entry] : [];
  }

  return fs
    .readdirSync(fullPath)
    .flatMap((child) => collectFilesByExtension(path.join(entry, child), extensions));
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
for (const size of ["16", "32", "48", "128"]) {
  assert(manifest.icons?.[size] === `assets/icons/icon${size}.png`, `Missing manifest icon ${size}.`);
  assert(manifest.action?.default_icon?.[size] === `assets/icons/icon${size}.png`, `Missing action icon ${size}.`);
}

for (const permission of ["bookmarks", "downloads", "history", "sessions", "storage", "tabs"]) {
  assert(manifest.permissions.includes(permission), `Missing permission: ${permission}`);
}
assert(manifest.commands?.["open-browsevault"], "Missing open-browsevault command.");

const packageJson = readJson("package.json");
assert(packageJson.keywords.includes("browser-history"), "Missing browser-history keyword.");
assert(packageJson.keywords.includes("history-backup"), "Missing history-backup keyword.");
assert(packageJson.scripts.icons, "Missing icons script.");
assert(packageJson.scripts.package, "Missing package script.");

for (const size of [16, 32, 48, 128]) {
  const icon = fs.readFileSync(path.join(root, "assets", "icons", `icon${size}.png`));
  assert(icon[0] === 137 && icon[1] === 80 && icon[2] === 78 && icon[3] === 71, `Icon ${size} is not a PNG.`);
  assert(icon.readUInt32BE(16) === size && icon.readUInt32BE(20) === size, `Icon ${size} has wrong dimensions.`);
}

const storePilotIcon = fs.readFileSync(path.join(root, "store-listing", "chrome-web-store", "media", "icon-128.png"));
assert(
  storePilotIcon[0] === 137 && storePilotIcon[1] === 80 && storePilotIcon[2] === 78 && storePilotIcon[3] === 71,
  "StorePilot icon is not a PNG."
);
assert(
  storePilotIcon.readUInt32BE(16) === 128 && storePilotIcon.readUInt32BE(20) === 128,
  "StorePilot icon must be 128 x 128."
);

const storePilotListing = fs.readFileSync(path.join(root, "store-listing", "chrome-web-store", "listing", "en.md"), "utf8").trim();
assert(storePilotListing.length > 0, "StorePilot English detailed description cannot be empty.");
assert(!/^#/m.test(storePilotListing), "StorePilot listing/en.md should not include Markdown headings.");
assert(
  !/^\s*(Name|Summary|Short Description|Description|Detailed Description)\s*:/im.test(storePilotListing),
  "StorePilot listing/en.md should not include dashboard field labels."
);

const storePilotCategory = fs.readFileSync(path.join(root, "docs", "chrome-web-store-category.md"), "utf8");
assert(/Selected category:\s*\S/i.test(storePilotCategory), "Chrome Web Store category document needs a selected category.");

const storePilotAdditionalFields = fs.readFileSync(path.join(root, "docs", "chrome-web-store-additional-fields.md"), "utf8");
for (const key of ["official_url", "homepage_url", "support_url", "mature_content"]) {
  assert(storePilotAdditionalFields.includes(`${key}:`), `Missing StorePilot additional field key: ${key}`);
}

const storePilotPrivacy = fs.readFileSync(path.join(root, "docs", "chrome-web-store-privacy-form.md"), "utf8");
for (const key of [
  "single_purpose",
  "remote_code",
  "privacy_policy_url",
  "host_permission",
  "permission.bookmarks",
  "permission.downloads",
  "permission.history",
  "permission.sessions",
  "permission.storage",
  "permission.tabs",
  "data_usage.personally_identifiable_information",
  "data_usage.web_history",
  "data_usage.website_content",
  "certification.no_sell_or_transfer",
  "certification.no_unrelated_use",
  "certification.no_creditworthiness"
]) {
  assert(storePilotPrivacy.includes(`${key}:`), `Missing StorePilot privacy key: ${key}`);
}

const appHtml = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
assert(appHtml.includes('type="module"'), "App script should load as a module.");

const sourceFiles = collectFilesByExtension("src", new Set([".js", ".html", ".css"]));
for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  assert(!/https?:\/\//i.test(source), `Unexpected remote URL in ${file}`);
}

console.log("BrowseVault extension validated.");
