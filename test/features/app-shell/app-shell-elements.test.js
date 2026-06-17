import test from "node:test";
import assert from "node:assert/strict";
import { collectAppElements } from "../../../src/features/app-shell/ui/elements.js";

const singularSelectors = [
  "query",
  "on-date",
  "after",
  "before",
  "limit",
  "search",
  "quick-search",
  "clear-search",
  "saved-searches",
  "apply-saved-search",
  "save-search",
  "delete-saved-search",
  "sync-chrome",
  "export-json",
  "export-csv",
  "export-html",
  "import-archive",
  "import-preview",
  "import-preview-title",
  "import-valid",
  "import-new",
  "import-existing",
  "import-duplicates",
  "import-health",
  "import-preview-note",
  "confirm-import",
  "cancel-import",
  "reset-vault",
  "open-selected",
  "copy-selected",
  "export-selected",
  "export-selected-csv",
  "export-selected-html",
  "blacklist-selected",
  "delete-vault",
  "delete-chrome",
  "undo-delete",
  "select-visible",
  "invert-visible",
  "select-filtered",
  "export-results",
  "export-results-csv",
  "export-results-html",
  "delete-results",
  "load-more",
  "load-all",
  "clear-selection",
  "result-count",
  "selected-count",
  "status",
  "results",
  "quick-results",
  "result-template",
  "quick-result-template",
  "stat-visits",
  "stat-domains",
  "stat-newest",
  "stat-backup",
  "backup-health",
  "backup-last",
  "backup-next",
  "backup-format",
  "backup-records",
  "backup-size",
  "backup-self-test",
  "backup-checksum",
  "activity-log",
  "archive-health",
  "archive-startup",
  "archive-sync",
  "archive-capture",
  "archive-vault",
  "archive-tombstones",
  "rule-domain",
  "add-blacklist",
  "add-whitelist",
  "rules-list",
  "retention-days",
  "preview-retention",
  "cleanup-retention",
  "preview-duplicates",
  "cleanup-duplicates",
  "pref-theme",
  "pref-accent",
  "pref-contrast",
  "pref-text-size",
  "pref-date-format",
  "pref-limit",
  "pref-backup-reminder",
  "pref-backup-prefix",
  "pref-backup-template",
  "open-native-history",
  "save-preferences"
];

function camelCase(id) {
  return id.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

test("collectAppElements queries the app shell selectors", () => {
  const queried = [];
  const queriedAll = [];
  const document = {
    querySelector(selector) {
      queried.push(selector);
      return { selector };
    },
    querySelectorAll(selector) {
      queriedAll.push(selector);
      return [{ selector, index: 0 }, { selector, index: 1 }];
    }
  };

  const elements = collectAppElements(document);

  assert.deepEqual(queriedAll, [".tab", ".tab-panel", "[data-date-shortcut]", ".requires-selection"]);
  assert.deepEqual(
    queried,
    singularSelectors.map((id) => `#${id}`)
  );
  assert.equal(elements.query.selector, "#query");
  assert.equal(elements.onDate.selector, "#on-date");
  assert.equal(elements.dateShortcuts.length, 2);
  assert.equal(elements.quickSearch.selector, "#quick-search");
  assert.equal(elements.savedSearches.selector, "#saved-searches");
  assert.equal(elements.importPreviewTitle.selector, "#import-preview-title");
  assert.equal(elements.backupChecksum.selector, "#backup-checksum");
  assert.equal(elements.backupNext.selector, "#backup-next");
  assert.equal(elements.backupSize.selector, "#backup-size");
  assert.equal(elements.backupSelfTest.selector, "#backup-self-test");
  assert.equal(elements.archiveHealth.selector, "#archive-health");
  assert.equal(elements.activityLog.selector, "#activity-log");
  assert.equal(elements.exportResults.selector, "#export-results");
  assert.equal(elements.savePreferences.selector, "#save-preferences");
  assert.equal(elements.tabs.length, 2);
  assert.equal(elements.panels.length, 2);
  assert.equal(elements.selectionActions.length, 2);

  for (const id of singularSelectors) {
    assert.ok(camelCase(id) in elements, `Missing element key for #${id}`);
  }
});
