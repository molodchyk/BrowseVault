import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const canonicalSupportBlock = `## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)`;

const canonicalSourceBlock = `## Open Source And License

Open source under the GPL-3.0 license:
https://github.com/molodchyk/BrowseVault

The full license text is in [\`LICENSE\`](LICENSE).`;

export function validatePlaybookCompliance(root, assert) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert(
    packageJson.scripts["check:playbook-compliance"]?.includes("validate-playbook-compliance.mjs"),
    "package.json must expose check:playbook-compliance for direct playbook evidence validation."
  );
  assert(
    packageJson.scripts.check?.includes("check:playbook-compliance"),
    "package.json check script must run playbook compliance validation."
  );
  assert(
    packageJson.scripts["release:ready"]?.includes("check-release-readiness.mjs"),
    "package.json must expose release:ready for manual browser QA evidence."
  );
  assert(
    packageJson.scripts.check?.includes("check-store-metadata.mjs"),
    "package.json check script must verify store metadata synchronization."
  );

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  for (const expected of [
    "PRIVACY.md",
    "BrowseVault: History Search & Backup",
    "Search, back up, export, and preserve your browser history locally.",
    "## Load Unpacked",
    "chrome://extensions",
    "Developer mode",
    "Load unpacked",
    "Select this repository folder",
    "npm run validate",
    "npm run check",
    "npm test",
    "npm run package",
    "npm run release:ready",
    "chrome-web-store-media.md",
    "shared reference sync",
    "store metadata sync",
    "automated gate, manual target-browser, and screenshot/store-copy review requirements",
    "screenshot/store-copy review requirements",
    "Open source under the GPL-3.0 license:",
    "https://github.com/molodchyk/BrowseVault",
    "Buy Me a Coffee",
    "https://buymeacoffee.com/molodchyk",
    "Patreon",
    "https://www.patreon.com/OMolodchyk",
    "Chrome local-storage revision fallback"
  ]) {
    assert(readme.includes(expected), `README missing playbook-required text: ${expected}`);
  }

  assert(readme.includes(canonicalSourceBlock), "README must keep the browser-extension playbook source/license block.");
  assert(readme.includes(canonicalSupportBlock), "README must keep the browser-extension playbook support block.");
  assert(
    readme.indexOf(canonicalSourceBlock) < readme.indexOf(canonicalSupportBlock),
    "README support block must appear after privacy and license/source information."
  );
  for (const expected of [
    "docs/project/repository-metadata.md",
    "playbook/",
    "qa/",
    "zip-utils.mjs",
    "test/scripts/",
    "activity-log/",
    "app-shell/",
    "background-runtime/",
    "browser-memory/",
    "vault-management/",
    "platform/"
  ]) {
    assert(readme.includes(expected), `README project structure missing current tree entry: ${expected}`);
  }
  assert(readme.includes("Reset Vault"), "README must document the visible reset path before uninstall.");

  const testReadme = fs.readFileSync(path.join(root, "test", "README.md"), "utf8");
  for (const expected of ["features/", "platform/", "query/", "scripts/", "storage/"]) {
    assert(testReadme.includes(expected), `Test README missing test responsibility folder: ${expected}`);
  }
  for (const expected of [
    "Do not add automated tests that launch or attach to Chrome",
    "BrowseVault target-browser QA is manual in this workspace"
  ]) {
    assert(testReadme.includes(expected), `Test README missing browser-safety detail: ${expected}`);
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

  const docsReadme = fs.readFileSync(path.join(root, "docs", "README.md"), "utf8");
  for (const expected of [
    "release/browser-extension-playbook-audit.md",
    "release/browser-extension-playbook-compliance.md",
    "release/manual-browser-qa-checklist.md",
    "release/release-notes.md",
    "release/release-qa.md",
    "project/decision-records.md",
    "project/repository-metadata.md",
    "chrome-web-store-media.md",
    "automated gate and manual target-browser QA checklist",
    "research/source-inventory.md",
    "architecture/code-structure.md",
    "Browser Extension Playbook",
    "StorePilot Project Reference"
  ]) {
    assert(docsReadme.includes(expected), `Docs README missing playbook reference: ${expected}`);
  }
  assert(
    docsReadme.includes("Defense against Distractions Localization Reference") &&
      docsReadme.includes("../../Defense_against_Distractions/docs/localization.md"),
    "Docs README must link the shared localization workflow reference."
  );

  const codeStructure = fs.readFileSync(path.join(root, "docs", "architecture", "code-structure.md"), "utf8");
  assert(
    codeStructure.includes("dynamic Quick Open keys") &&
      codeStructure.includes("dynamic activity-log label keys") &&
      codeStructure.includes("dynamic Backup/Import export status keys") &&
      codeStructure.includes("dynamic display-preference status and summary keys") &&
      codeStructure.includes("dynamic history-result UI status keys") &&
      codeStructure.includes("dynamic vault-management action/rule UI keys"),
    "Code structure doc must document dynamic Backup/Import, Quick Open, display-preference summary, history-results, and vault-management localization coverage."
  );

  const localeCheckScript = fs.readFileSync(path.join(root, "scripts", "check-locales.mjs"), "utf8");
  assert(
    localeCheckScript.includes("activityLogLocalization") &&
      localeCheckScript.includes("backupImportLocalization") &&
      localeCheckScript.includes("browserMemoryLocalization") &&
      localeCheckScript.includes("displayPreferencesLocalization") &&
      localeCheckScript.includes("historyResultsLocalization") &&
      localeCheckScript.includes("vaultManagementLocalization"),
    "Locale checker must include dynamic Backup/Import, Quick Open, display-preference, history-results, and vault-management UI localization keys."
  );

  const sourceInventory = fs.readFileSync(path.join(root, "docs", "research", "source-inventory.md"), "utf8");
  for (const expected of [
    "browser-extension-playbook-reference.txt",
    "refreshed from `settings/browser-extension-playbook.md`",
    "StorePilot reference as launch tooling documentation"
  ]) {
    assert(sourceInventory.includes(expected), `Source inventory missing playbook/tooling snapshot detail: ${expected}`);
  }

  const qaReadme = fs.readFileSync(path.join(root, "scripts", "qa", "README.md"), "utf8");
  for (const expected of [
    "Do not add scripts here that launch, attach to, or mutate an active Chrome profile.",
    "Your Chrome",
    "chrome.exe",
    "google-chrome",
    "chromium-browser",
    "Google Chrome.app",
    "manual",
    "Browser QA for BrowseVault is manual",
    "npm run validate",
    "npm run check",
    "npm test",
    "npm run package",
    "npm run verify:package"
  ]) {
    assert(qaReadme.includes(expected), `QA README missing safety or release-check detail: ${expected}`);
  }

  const playbookCompliance = fs.readFileSync(
    path.join(root, "docs", "release", "browser-extension-playbook-compliance.md"),
    "utf8"
  );
  for (const expected of [
    "browser-extension-playbook.md",
    "Product Shape",
    "Repository Shape",
    "Store Listing Copy",
    "Localization",
    "UI Expectations",
    "Privacy And Permissions",
    "Reviewer Notes And Release Checks",
    "Codex Protocol",
    "check:store-metadata",
    "check:playbook-compliance",
    "manifest key allowlist",
    "chrome_settings_overrides",
    "manual check"
  ]) {
    assert(playbookCompliance.includes(expected), `Playbook compliance matrix missing: ${expected}`);
  }
  for (const expected of [
    "First screen performs the main job",
    "Popups support quick changes/status, not marketing copy",
    "Options/settings expose main preferences immediately",
    "Browser-native vocabulary is used when Chrome owns behavior",
    "Destructive actions are explicit and guarded",
    "Dark, light, and blank states are intentional"
  ]) {
    assert(playbookCompliance.includes(expected), `Playbook UI expectations matrix missing: ${expected}`);
  }
  assert(
    playbookCompliance.includes("Chrome local-storage fallback") &&
      playbookCompliance.includes("cross-tab invalidation"),
    "Playbook compliance must document storage-backed cross-tab invalidation evidence."
  );
  assert(
    playbookCompliance.includes("action.default_popup") &&
      playbookCompliance.includes("validate-manifest-surface.mjs"),
    "Playbook compliance must document the no-marketing-popup toolbar action guardrail."
  );

  const backupRulesCss = fs.readFileSync(path.join(root, "src", "styles", "backup-rules.css"), "utf8");
  for (const expected of [
    ".section-heading > button",
    ".rule-actions button",
    ".retention-row button",
    ".backup-actions button",
    ".backup-actions .file-button",
    "width: fit-content"
  ]) {
    assert(backupRulesCss.includes(expected), `Action-row CSS missing compact button guardrail: ${expected}`);
  }

  const tokensCss = fs.readFileSync(path.join(root, "src", "styles", "tokens.css"), "utf8");
  for (const expected of ["html,", "body", "max-width: 100%", "overflow-x: clip"]) {
    assert(tokensCss.includes(expected), `Global CSS missing horizontal overflow guardrail: ${expected}`);
  }

  const resultsCss = fs.readFileSync(path.join(root, "src", "styles", "results.css"), "utf8");
  for (const expected of [
    ".result-title",
    ".url",
    ".meta",
    "overflow-wrap: anywhere",
    "word-break: break-word",
    "text-overflow: ellipsis"
  ]) {
    assert(resultsCss.includes(expected), `Result CSS missing long-text containment guardrail: ${expected}`);
  }

  const storeDraft = fs.readFileSync(path.join(root, "store", "listing.md"), "utf8");
  const storePilotListing = fs.readFileSync(path.join(root, "store-listing", "chrome-web-store", "listing", "en.md"), "utf8");
  assert(!/^#/m.test(storePilotListing), "StorePilot listing body must not contain Markdown headings.");
  assert(
    !/^\s*(Name|Summary|Short Description|Description|Detailed Description|Category|Homepage URL|Support URL|Official URL|Mature content)\s*:/im.test(storePilotListing),
    "StorePilot listing body must not contain dashboard-only field labels."
  );
  for (const source of [
    { label: "Human store listing draft", text: storeDraft },
    { label: "StorePilot listing body", text: storePilotListing }
  ]) {
    for (const expected of [
      "BrowseVault lets you search, preserve, back up, export, and clean up your Chrome browsing history locally.",
      "Popular ways to use BrowseVault:",
      "Feature list:",
      "Browser and data limits:",
      "Open source under the GPL-3.0 license:",
      "https://github.com/molodchyk/BrowseVault"
    ]) {
      assert(source.text.includes(expected), `${source.label} missing playbook store-copy structure: ${expected}`);
    }

    assert(
      !source.text.includes("The current version supports"),
      `${source.label} should not regress to an exhaustive feature-dump sentence.`
    );
    assert(
      !/buymeacoffee|patreon/i.test(source.text),
      `${source.label} must not include donation links by default.`
    );
  }

  const reviewerNotes = fs.readFileSync(path.join(root, "docs", "release", "reviewer-notes.md"), "utf8");
  for (const expected of [
    "Incognito history is not captured unless the browser allows the extension to run in incognito",
    "does not request `file://` host access",
    "Chrome extension APIs generally cannot write arbitrary old imported visits back into Chrome's native history database",
    "Chrome history deletion uses Chrome's URL-level history API"
  ]) {
    assert(reviewerNotes.includes(expected), `Reviewer notes missing browser-store limit detail: ${expected}`);
  }

  const releaseQa = fs.readFileSync(path.join(root, "docs", "release", "release-qa.md"), "utf8");
  for (const expected of [
    "Load the unpacked extension in the target browser",
    "browser-extension-playbook-audit.md",
    "manual-browser-qa-checklist.md",
    "npm run validate",
    "npm run check",
    "npm test",
    "npm run package",
    "npm run verify:package",
    "git diff --check",
    "automated gate"
  ]) {
    assert(releaseQa.includes(expected), `Release QA missing browser-extension playbook check: ${expected}`);
  }
  assert(
    releaseQa.includes("leave the completed evidence in the working tree while running `npm run release:ready`"),
    "Release QA must explain working-tree manual evidence for release readiness."
  );

  const manualBrowserQa = fs.readFileSync(path.join(root, "docs", "release", "manual-browser-qa-checklist.md"), "utf8");
  for (const expected of [
    "Load this repository folder unpacked",
    "completed release evidence should remain uncommitted while running the final release-readiness gate",
    "Do not use automated Chrome or Playwright runs against a live Chrome profile",
    "Do not create or target named personal Chrome profiles such as `Your Chrome`",
    "chrome.exe",
    "google-chrome",
    "chromium-browser",
    "Google Chrome.app",
    "Automated Gate Checks",
    "These commands must pass on the same commit recorded in the Evidence Header",
    "npm run store:media",
    "npm run validate",
    "npm run check",
    "npm test",
    "npm run package",
    "npm run verify:package",
    "git diff --check",
    "Toolbar action opens BrowseVault",
    "Long URLs and titles stay inside the viewport",
    "creates another BrowseVault tab instead of enforcing one global app tab",
    "Deleting a vault record in one BrowseVault tab refreshes another open BrowseVault tab",
    "Theme, accent, contrast, text size, date display, and default result-limit settings save and apply",
    "JSON backup export completes and reports backup health, restore confidence, and self-test status",
    "Chrome Web Store screenshots match the current UI and store listing copy",
    "Result: Not run",
    "git rev-parse --short=7 HEAD",
    "Run `npm run release:ready` after filling this checklist"
  ]) {
    assert(manualBrowserQa.includes(expected), `Manual browser QA checklist missing required check: ${expected}`);
  }

  const playbookAudit = fs.readFileSync(
    path.join(root, "docs", "release", "browser-extension-playbook-audit.md"),
    "utf8"
  );
  for (const expected of [
    "Product shape",
    "Repository shape",
    "Store listing copy",
    "Localization baseline",
    "Open source and license",
    "Privacy and permissions",
    "UI expectations",
    "Reviewer notes",
    "Release package checks",
    "Codex protocol",
    "Target-browser load-unpacked check",
    "Manual required",
    "npm run release:ready",
    "current Git commit",
    "Reference sync keeps local playbooks current",
    "Load the unpacked extension in the target browser",
    "Do not use automated Chrome or Playwright runs against a live Chrome profile",
    "do not create or target named personal Chrome profiles such as `Your Chrome`"
  ]) {
    assert(playbookAudit.includes(expected), `Browser extension playbook audit missing: ${expected}`);
  }

  const decisionRecords = fs.readFileSync(path.join(root, "docs", "project", "decision-records.md"), "utf8");
  for (const expected of [
    "Keep BrowseVault Browser QA Manual In This Workspace",
    "Repo-owned QA must not launch or attach to Chrome",
    "Target-browser QA is manual and recorded in the release checklist",
    "Chrome local-storage revision fallback"
  ]) {
    assert(decisionRecords.includes(expected), `Decision records missing browser-safety decision: ${expected}`);
  }

  const vaultInvalidation = fs.readFileSync(
    path.join(root, "src", "features", "app-shell", "core", "vault-invalidation.js"),
    "utf8"
  );
  for (const expected of [
    "VAULT_INVALIDATION_STORAGE_KEY",
    "storageNotifier",
    "setLocalStorage",
    "onLocalStorageChanged",
    "markSeen"
  ]) {
    assert(vaultInvalidation.includes(expected), `Vault invalidation missing cross-tab fallback guardrail: ${expected}`);
  }

  const vaultInvalidationTests = fs.readFileSync(
    path.join(root, "test", "features", "app-shell", "app-shell-vault-invalidation.test.js"),
    "utf8"
  );
  for (const expected of [
    "storage revision fallback",
    "refreshes from storage changes and ignores duplicate channel delivery",
    "background vault notifier can publish through storage without a channel"
  ]) {
    assert(vaultInvalidationTests.includes(expected), `Vault invalidation tests missing storage fallback coverage: ${expected}`);
  }

  const storeMedia = fs.readFileSync(path.join(root, "docs", "chrome-web-store-media.md"), "utf8");
  for (const expected of [
    "current UI",
    "store-listing/chrome-web-store/listing/en.md",
    "manual-browser-qa-checklist.md",
    "01-history-search.jpg",
    "02-quick-open.jpg",
    "03-backup-health.jpg",
    "04-rules-cleanup.jpg",
    "05-settings-privacy.jpg",
    "small-promo.png",
    "marquee-promo.png",
    "both promo images still match the current name",
    "no analytics",
    "no host permissions",
    "no remote code"
  ]) {
    assert(storeMedia.includes(expected), `Chrome Web Store media review doc missing: ${expected}`);
  }
}

function cliAssert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validatePlaybookCompliance(process.cwd(), cliAssert);
  console.log("Playbook compliance checked.");
}
