import test from "node:test";
import assert from "node:assert/strict";
import { createBackupActionsHarness } from "./backup-actions-harness.js";

function messageGetter(messages) {
  return (key, substitutions = []) => {
    const value = messages.get(key);
    if (!value) {
      return "";
    }
    return substitutions.reduce(
      (text, substitution, index) => text.replace(`$${index + 1}`, substitution),
      value
    );
  };
}

test("importFromFile stages valid archives and switches to the backup panel", async () => {
  const archive = { visits: [{ id: "visit-1" }] };
  const analysis = { validRows: 1, rules: 0 };
  const integrity = { checked: true, ok: true };
  const file = {
    name: "browsevault.json",
    text: async () => "{\"visits\":[]}"
  };
  const { actions, appState, calls, statuses } = createBackupActionsHarness({
    services: {
      analyzeImportArchive: async (input) => {
        assert.equal(input, archive);
        return analysis;
      },
      archiveFromFileText: (inputFile, text) => {
        assert.equal(inputFile, file);
        assert.equal(text, "{\"visits\":[]}");
        return archive;
      },
      verifyArchiveIntegrity: async (input) => {
        assert.equal(input, archive);
        return integrity;
      }
    }
  });

  await actions.importFromFile(file);

  assert.deepEqual(statuses, ["Reading archive", "Review import preview"]);
  assert.deepEqual(appState.stagedImport, {
    archive,
    analysis,
    fileName: "browsevault.json",
    integrity
  });
  assert.deepEqual(calls[0][0], "renderImportPreview");
  assert.equal(calls[0][2], appState.stagedImport);
  assert.deepEqual(calls[1], ["switchTab", "backup"]);
});

test("import actions can localize staging, checksum confirmation, and import summary", async () => {
  const archive = { visits: [{ id: "visit-1" }] };
  const analysis = { validRows: 2, rules: 2 };
  const integrity = { checked: true, ok: false };
  const confirmations = [];
  const file = {
    name: "localized.json",
    text: async () => "{\"visits\":[]}"
  };
  const getMessage = messageGetter(new Map([
    ["statusReadingArchive", "lese archiv"],
    ["statusReviewImportPreview", "vorschau pruefen"],
    ["confirmImportChecksumMismatch", "checksum trotzdem importieren?"],
    ["statusImportingArchive", "importiere archiv"],
    ["importStatusRecordMany", "$1 eintraege"],
    ["importStatusRuleMany", " und $1 regeln"],
    ["importStatusChecksumWarning", " nach warnung"],
    ["importStatusDuplicateMany", "; $1 duplikate zusammengefuehrt"],
    ["statusImportedArchive", "fertig: $1$2$3$4"]
  ]));
  const { actions, statuses } = createBackupActionsHarness({
    getMessage,
    services: {
      analyzeImportArchive: async () => analysis,
      archiveFromFileText: () => archive,
      appendActivityLog: async () => {},
      confirmAction: (message) => {
        confirmations.push(message);
        return true;
      },
      importArchive: async () => ({
        importedAt: "2026-06-16T12:00:00.000Z",
        visits: 2,
        validRows: 5,
        duplicateRows: 3,
        rules: 2
      }),
      verifyArchiveIntegrity: async () => integrity
    }
  });

  await actions.importFromFile(file);
  await actions.confirmStagedImport();

  assert.deepEqual(confirmations, ["checksum trotzdem importieren?"]);
  assert.deepEqual(statuses, [
    "lese archiv",
    "vorschau pruefen",
    "importiere archiv",
    "fertig: 2 eintraege und 2 regeln nach warnung; 3 duplikate zusammengefuehrt"
  ]);
});

test("confirmStagedImport imports after checksum confirmation and clears staged state", async () => {
  const archive = { visits: [{ id: "visit-1" }] };
  const activity = [];
  const { actions, appState, calls, notifications, statuses } = createBackupActionsHarness({
    stagedImport: {
      archive,
      integrity: { checked: true, ok: false }
    },
    services: {
      appendActivityLog: async (...args) => activity.push(args),
      confirmAction: () => true,
      importArchive: async (input) => {
        assert.equal(input, archive);
        return {
          importedAt: "2026-06-16T12:00:00.000Z",
          visits: 2,
          validRows: 3,
          duplicateRows: 1,
          rules: 1
        };
      }
    }
  });

  await actions.confirmStagedImport();

  assert.equal(appState.stagedImport, null);
  assert.deepEqual(statuses, [
    "Importing archive",
    "Imported 2 records and 1 rule after checksum warning; 1 duplicate row merged"
  ]);
  assert.deepEqual(calls.map((call) => Array.isArray(call) ? call[0] : call), [
    "renderImportPreview",
    "renderRules",
    "runSearch",
    "refreshStats"
  ]);
  assert.deepEqual(notifications, ["vault-import"]);
  assert.deepEqual(activity, [[{
    type: "import",
    label: "Archive imported",
    count: 2,
    detail: "1 rule; 1 duplicate row merged",
    occurredAt: "2026-06-16T12:00:00.000Z"
  }]]);
});
