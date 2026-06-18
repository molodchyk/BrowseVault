import fs from "node:fs";
import path from "node:path";
import { requiredProjectFiles } from "./playbook/required-project-files.mjs";
import { validateChromeQaSafety } from "./playbook/validate-chrome-qa-safety.mjs";
import { validateManifestSurface } from "./playbook/validate-manifest-surface.mjs";
import { validatePlaybookCompliance } from "./playbook/validate-playbook-compliance.mjs";
import { validateStoreMedia } from "./playbook/validate-store-media.mjs";

const root = process.cwd();

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

for (const file of requiredProjectFiles) assert(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);

const manifest = readJson("manifest.json");
const localeMessages = readJson("_locales/en/messages.json");
const localeMessage = (key) => localeMessages[key]?.message || "";
validateManifestSurface(manifest, localeMessage, assert);

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
assert(packageJson.scripts.check.includes("check-reference-sync.mjs"), "Check script must verify shared reference sync.");
assert(packageJson.scripts.check.includes("check-file-sizes.mjs"), "Check script must enforce file-size budgets.");
assert(packageJson.scripts.check.includes("check-folder-density.mjs"), "Check script must enforce folder density.");
assert(packageJson.scripts.icons, "Missing icons script.");
assert(packageJson.scripts["store:media"]?.includes("generate-store-media.py"), "Missing store media generation script.");
assert(packageJson.scripts.package?.includes("verify-package.mjs"), "Package script must verify the final ZIP output.");
assert(packageJson.scripts["verify:package"]?.includes("verify-package.mjs"), "Missing verify:package script.");

const verifyPackageScript = fs.readFileSync(path.join(root, "scripts", "verify-package.mjs"), "utf8");
for (const expected of [
  "Package import missing target", "Package module script missing target", "Packaged extension entry must not use bare imports",
  "Package manifest", "references missing entry", "Package missing current source file", "Package entry does not match current source file",
  "Package contains entry not present in current source tree"
]) {
  assert(verifyPackageScript.includes(expected), `Package verifier missing import-resolution guardrail: ${expected}`);
}

const fileSizeScript = fs.readFileSync(path.join(root, "scripts", "check-file-sizes.mjs"), "utf8");
for (const expected of ["knownDebtCaps", "soft target", "hard max", "split follow-up expected"]) {
  assert(fileSizeScript.includes(expected), `File-size audit missing modularization guardrail: ${expected}`);
}

const importCheckScript = fs.readFileSync(path.join(root, "scripts", "check-imports.mjs"), "utf8");
for (const expected of ["cssImportPattern", "stylesheet link", "stylesheet import", "stylesheets"]) assert(importCheckScript.includes(expected), `Import audit missing stylesheet guardrail: ${expected}`);

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

const folderDensityScript = fs.readFileSync(path.join(root, "scripts", "check-folder-density.mjs"), "utf8");
for (const expected of ["docs", "documentation folder", "docsFolderLimit"]) {
  assert(folderDensityScript.includes(expected), `Folder-density audit missing docs guardrail: ${expected}`);
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

validatePlaybookCompliance(root, assert);

for (const size of [16, 32, 48, 128]) {
  const icon = fs.readFileSync(path.join(root, "assets", "icons", `icon${size}.png`));
  assert(icon[0] === 137 && icon[1] === 80 && icon[2] === 78 && icon[3] === 71, `Icon ${size} is not a PNG.`);
  assert(icon.readUInt32BE(16) === size && icon.readUInt32BE(20) === size, `Icon ${size} has wrong dimensions.`);
}

validateStoreMedia(root, assert);

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

const reviewerNotes = fs.readFileSync(path.join(root, "docs", "release", "reviewer-notes.md"), "utf8");
for (const expected of [
  "cannot recover visits Chrome already deleted",
  "does not replace Chrome's native history page by default",
  "does not make network requests by default",
  "does not request `file://` host access",
  "instead of enforcing one global app tab",
  "`history`",
  "`tabs`"
]) {
  assert(reviewerNotes.includes(expected), `Reviewer notes missing: ${expected}`);
}

const extensionModularizationPlaybook = fs.readFileSync(path.join(root, "docs", "architecture", "extension-modularization-playbook.md"), "utf8");
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

const codeStructure = fs.readFileSync(path.join(root, "docs", "architecture", "code-structure.md"), "utf8");
assert(
  codeStructure.includes("it does not redefine the playbook's target architecture"),
  "Code structure doc must not soften the modularization playbook target."
);

const sourceInventory = fs.readFileSync(path.join(root, "docs", "research", "source-inventory.md"), "utf8");
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

const releaseNotes = fs.readFileSync(path.join(root, "docs", "release", "release-notes.md"), "utf8");
for (const expected of [
  "CHANGELOG.md",
  `## ${manifest.version} -`,
  "local-first",
  "no default network requests"
]) {
  assert(releaseNotes.includes(expected), `Release notes missing: ${expected}`);
}

const releaseQa = fs.readFileSync(path.join(root, "docs", "release", "release-qa.md"), "utf8");
for (const expected of [
  "npm run validate",
  "npm run check",
  "npm test",
  "npm run package",
  "npm run verify:package",
  "git diff --check",
  "shared reference sync",
  "screenshot/store-copy review evidence",
  "load this repository folder unpacked",
  "Cold Turkey",
  "FocusMe"
]) {
  assert(releaseQa.includes(expected), `Release QA notes missing: ${expected}`);
}

for (const expected of ["Chrome QA profile-safety guardrails", "shared reference sync", "fresh against the current source tree", "automated gate results", "screenshot/store-copy review evidence"]) {
  assert(reviewerNotes.includes(expected), `Reviewer notes missing current release guardrail: ${expected}`);
}
validateChromeQaSafety(root, packageJson, assert);

const decisionRecords = fs.readFileSync(path.join(root, "docs", "project", "decision-records.md"), "utf8");
for (const expected of [
  "local-first",
  "Do Not Replace Chrome History By Default",
  "Separate Vault Deletion From Chrome History Deletion",
  "Keep BrowseVault Browser QA Manual In This Workspace",
  "Do Not Enforce One Global BrowseVault Tab",
  "StorePilot Project Reference"
]) {
  assert(decisionRecords.includes(expected), `Decision records missing: ${expected}`);
}

const repositoryMetadata = fs.readFileSync(path.join(root, "docs", "project", "repository-metadata.md"), "utf8");
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

const storePilotReferenceSnapshot = fs.readFileSync(path.join(root, "docs", "research", "raw-sources", "storepilot-chrome-web-store-reference.txt"), "utf8");
for (const expected of [
  "Treat collect as data that leaves local-only browser/device processing",
  "StorePilot applies explicit `yes`/`no` values",
  "a local history vault can need `permission.history` while still using `data_usage.web_history: no`"
]) {
  assert(storePilotReferenceSnapshot.includes(expected), `StorePilot reference snapshot missing current privacy guidance: ${expected}`);
}

const appHtml = fs.readFileSync(path.join(root, "src/app.html"), "utf8");
assert(appHtml.includes('type="module"'), "App script should load as a module.");
assert(appHtml.includes("History Search & Backup"), "First screen should open on the core history-search job.");
assert(appHtml.includes('data-panel="history"'), "History panel should be the default visible app panel.");
assert(appHtml.includes("Display and search defaults"), "Settings should expose the main display/search preferences immediately.");
assert(appHtml.includes("Permissions and limits"), "Settings should disclose permissions and product limits.");
assert(appHtml.includes("cannot recover visits Chrome already deleted"), "Settings should disclose old-history recovery limits.");
assert(appHtml.includes("No activity logged yet."), "Activity log should include an intentional empty state.");
for (const expected of [
  'id="pref-theme"',
  '<option value="system">System</option>',
  '<option value="light">Light</option>',
  '<option value="dark">Dark</option>',
  'id="pref-contrast"',
  'id="pref-text-size"',
  'id="pref-date-format"',
  'id="pref-limit"'
]) {
  assert(appHtml.includes(expected), `Settings UI missing playbook-required control: ${expected}`);
}

const appJs = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
assert(appJs.includes("startBrowseVaultApp"), "Runtime entry should delegate to the app-shell bootstrap.");
const appBootstrap = fs.readFileSync(path.join(root, "src", "features", "app-shell", "ui", "bootstrap.js"), "utf8");
assert(appBootstrap.includes("localizeAppShell") && appBootstrap.includes("getChromeMessage"), "App shell bootstrap must initialize extension-page localization.");

for (const [id, label] of [
  ["open-native-history", "Open Chrome History"],
  ["delete-results", "Delete Results From Vault"],
  ["delete-results-chrome", "Delete Results From Chrome"],
  ["delete-vault", "Delete From Vault"],
  ["delete-chrome", "Delete URLs From Chrome"],
  ["reset-vault", "Reset Vault"]
]) {
  assertButtonLabel(appHtml, id, label);
}

const vaultActionSurface = ["actions.js", "cleanup-actions.js"].map((file) => fs.readFileSync(path.join(root, "src", "features", "vault-management", "ui", file), "utf8")).join("\n");
for (const expected of [
  "Erase all BrowseVault local archive data, rules, and backup metadata? This will not delete Chrome history.",
  "Chrome history untouched",
  'notifyVaultChanged("vault-delete")',
  'notifyVaultChanged("chrome-and-vault-delete")',
  'notifyVaultChanged("vault-cleanup")',
  'notifyVaultChanged("vault-reset")'
]) {
  assert(vaultActionSurface.includes(expected), `Vault actions missing destructive-action guardrail: ${expected}`);
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
