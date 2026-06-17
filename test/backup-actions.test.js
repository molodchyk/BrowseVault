import test from "node:test";
import assert from "node:assert/strict";
import {
  backupImportPreviewElements,
  createBackupActions,
  downloadText
} from "../src/features/backup-import/ui/actions.js";

function previewElements() {
  return {
    importPreview: { id: "import-preview" },
    importPreviewTitle: { id: "import-preview-title" },
    importValid: { id: "import-valid" },
    importNew: { id: "import-new" },
    importExisting: { id: "import-existing" },
    importDuplicates: { id: "import-duplicates" },
    importHealth: { id: "import-health" },
    importPreviewNote: { id: "import-preview-note" },
    confirmImport: { id: "confirm-import" }
  };
}

function createHarness({
  preferences = {
    backupFilenamePrefix: "browsevault"
  },
  selected = [],
  stagedImport = null,
  services = {}
} = {}) {
  const statuses = [];
  const calls = [];
  const appState = { preferences, stagedImport };
  const actions = createBackupActions({
    appState,
    elements: previewElements(),
    refreshStats: async () => calls.push("refreshStats"),
    renderRules: async () => calls.push("renderRules"),
    runSearch: async () => calls.push("runSearch"),
    selectedResults: async () => selected,
    services: {
      renderImportPreview: (...args) => calls.push(["renderImportPreview", ...args]),
      ...services
    },
    setStatus: (message) => statuses.push(message),
    switchTab: (tabName) => calls.push(["switchTab", tabName])
  });

  return { actions, appState, calls, statuses };
}

test("backupImportPreviewElements maps app shell elements for import preview rendering", () => {
  const elements = previewElements();
  assert.deepEqual(backupImportPreviewElements(elements), elements);
});

test("downloadText returns the generated blob size", () => {
  const clicks = [];
  const revoked = [];
  const runtime = {
    Blob: globalThis.Blob,
    URL: {
      createObjectURL: (blob) => {
        assert.equal(blob.size, 5);
        return "blob:browsevault-test";
      },
      revokeObjectURL: (url) => revoked.push(url)
    },
    document: {
      createElement: (tagName) => {
        assert.equal(tagName, "a");
        return {
          click() {
            clicks.push({
              download: this.download,
              href: this.href
            });
          }
        };
      }
    }
  };

  assert.equal(downloadText("history.txt", "text/plain", "hello", runtime), 5);
  assert.deepEqual(clicks, [{ download: "history.txt", href: "blob:browsevault-test" }]);
  assert.deepEqual(revoked, ["blob:browsevault-test"]);
});

test("exportAll downloads an integrity-protected archive and records backup metadata", async () => {
  const archive = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    counts: { visits: 2 },
    visits: [{ id: "visit-1" }, { id: "visit-2" }]
  };
  const downloaded = [];
  const metadata = [];
  const { actions, calls, statuses } = createHarness({
    services: {
      attachArchiveIntegrity: async (input) => ({
        ...input,
        integrity: { sha256: "abc123" }
      }),
      downloadJson: (...args) => {
        downloaded.push(args);
        return 2048;
      },
      createBackupSelfTest: async () => ({
        checkedAt: "2026-06-16T12:00:00.000Z",
        checksum: "verified",
        countMatches: true,
        expectedRecords: 2,
        records: 2,
        status: "passed"
      }),
      exportArchive: async () => archive,
      setMeta: async (...args) => metadata.push(args)
    }
  });

  await actions.exportAll();

  assert.deepEqual(statuses, ["Preparing archive", "Exported archive"]);
  assert.deepEqual(downloaded, [[
    "browsevault-archive-2026-06-16.json",
    {
      ...archive,
      integrity: { sha256: "abc123" }
    }
  ]]);
  assert.deepEqual(metadata, [[
    "lastBackup",
    {
      exportedAt: archive.exportedAt,
      format: "json",
      records: 2,
      sizeBytes: 2048,
      selfTest: {
        checkedAt: "2026-06-16T12:00:00.000Z",
        checksum: "verified",
        countMatches: true,
        expectedRecords: 2,
        records: 2,
        status: "passed"
      },
      sha256: "abc123"
    }
  ]]);
  assert.deepEqual(calls, ["refreshStats"]);
});

test("full CSV and HTML exports use the configured backup filename prefix", async () => {
  const archive = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    counts: { visits: 1 },
    visits: [{ id: "visit-1" }]
  };
  const downloaded = [];
  const metadata = [];
  const { actions, calls, statuses } = createHarness({
    preferences: {
      backupFilenamePrefix: "Client Reports"
    },
    services: {
      downloadText: (...args) => {
        downloaded.push(args);
        return 512;
      },
      exportArchive: async () => archive,
      setMeta: async (...args) => metadata.push(args),
      visitsToCsv: () => "csv",
      visitsToHtml: () => "html"
    }
  });

  await actions.exportCsv();
  await actions.exportHtml();

  assert.deepEqual(statuses, ["Preparing CSV", "Exported CSV", "Preparing HTML", "Exported HTML"]);
  assert.deepEqual(downloaded.map(([filename]) => filename), [
    "Client-Reports-history-2026-06-16.csv",
    "Client-Reports-history-2026-06-16.html"
  ]);
  assert.deepEqual(metadata.map((entry) => entry[1].sizeBytes), [512, 512]);
  assert.deepEqual(calls, ["refreshStats", "refreshStats"]);
});

test("selected exports use the configured backup filename prefix", async () => {
  const downloadedJson = [];
  const downloadedText = [];
  const selected = [{ id: "visit-1" }];
  const { actions, statuses } = createHarness({
    preferences: {
      backupFilenamePrefix: "Research Backup"
    },
    selected,
    services: {
      attachArchiveIntegrity: async (input) => ({
        ...input,
        integrity: { sha256: "abc123" }
      }),
      downloadJson: (...args) => downloadedJson.push(args),
      downloadText: (...args) => downloadedText.push(args),
      exportArchive: async (items) => ({
        exportedAt: "2026-06-16T12:00:00.000Z",
        counts: { visits: items.length },
        visits: items
      }),
      now: () => new Date("2026-06-16T12:00:00.000Z"),
      visitsToCsv: () => "csv",
      visitsToHtml: () => "html"
    }
  });

  await actions.exportSelected();
  await actions.exportSelectedCsv();
  await actions.exportSelectedHtml();

  assert.deepEqual(statuses, [
    "Exported 1 selected records as JSON",
    "Exported 1 selected records as CSV",
    "Exported 1 selected records as HTML"
  ]);
  assert.deepEqual(downloadedJson.map(([filename]) => filename), [
    "Research-Backup-selected-2026-06-16.json"
  ]);
  assert.deepEqual(downloadedText.map(([filename]) => filename), [
    "Research-Backup-selected-2026-06-16.csv",
    "Research-Backup-selected-2026-06-16.html"
  ]);
});

test("exportAll stops before download when generated archive self-test fails", async () => {
  const downloaded = [];
  const metadata = [];
  const { actions, calls, statuses } = createHarness({
    services: {
      attachArchiveIntegrity: async (input) => ({
        ...input,
        integrity: { sha256: "abc123" }
      }),
      createBackupSelfTest: async () => ({
        checksum: "mismatch",
        countMatches: true,
        records: 2,
        status: "failed"
      }),
      downloadJson: (...args) => downloaded.push(args),
      exportArchive: async () => ({
        exportedAt: "2026-06-16T12:00:00.000Z",
        counts: { visits: 2 },
        visits: [{ id: "visit-1" }, { id: "visit-2" }]
      }),
      setMeta: async (...args) => metadata.push(args)
    }
  });

  await actions.exportAll();

  assert.deepEqual(statuses, ["Preparing archive", "Backup self-test failed"]);
  assert.deepEqual(downloaded, []);
  assert.deepEqual(metadata, []);
  assert.deepEqual(calls, []);
});

test("selected exports require at least one selected record", async () => {
  const downloaded = [];
  const { actions, statuses } = createHarness({
    selected: [],
    services: {
      downloadText: (...args) => downloaded.push(args)
    }
  });

  await actions.exportSelectedCsv();

  assert.deepEqual(statuses, ["Select records first"]);
  assert.deepEqual(downloaded, []);
});

test("importFromFile stages valid archives and switches to the backup panel", async () => {
  const archive = { visits: [{ id: "visit-1" }] };
  const analysis = { validRows: 1, rules: 0 };
  const integrity = { checked: true, ok: true };
  const file = {
    name: "browsevault.json",
    text: async () => "{\"visits\":[]}"
  };
  const { actions, appState, calls, statuses } = createHarness({
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

test("confirmStagedImport imports after checksum confirmation and clears staged state", async () => {
  const archive = { visits: [{ id: "visit-1" }] };
  const { actions, appState, calls, statuses } = createHarness({
    stagedImport: {
      archive,
      integrity: { checked: true, ok: false }
    },
    services: {
      confirmAction: () => true,
      importArchive: async (input) => {
        assert.equal(input, archive);
        return { visits: 3, rules: 1 };
      }
    }
  });

  await actions.confirmStagedImport();

  assert.equal(appState.stagedImport, null);
  assert.deepEqual(statuses, [
    "Importing archive",
    "Imported 3 records and 1 rule after checksum warning"
  ]);
  assert.deepEqual(calls.map((call) => Array.isArray(call) ? call[0] : call), [
    "renderImportPreview",
    "refreshStats",
    "renderRules",
    "runSearch"
  ]);
});
