import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dataUsageKeys = [
  "data_usage.personally_identifiable_information",
  "data_usage.health_information",
  "data_usage.financial_payment_information",
  "data_usage.authentication_information",
  "data_usage.personal_communications",
  "data_usage.location",
  "data_usage.web_history",
  "data_usage.user_activity",
  "data_usage.website_content"
];
const certificationKeys = [
  "certification.no_sell_or_transfer",
  "certification.no_unrelated_use",
  "certification.no_creditworthiness"
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function readJson(file) {
  return JSON.parse(read(file));
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function storeValue(source, key) {
  const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\r?\\n|$)`, "m");
  const match = source.match(pattern);
  return match ? match[1].trim() : "";
}

function collectStorePermissionKeys(source) {
  const keys = [];
  const pattern = /^permission\.([A-Za-z0-9_.-]+):/gm;
  for (const match of source.matchAll(pattern)) {
    keys.push(match[1]);
  }
  return keys;
}

function assertPrivacyPermission(privacy, permission) {
  const pattern = new RegExp(`^- \`${escapeRegExp(permission)}\`:`, "m");
  if (!pattern.test(privacy)) {
    fail(`PRIVACY.md must document manifest permission: ${permission}.`);
  }
}

function assertStoreValue(source, key, expected) {
  const value = storeValue(source, key);
  if (!value) {
    fail(`StorePilot privacy form missing value for ${key}.`);
    return;
  }

  if (expected && value.toLowerCase() !== expected) {
    fail(`StorePilot privacy form ${key} must be ${expected}, got ${value}.`);
  }
}

const manifest = readJson("manifest.json");
const privacy = read("PRIVACY.md");
const storePrivacy = read("docs/chrome-web-store-privacy-form.md");
const manifestPermissions = new Set(manifest.permissions || []);
const documentedStorePermissions = collectStorePermissionKeys(storePrivacy);

for (const permission of manifestPermissions) {
  assertPrivacyPermission(privacy, permission);
  assertStoreValue(storePrivacy, `permission.${permission}`);
}

for (const permission of documentedStorePermissions) {
  if (!manifestPermissions.has(permission)) {
    fail(`StorePilot privacy form documents permission.${permission}, but manifest.json does not request it.`);
  }
}

if (manifest.optional_permissions?.length) {
  fail("Optional permissions must be added deliberately and reflected in privacy/reviewer docs.");
}

if (manifest.host_permissions?.length || manifest.optional_host_permissions?.length) {
  fail("Host permissions must be added deliberately and reflected in privacy/reviewer docs.");
}

if (manifest.content_scripts?.length) {
  fail("Content scripts must be added deliberately and reflected in privacy/reviewer docs.");
}

for (const expected of [
  "Does not request host permissions or optional permissions.",
  "Does not include analytics, ads, tracking scripts, content scripts, or remote code.",
  "Does not make remote network requests.",
  "Chrome local extension storage, not sync, session, or managed storage."
]) {
  if (!privacy.includes(expected)) {
    fail(`PRIVACY.md missing required privacy/permission posture: ${expected}`);
  }
}

assertStoreValue(storePrivacy, "host_permission");
if (!/^No host permissions are requested\./i.test(storeValue(storePrivacy, "host_permission"))) {
  fail("StorePilot privacy form must explicitly say no host permissions are requested.");
}

assertStoreValue(storePrivacy, "remote_code", "no");
assertStoreValue(storePrivacy, "privacy_policy_url");
if (storeValue(storePrivacy, "privacy_policy_url") !== "https://github.com/molodchyk/BrowseVault/blob/main/PRIVACY.md") {
  fail("StorePilot privacy policy URL must point to the repository PRIVACY.md.");
}

for (const key of dataUsageKeys) {
  assertStoreValue(storePrivacy, key, "no");
}

for (const key of certificationKeys) {
  assertStoreValue(storePrivacy, key, "yes");
}

if (!storePrivacy.includes("does not transmit or collect that history from users")) {
  fail("StorePilot privacy form must explain local-only history handling versus developer collection.");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Privacy/permission parity checked ${manifestPermissions.size} manifest permissions.`);
