import test from "node:test";
import assert from "node:assert/strict";
import {
  backupExportFilename,
  normalizeBackupFilenamePrefix,
  normalizeBackupFilenameTemplate
} from "../src/features/backup-import/core/backup-filenames.js";

test("normalizeBackupFilenamePrefix keeps export names filesystem-safe", () => {
  assert.equal(normalizeBackupFilenamePrefix("Client Reports"), "Client-Reports");
  assert.equal(normalizeBackupFilenamePrefix(" bad:/name*? "), "bad-name");
  assert.equal(normalizeBackupFilenamePrefix("..."), "browsevault");
  assert.equal(normalizeBackupFilenamePrefix("", "Team Backup"), "Team-Backup");
  assert.equal(normalizeBackupFilenamePrefix("x".repeat(80)), "x".repeat(48));
});

test("normalizeBackupFilenameTemplate keeps token templates filesystem-safe", () => {
  assert.equal(normalizeBackupFilenameTemplate(" {prefix} / {kind} / {date} "), "{prefix}-{kind}-{date}");
  assert.equal(normalizeBackupFilenameTemplate("..."), "{prefix}-{kind}-{date}");
  assert.equal(normalizeBackupFilenameTemplate("", "Team {date}"), "Team-{date}");
  assert.equal(normalizeBackupFilenameTemplate("x".repeat(150)), "x".repeat(120));
});

test("backupExportFilename builds dated filenames with safe prefixes", () => {
  assert.equal(
    backupExportFilename("Client Reports", "archive", "2026-06-16T12:00:00.000Z", "json"),
    "Client-Reports-archive-2026-06-16.json"
  );
  assert.equal(
    backupExportFilename("bad/name", "history", "not-a-date", "csv"),
    "bad-name-history-undated.csv"
  );
});

test("backupExportFilename applies custom filename templates", () => {
  assert.equal(
    backupExportFilename(
      "Client Reports",
      "archive",
      "2026-06-16T12:34:56.000Z",
      "json",
      "{date}-{time}-{prefix}-{kind}"
    ),
    "2026-06-16-123456-Client-Reports-archive.json"
  );
  assert.equal(
    backupExportFilename(
      "Client Reports",
      "history",
      "2026-06-16T12:34:56.000Z",
      ".CSV",
      "backup"
    ),
    "backup.csv"
  );
});
