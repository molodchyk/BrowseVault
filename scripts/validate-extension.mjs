import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "manifest.json",
  "_locales/en/messages.json",
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "src/background.js",
  "src/storage.js",
  "src/query.js",
  "src/browser-memory.js",
  "src/export-format.js",
  "src/app.html",
  "src/app.css",
  "src/app.js",
  "src/features/app-shell/ui/localization-map.js", "src/features/app-shell/ui/localization.js", "src/features/background-runtime/ui/localization-keys.js", "src/platform/chrome/i18n.js",
  "store/listing.md",
  "store-listing/chrome-web-store/README.md",
  "store-listing/chrome-web-store/listing/en.md",
  "store-listing/chrome-web-store/media/icon-128.png",
  "store-listing/chrome-web-store/media/promo/.gitkeep",
  "store-listing/chrome-web-store/media/promo/small-promo.png",
  "store-listing/chrome-web-store/media/promo/marquee-promo.png",
  "store-listing/chrome-web-store/media/screenshots/.gitkeep",
  "store-listing/chrome-web-store/media/screenshots/01-history-search.jpg",
  "store-listing/chrome-web-store/media/screenshots/02-quick-open.jpg",
  "store-listing/chrome-web-store/media/screenshots/03-backup-health.jpg",
  "store-listing/chrome-web-store/media/screenshots/04-rules-cleanup.jpg",
  "store-listing/chrome-web-store/media/screenshots/05-settings-privacy.jpg",
  "docs/README.md",
  "docs/reviewer-notes.md",
  "docs/release-qa.md",
  "docs/release-notes.md",
  "docs/decision-records.md",
  "docs/repository-metadata.md",
  "docs/storepilot-project-structure.md",
  "docs/source-inventory.md",
  "docs/chrome-web-store-additional-fields.md",
  "docs/chrome-web-store-category.md",
  "docs/chrome-web-store-privacy-form.md",
  "scripts/check-folder-density.mjs",
  "assets/icons/icon16.png",
  "assets/icons/icon32.png",
  "assets/icons/icon48.png",
  "assets/icons/icon128.png",
  "scripts/check-file-sizes.mjs",
  "scripts/check-imports.mjs",
  "scripts/check-locales.mjs",
  "scripts/check-manifest-paths.mjs",
  "scripts/check-privacy-permissions.mjs",
  "scripts/check-syntax.mjs",
  "scripts/generate-icons.mjs",
  "scripts/package-extension.mjs",
  "scripts/verify-package.mjs",
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertButtonLabel(source, id, label) {
  const pattern = new RegExp(`<button\\b(?=[^>]*\\bid="${escapeRegExp(id)}")[^>]*>${escapeRegExp(label)}<\\/button>`);
  assert(pattern.test(source), `Missing #${id} button labeled "${label}".`);
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }

  return null;
}

function imageDimensions(file) {
  const buffer = fs.readFileSync(path.join(root, file));
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16)
    };
  }

  return jpegDimensions(buffer);
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
const localeMessages = readJson("_locales/en/messages.json");
const localeMessage = (key) => localeMessages[key]?.message || "";
assert(manifest.manifest_version === 3, "Manifest must use version 3.");
assert(manifest.default_locale === "en", "Manifest must use the English _locales folder for StorePilot-compatible structure.");
assert(manifest.name === "__MSG_extensionName__", "Manifest name should resolve through _locales/en/messages.json.");
assert(manifest.short_name === "__MSG_extensionShortName__", "Manifest short_name should resolve through _locales/en/messages.json.");
assert(manifest.description === "__MSG_extensionDescription__", "Manifest description should resolve through _locales/en/messages.json.");
assert(localeMessage("extensionName") === "BrowseVault: History Search & Backup", "Unexpected localized extension name.");
assert(localeMessage("extensionShortName") === "BrowseVault", "Unexpected localized short_name.");
assert(
  localeMessage("extensionDescription") === "Search, back up, export, and preserve your browser history locally.",
  "Unexpected localized extension description."
);
assert(localeMessage("extensionDescription").length <= 132, "Manifest description should stay within Chrome Web Store summary length.");
assert(manifest.background?.type === "module", "Background script should be an ES module.");
for (const size of ["16", "32", "48", "128"]) {
  assert(manifest.icons?.[size] === `assets/icons/icon${size}.png`, `Missing manifest icon ${size}.`);
  assert(manifest.action?.default_icon?.[size] === `assets/icons/icon${size}.png`, `Missing action icon ${size}.`);
}

const expectedPermissions = ["bookmarks", "downloads", "history", "sessions", "storage", "tabs"];
assert(Array.isArray(manifest.permissions), "Manifest permissions must be explicit.");
assert(
  JSON.stringify([...manifest.permissions].sort()) === JSON.stringify([...expectedPermissions].sort()),
  `Manifest permissions changed; expected exactly: ${expectedPermissions.join(", ")}.`
);
assert(!manifest.optional_permissions?.length, "Manifest should not request optional permissions.");
assert(!manifest.host_permissions?.length, "Manifest should not request host permissions.");
assert(!manifest.optional_host_permissions?.length, "Manifest should not request optional host permissions.");
assert(!manifest.chrome_url_overrides, "Manifest must not replace Chrome history by default.");
assert(!manifest.content_scripts?.length, "Manifest should not inject content scripts.");
assert(!manifest.externally_connectable, "Manifest should not expose externally_connectable messaging.");
assert(!manifest.web_accessible_resources?.length, "Manifest should not expose web-accessible resources.");
assert(manifest.commands?.["open-browsevault"], "Missing open-browsevault command.");
assert(
  manifest.commands["open-browsevault"].description === "__MSG_openCommandDescription__",
  "Command description should resolve through _locales/en/messages.json."
);
assert(localeMessage("openCommandDescription") === "Open BrowseVault", "Unexpected localized open command description.");

const packageJson = readJson("package.json");
assert(packageJson.version === manifest.version, "package.json version must match manifest version.");
assert(packageJson.license === "GPL-3.0-only", "package.json license must follow the extension playbook.");
assert(packageJson.keywords.includes("browser-history"), "Missing browser-history keyword.");
assert(packageJson.keywords.includes("history-backup"), "Missing history-backup keyword.");
assert(packageJson.scripts.check.includes("check-syntax.mjs"), "Check script must verify JavaScript syntax.");
assert(packageJson.scripts.check.includes("check-imports.mjs"), "Check script must verify static import resolution.");
assert(packageJson.scripts.check.includes("check-locales.mjs"), "Check script must verify locale message coverage.");
assert(packageJson.scripts.check.includes("check-manifest-paths.mjs"), "Check script must verify manifest-referenced file paths.");
assert(packageJson.scripts.check.includes("check-privacy-permissions.mjs"), "Check script must verify privacy/permission parity.");
assert(packageJson.scripts.check.includes("check-file-sizes.mjs"), "Check script must enforce file-size budgets.");
assert(packageJson.scripts.check.includes("check-folder-density.mjs"), "Check script must enforce folder density.");
assert(packageJson.scripts.icons, "Missing icons script.");
assert(packageJson.scripts.package?.includes("verify-package.mjs"), "Package script must verify the final ZIP output.");
assert(packageJson.scripts["verify:package"]?.includes("verify-package.mjs"), "Missing verify:package script.");

const verifyPackageScript = fs.readFileSync(path.join(root, "scripts", "verify-package.mjs"), "utf8");
for (const expected of [
  "Package import missing target",
  "Package module script missing target",
  "Packaged extension entry must not use bare imports",
  "Package manifest",
  "references missing entry"
]) {
  assert(verifyPackageScript.includes(expected), `Package verifier missing import-resolution guardrail: ${expected}`);
}

const fileSizeScript = fs.readFileSync(path.join(root, "scripts", "check-file-sizes.mjs"), "utf8");
for (const expected of [
  "knownDebtCaps",
  "soft target",
  "hard max",
  "src/app.css",
  "src/storage.js",
  "split follow-up expected"
]) {
  assert(fileSizeScript.includes(expected), `File-size audit missing modularization guardrail: ${expected}`);
}

const localeCheckScript = fs.readFileSync(path.join(root, "scripts", "check-locales.mjs"), "utf8");
for (const expected of ["manifest.default_locale", "appShellLocalization", "backgroundRuntimeLocalization", "UI bindings", "missing locale key", "unused locale key", "__MSG_*__ references are only supported in manifest.json", "Locale coverage checked"]) {
  assert(localeCheckScript.includes(expected), `Locale audit missing coverage guardrail: ${expected}`);
}

const manifestPathScript = fs.readFileSync(path.join(root, "scripts", "check-manifest-paths.mjs"), "utf8");
for (const expected of [
  "background.service_worker",
  "action.default_popup",
  "content_scripts",
  "web_accessible_resources",
  "Manifest paths checked"
]) {
  assert(manifestPathScript.includes(expected), `Manifest-path audit missing guardrail: ${expected}`);
}

const privacyPermissionScript = fs.readFileSync(path.join(root, "scripts", "check-privacy-permissions.mjs"), "utf8");
for (const expected of [
  "permission.${permission}",
  "data_usage.web_history",
  "host_permission",
  "remote_code",
  "Does not request host permissions or optional permissions"
]) {
  assert(privacyPermissionScript.includes(expected), `Privacy/permission audit missing guardrail: ${expected}`);
}

const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
assert(changelog.includes(`## ${manifest.version} -`), "Changelog must include the current manifest version.");
for (const topic of ["backup", "delete", "Chrome history", "permissions", "network"]) {
  assert(new RegExp(topic, "i").test(changelog), `Changelog must cover trust-sensitive topic: ${topic}`);
}
assert(
  /No default Chrome history replacement/i.test(changelog),
  "Changelog must disclose default Chrome history replacement behavior."
);

const license = fs.readFileSync(path.join(root, "LICENSE"), "utf8");
assert(/GNU GENERAL PUBLIC LICENSE/.test(license), "LICENSE must contain the GPLv3 text.");
assert(/Version 3, 29 June 2007/.test(license), "LICENSE must be GPL version 3.");

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const expected of [
  "PRIVACY.md",
  "Open source under the GPL-3.0 license:",
  "https://github.com/molodchyk/BrowseVault",
  "Buy Me a Coffee",
  "https://buymeacoffee.com/molodchyk",
  "Patreon",
  "https://www.patreon.com/OMolodchyk"
]) {
  assert(readme.includes(expected), `README missing playbook-required text: ${expected}`);
}

const privacy = fs.readFileSync(path.join(root, "PRIVACY.md"), "utf8");
assert(privacy.includes("Chrome local extension storage"), "Privacy policy must name the storage area used for settings.");
for (const expected of [
  "content scripts",
  "remote code",
  "Does not sell, share, transfer, upload, review, or collect",
  "`downloads`: searches download URLs and filenames in Quick Open and can show Chrome's Save As prompt",
  "`tabs`: lists open tabs for Quick Open"
]) {
  assert(privacy.includes(expected), `Privacy policy missing playbook-required detail: ${expected}`);
}

for (const size of [16, 32, 48, 128]) {
  const icon = fs.readFileSync(path.join(root, "assets", "icons", `icon${size}.png`));
  assert(icon[0] === 137 && icon[1] === 80 && icon[2] === 78 && icon[3] === 71, `Icon ${size} is not a PNG.`);
  assert(icon.readUInt32BE(16) === size && icon.readUInt32BE(20) === size, `Icon ${size} has wrong dimensions.`);
}

for (const screenshot of [
  "01-history-search.jpg",
  "02-quick-open.jpg",
  "03-backup-health.jpg",
  "04-rules-cleanup.jpg",
  "05-settings-privacy.jpg"
]) {
  const dimensions = imageDimensions(path.join("store-listing", "chrome-web-store", "media", "screenshots", screenshot));
  assert(dimensions?.width === 1280 && dimensions?.height === 800, `Store screenshot ${screenshot} must be 1280 x 800.`);
}

for (const [promo, width, height] of [
  ["small-promo.png", 440, 280],
  ["marquee-promo.png", 1400, 560]
]) {
  const dimensions = imageDimensions(path.join("store-listing", "chrome-web-store", "media", "promo", promo));
  assert(dimensions?.width === width && dimensions?.height === height, `Store promo ${promo} must be ${width} x ${height}.`);
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
assert(
  storePilotListing.includes("Open source under the GPL-3.0 license:\nhttps://github.com/molodchyk/BrowseVault"),
  "StorePilot listing must include the open-source footer."
);

const storeDraft = fs.readFileSync(path.join(root, "store", "listing.md"), "utf8");
assert(
  storeDraft.includes("Open source under the GPL-3.0 license:\nhttps://github.com/molodchyk/BrowseVault"),
  "Human store listing draft must include the open-source footer."
);

const reviewerNotes = fs.readFileSync(path.join(root, "docs", "reviewer-notes.md"), "utf8");
for (const expected of [
  "cannot recover visits Chrome already deleted",
  "does not replace Chrome's native history page by default",
  "does not make network requests by default",
  "does not request `file://` host access",
  "`history`",
  "`tabs`"
]) {
  assert(reviewerNotes.includes(expected), `Reviewer notes missing: ${expected}`);
}

const docsReadme = fs.readFileSync(path.join(root, "docs", "README.md"), "utf8");
for (const expected of [
  "release-notes.md",
  "release-qa.md",
  "decision-records.md",
  "repository-metadata.md",
  "storepilot-project-structure.md",
  "Browser Extension Playbook",
  "StorePilot Project Reference"
]) {
  assert(docsReadme.includes(expected), `Docs README missing playbook reference: ${expected}`);
}

const extensionModularizationPlaybook = fs.readFileSync(path.join(root, "docs", "extension-modularization-playbook.md"), "utf8");
for (const expected of [
  "This is a prescriptive target",
  "Treat this playbook as the architecture standard",
  "Do not copy transitional folders",
  "use generated output to satisfy manifest, CSP, or browser-extension loading rules",
  "Do not let native-support gaps decide source organization",
  "Wrap browser listener registration"
]) {
  assert(extensionModularizationPlaybook.includes(expected), `Local modularization playbook missing current DaD guidance: ${expected}`);
}

const codeStructure = fs.readFileSync(path.join(root, "docs", "code-structure.md"), "utf8");
assert(
  codeStructure.includes("it does not redefine the playbook's target architecture"),
  "Code structure doc must not soften the modularization playbook target."
);

const sourceInventory = fs.readFileSync(path.join(root, "docs", "source-inventory.md"), "utf8");
for (const expected of [
  "tooling-reference snapshots",
  "refreshed from `settings/StorePilot/docs/reference.md`",
  "prompted the first snapshot"
]) {
  assert(sourceInventory.includes(expected), `Source inventory missing refreshed StorePilot provenance: ${expected}`);
}

const storePilotStructure = fs.readFileSync(path.join(root, "docs", "storepilot-project-structure.md"), "utf8");
for (const expected of [
  "StorePilot Project Reference",
  "manifest.json",
  "src/",
  "_locales/",
  "store-listing/",
  "chrome-web-store/",
  "listing/",
  "en.md",
  "media/",
  "icon-128.png",
  "screenshots/",
  "promo/",
  "small-promo.png",
  "marquee-promo.png",
  "docs/chrome-web-store-additional-fields.md",
  "docs/chrome-web-store-category.md",
  "docs/chrome-web-store-privacy-form.md"
]) {
  assert(storePilotStructure.includes(expected), `StorePilot structure checklist missing: ${expected}`);
}

const releaseNotes = fs.readFileSync(path.join(root, "docs", "release-notes.md"), "utf8");
for (const expected of [
  "CHANGELOG.md",
  `## ${manifest.version} -`,
  "local-first",
  "no default network requests"
]) {
  assert(releaseNotes.includes(expected), `Release notes missing: ${expected}`);
}

const releaseQa = fs.readFileSync(path.join(root, "docs", "release-qa.md"), "utf8");
for (const expected of [
  "npm run validate",
  "npm run check",
  "npm test",
  "npm run package",
  "npm run verify:package",
  "git diff --check",
  "load this repository folder unpacked",
  "Cold Turkey",
  "FocusMe"
]) {
  assert(releaseQa.includes(expected), `Release QA notes missing: ${expected}`);
}

const decisionRecords = fs.readFileSync(path.join(root, "docs", "decision-records.md"), "utf8");
for (const expected of [
  "local-first",
  "Do Not Replace Chrome History By Default",
  "Separate Vault Deletion From Chrome History Deletion",
  "StorePilot Project Reference"
]) {
  assert(decisionRecords.includes(expected), `Decision records missing: ${expected}`);
}

const repositoryMetadata = fs.readFileSync(path.join(root, "docs", "repository-metadata.md"), "utf8");
for (const expected of [
  packageJson.description,
  "chrome-extension",
  "browser-history",
  "history-search",
  "history-backup",
  "local-first",
  "privacy-first",
  "export-history",
  "manifest-v3"
]) {
  assert(repositoryMetadata.includes(expected), `Repository metadata missing: ${expected}`);
}

const storePilotReadme = fs.readFileSync(path.join(root, "store-listing", "chrome-web-store", "README.md"), "utf8");
assert(storePilotReadme.includes("StorePilot Project Reference"), "StorePilot README must link the shared StorePilot reference.");

const storePilotCategory = fs.readFileSync(path.join(root, "docs", "chrome-web-store-category.md"), "utf8");
assert(/Selected category:\s*\S/i.test(storePilotCategory), "Chrome Web Store category document needs a selected category.");

const storePilotAdditionalFields = fs.readFileSync(path.join(root, "docs", "chrome-web-store-additional-fields.md"), "utf8");
for (const key of ["official_url", "homepage_url", "support_url", "mature_content"]) {
  assert(storePilotAdditionalFields.includes(`${key}:`), `Missing StorePilot additional field key: ${key}`);
}
const additionalFieldValue = (key) => {
  const match = storePilotAdditionalFields.match(new RegExp(`${key}:\\s*\\n([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
};
assert(additionalFieldValue("official_url") === "https://github.com/molodchyk/BrowseVault", "Unexpected StorePilot official URL.");
assert(additionalFieldValue("homepage_url") === "https://github.com/molodchyk/BrowseVault", "Unexpected StorePilot homepage URL.");
assert(additionalFieldValue("support_url") === "https://github.com/molodchyk/BrowseVault/issues", "Unexpected StorePilot support URL.");
assert(additionalFieldValue("mature_content") === "no", "StorePilot mature content should be no.");

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
  "data_usage.health_information",
  "data_usage.financial_payment_information",
  "data_usage.authentication_information",
  "data_usage.personal_communications",
  "data_usage.location",
  "data_usage.web_history",
  "data_usage.user_activity",
  "data_usage.website_content",
  "certification.no_sell_or_transfer",
  "certification.no_unrelated_use",
  "certification.no_creditworthiness"
]) {
  assert(storePilotPrivacy.includes(`${key}:`), `Missing StorePilot privacy key: ${key}`);
}

const storePilotReferenceSnapshot = fs.readFileSync(path.join(root, "docs", "raw-sources", "storepilot-chrome-web-store-reference.txt"), "utf8");
for (const expected of [
  "Treat collect as data that leaves local-only browser/device processing",
  "StorePilot applies explicit `yes`/`no` values",
  "a local history vault can need `permission.history` while still using `data_usage.web_history: no`"
]) {
  assert(storePilotReferenceSnapshot.includes(expected), `StorePilot reference snapshot missing current privacy guidance: ${expected}`);
}

const appHtml = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
assert(appHtml.includes('type="module"'), "App script should load as a module.");
assert(appHtml.includes("Permissions and limits"), "Settings should disclose permissions and product limits.");
assert(appHtml.includes("cannot recover visits Chrome already deleted"), "Settings should disclose old-history recovery limits.");

const appJs = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
assert(appJs.includes("localizeAppShell") && appJs.includes("getChromeMessage"), "App shell must initialize extension-page localization.");

for (const [id, label] of [
  ["delete-results", "Delete Results From Vault"],
  ["delete-results-chrome", "Delete Results From Chrome"],
  ["delete-vault", "Delete From Vault"],
  ["delete-chrome", "Delete URLs From Chrome"],
  ["reset-vault", "Reset Vault"]
]) {
  assertButtonLabel(appHtml, id, label);
}

const vaultActions = fs.readFileSync(path.join(root, "src", "features", "vault-management", "ui", "actions.js"), "utf8");
for (const expected of [
  "Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.",
  "Chrome history untouched",
  'notifyVaultChanged("vault-delete")',
  'notifyVaultChanged("chrome-and-vault-delete")',
  'notifyVaultChanged("vault-cleanup")',
  'notifyVaultChanged("vault-reset")'
]) {
  assert(vaultActions.includes(expected), `Vault actions missing destructive-action guardrail: ${expected}`);
}

const sourceFiles = collectFilesByExtension("src", new Set([".js", ".html", ".css"]));
const forbiddenSourcePatterns = [
  {
    pattern: /https?:\/\//i,
    message: "remote URL"
  },
  {
    pattern: /\bfetch\s*\(/,
    message: "fetch network call"
  },
  {
    pattern: /\bXMLHttpRequest\b/,
    message: "XMLHttpRequest network API"
  },
  {
    pattern: /\bWebSocket\b/,
    message: "WebSocket network API"
  },
  {
    pattern: /\bEventSource\b/,
    message: "EventSource network API"
  },
  {
    pattern: /\bnavigator\.sendBeacon\b/,
    message: "sendBeacon network API"
  },
  {
    pattern: /\bimportScripts\s*\(/,
    message: "importScripts remote-code loader"
  },
  {
    pattern: /\beval\s*\(/,
    message: "eval remote-code risk"
  },
  {
    pattern: /\bnew\s+Function\s*\(/,
    message: "Function constructor remote-code risk"
  },
  {
    pattern: /\bimport\s*\(/,
    message: "dynamic import remote-code risk"
  }
];

for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  for (const { pattern, message } of forbiddenSourcePatterns) {
    assert(!pattern.test(source), `Unexpected ${message} in ${file}`);
  }
}

console.log("BrowseVault extension validated.");
