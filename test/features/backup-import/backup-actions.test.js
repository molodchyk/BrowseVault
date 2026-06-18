import test from "node:test";
import assert from "node:assert/strict";
import {
  backupImportPreviewElements,
  downloadText
} from "../../../src/features/backup-import/ui/actions.js";
import {
  createBackupActionsHarness,
  previewElements
} from "./backup-actions-harness.js";

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

test("backupImportPreviewElements maps app shell elements for import preview rendering", () => {
  const elements = previewElements();
  assert.deepEqual(backupImportPreviewElements(elements), elements);
});

test("downloadText returns the generated blob size", async () => {
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

  assert.equal(await downloadText("history.txt", "text/plain", "hello", {}, runtime), 5);
  assert.deepEqual(clicks, [{ download: "history.txt", href: "blob:browsevault-test" }]);
  assert.deepEqual(revoked, ["blob:browsevault-test"]);
});

test("downloadText can ask Chrome for a Save As location", async () => {
  const downloads = [];
  const revoked = [];
  const runtime = {
    Blob: globalThis.Blob,
    URL: {
      createObjectURL: (blob) => {
        assert.equal(blob.size, 5);
        return "blob:browsevault-save-as";
      },
      revokeObjectURL: (url) => revoked.push(url)
    },
    chrome: {
      downloads: {
        download(options, callback) {
          downloads.push(options);
          callback(42);
        }
      },
      runtime: {}
    },
    document: {
      createElement() {
        throw new Error("anchor fallback should not be used");
      }
    }
  };

  assert.equal(await downloadText("history.txt", "text/plain", "hello", { saveMode: "ask" }, runtime), 5);
  assert.deepEqual(downloads, [{
    filename: "history.txt",
    saveAs: true,
    url: "blob:browsevault-save-as"
  }]);
  assert.deepEqual(revoked, ["blob:browsevault-save-as"]);
});

test("exportAll downloads an integrity-protected archive and records backup metadata", async () => {
  const archive = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    counts: { visits: 2 },
    visits: [{ id: "visit-1" }, { id: "visit-2" }]
  };
  const downloaded = [];
  const metadata = [];
  const activity = [];
  const { actions, calls, statuses } = createBackupActionsHarness({
    services: {
      appendActivityLog: async (...args) => activity.push(args),
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
        restorableRecords: 2,
        restoreCountMatches: true,
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
    },
    { saveMode: "downloads" }
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
        restorableRecords: 2,
        restoreCountMatches: true,
        status: "passed"
      },
      sha256: "abc123"
    }
  ]]);
  assert.deepEqual(activity, [[{
    type: "backup",
    label: "JSON backup exported",
    count: 2,
    detail: "2048 bytes",
    occurredAt: archive.exportedAt
  }]]);
  assert.deepEqual(calls, ["refreshStats"]);
});

test("export actions can localize backup and result statuses", async () => {
  const archive = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    counts: { visits: 2 },
    visits: [{ id: "visit-1" }, { id: "visit-2" }]
  };
  const getMessage = messageGetter(new Map([
    ["statusPreparingArchive", "Bereite Archiv vor"],
    ["statusExportedArchive", "Archiv exportiert"],
    ["statusExportedSelectedCsv", "$1 ausgewaehlte als CSV exportiert"],
    ["statusPreparingResultHtml", "Bereite Ergebnis-HTML vor"],
    ["statusExportedMatchingHtml", "$1 Treffer als HTML exportiert"],
    ["statusNoMatchingRecordsToExport", "Keine Treffer zum Exportieren"]
  ]));
  const selected = [{ id: "selected-1" }, { id: "selected-2" }];
  const matching = [{ id: "match-1" }, { id: "match-2" }, { id: "match-3" }];
  const harness = createBackupActionsHarness({
    getMessage,
    selected,
    searchVisits: async () => ({ results: matching, total: matching.length }),
    services: {
      attachArchiveIntegrity: async (input) => ({
        ...input,
        integrity: { sha256: "abc123" }
      }),
      createBackupSelfTest: async () => ({
        checksum: "verified",
        countMatches: true,
        records: 2,
        status: "passed"
      }),
      downloadJson: async () => 512,
      downloadText: async () => 256,
      exportArchive: async (items) => items
        ? {
          exportedAt: archive.exportedAt,
          counts: { visits: items.length },
          visits: items
        }
        : archive,
      now: () => new Date("2026-06-16T12:00:00.000Z"),
      setMeta: async () => {},
      visitsToCsv: () => "csv",
      visitsToHtml: () => "html"
    }
  });

  await harness.actions.exportAll();
  await harness.actions.exportSelectedCsv();
  await harness.actions.exportFilteredResultsHtml();

  assert.deepEqual(harness.statuses, [
    "Bereite Archiv vor",
    "Archiv exportiert",
    "2 ausgewaehlte als CSV exportiert",
    "Bereite Ergebnis-HTML vor",
    "3 Treffer als HTML exportiert"
  ]);

  const empty = createBackupActionsHarness({
    getMessage,
    searchVisits: async () => ({ results: [], total: 0 })
  });
  await empty.actions.exportFilteredResultsHtml();
  assert.deepEqual(empty.statuses, [
    "Bereite Ergebnis-HTML vor",
    "Keine Treffer zum Exportieren"
  ]);
});

test("full CSV and HTML exports use filenames without changing backup metadata", async () => {
  const archive = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    counts: { visits: 1 },
    visits: [{ id: "visit-1" }]
  };
  const activity = [];
  const downloaded = [];
  const metadata = [];
  const { actions, calls, statuses } = createBackupActionsHarness({
    preferences: {
      backupFilenamePrefix: "Client Reports"
    },
    services: {
      appendActivityLog: async (...args) => activity.push(args),
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
  assert.deepEqual(metadata, []);
  assert.deepEqual(activity, [
    [{
      type: "export",
      label: "Full CSV exported",
      count: 1,
      detail: "512 bytes",
      occurredAt: archive.exportedAt
    }],
    [{
      type: "export",
      label: "Full HTML exported",
      count: 1,
      detail: "512 bytes",
      occurredAt: archive.exportedAt
    }]
  ]);
  assert.deepEqual(calls, ["refreshStats", "refreshStats"]);
});

test("exports use the configured backup filename template", async () => {
  const downloaded = [];
  const selected = [{ id: "visit-1" }];
  const { actions } = createBackupActionsHarness({
    preferences: {
      backupFilenamePrefix: "Client Reports",
      backupFilenameTemplate: "{date}-{time}-{prefix}-{kind}"
    },
    selected,
    services: {
      downloadText: (...args) => downloaded.push(args),
      now: () => new Date("2026-06-16T12:34:56.000Z"),
      visitsToCsv: () => "csv"
    }
  });

  await actions.exportSelectedCsv();

  assert.equal(downloaded[0][0], "2026-06-16-123456-Client-Reports-selected.csv");
});

test("selected exports use the configured backup filename prefix", async () => {
  const downloadedJson = [];
  const downloadedText = [];
  const selected = [{ id: "visit-1" }];
  const { actions, statuses } = createBackupActionsHarness({
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

test("filtered result exports search all current matches without changing backup metadata", async () => {
  const matching = [{ id: "visit-1" }, { id: "visit-2" }];
  const searchCalls = [];
  const downloadedJson = [];
  const downloadedText = [];
  const exportCalls = [];
  const metadata = [];
  const { actions, statuses } = createBackupActionsHarness({
    preferences: {
      backupFilenamePrefix: "Current Results"
    },
    getSortOrder: () => "oldest",
    getSearchText: () => "docs after:2026-01-01",
    searchVisits: async (...args) => {
      searchCalls.push(args);
      return { results: matching, total: 2 };
    },
    services: {
      attachArchiveIntegrity: async (input) => ({
        ...input,
        integrity: { sha256: "abc123" }
      }),
      downloadJson: (...args) => downloadedJson.push(args),
      downloadText: (...args) => downloadedText.push(args),
      exportArchive: async (...args) => {
        exportCalls.push(args);
        const [items] = args;
        return {
          exportedAt: "2026-06-16T12:00:00.000Z",
          counts: { visits: items.length },
          visits: items
        };
      },
      now: () => new Date("2026-06-16T12:00:00.000Z"),
      setMeta: async (...args) => metadata.push(args),
      visitsToCsv: (items) => `csv:${items.length}`,
      visitsToHtml: (items) => `html:${items.length}`
    }
  });

  await actions.exportFilteredResults();
  await actions.exportFilteredResultsCsv();
  await actions.exportFilteredResultsHtml();

  assert.deepEqual(searchCalls, [
    ["docs after:2026-01-01", { limit: "all", sortOrder: "oldest" }],
    ["docs after:2026-01-01", { limit: "all", sortOrder: "oldest" }],
    ["docs after:2026-01-01", { limit: "all", sortOrder: "oldest" }]
  ]);
  assert.deepEqual(exportCalls, [[matching, { preserveOrder: true }]]);
  assert.deepEqual(statuses, [
    "Preparing result archive",
    "Exported 2 matching records as JSON",
    "Preparing result CSV",
    "Exported 2 matching records as CSV",
    "Preparing result HTML",
    "Exported 2 matching records as HTML"
  ]);
  assert.deepEqual(downloadedJson.map(([filename]) => filename), [
    "Current-Results-results-2026-06-16.json"
  ]);
  assert.deepEqual(downloadedText.map(([filename, mimeType, text]) => [filename, mimeType, text]), [
    ["Current-Results-results-2026-06-16.csv", "text/csv", "csv:2"],
    ["Current-Results-results-2026-06-16.html", "text/html", "html:2"]
  ]);
  assert.deepEqual(metadata, []);
});

test("filtered result export reports empty current matches", async () => {
  const downloaded = [];
  const { actions, statuses } = createBackupActionsHarness({
    searchVisits: async () => ({ results: [], total: 0 }),
    services: {
      downloadJson: (...args) => downloaded.push(args)
    }
  });

  await actions.exportFilteredResults();

  assert.deepEqual(statuses, ["Preparing result archive", "No matching records to export"]);
  assert.deepEqual(downloaded, []);
});

test("exportAll stops before download when generated archive self-test fails", async () => {
  const downloaded = [];
  const metadata = [];
  const { actions, calls, statuses } = createBackupActionsHarness({
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
  const { actions, statuses } = createBackupActionsHarness({
    selected: [],
    services: {
      downloadText: (...args) => downloaded.push(args)
    }
  });

  await actions.exportSelectedCsv();

  assert.deepEqual(statuses, ["Select records first"]);
  assert.deepEqual(downloaded, []);
});
