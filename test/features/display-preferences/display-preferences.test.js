import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveHealthDetails,
  backupStatusDetails,
  clampBackupReminderDays,
  clampResultLimit,
  contrastDatasetValue,
  formatBackupSelfTest,
  formatFileSize,
  formatShortDate,
  localDayKey,
  normalizePreferences,
  restorableBackupMetadata,
  textSizeDatasetValue,
  themeDatasetValue
} from "../../../src/features/display-preferences/core/preferences.js";

test("normalizePreferences falls back for unsupported values and clamps limits", () => {
  assert.deepEqual(
    normalizePreferences({
      theme: "neon",
      accent: "blue",
      contrast: "low",
      textSize: "giant",
      dateFormat: "dmy",
      defaultLimit: "999999",
      backupReminderDays: "999",
      backupFilenamePrefix: "Team Backup:/2026",
      backupFilenameTemplate: "{date}/{prefix}/{kind}"
    }),
    {
      theme: "system",
      accent: "blue",
      contrast: "standard",
      textSize: "standard",
      dateFormat: "dmy",
      defaultLimit: 50000,
      backupReminderDays: 365,
      backupFilenamePrefix: "Team-Backup-2026",
      backupFilenameTemplate: "{date}-{prefix}-{kind}"
    }
  );
});

test("clampResultLimit handles empty, low, high, and rounded values", () => {
  assert.equal(clampResultLimit("", 750), 750);
  assert.equal(clampResultLimit(1), 25);
  assert.equal(clampResultLimit(50001), 50000);
  assert.equal(clampResultLimit(124.6), 125);
});

test("clampBackupReminderDays handles disabled, high, empty, and rounded values", () => {
  assert.equal(clampBackupReminderDays("", 14), 14);
  assert.equal(clampBackupReminderDays(0), 0);
  assert.equal(clampBackupReminderDays(366), 365);
  assert.equal(clampBackupReminderDays(14.6), 15);
});

test("formatShortDate supports explicit non-US formats", () => {
  const timestamp = new Date(2026, 5, 16, 12, 30).getTime();
  assert.equal(formatShortDate(timestamp, "iso"), "2026-06-16");
  assert.equal(formatShortDate(timestamp, "dmy"), "16/06/2026");
  assert.equal(formatShortDate(timestamp, "mdy"), "06/16/2026");
  assert.equal(formatShortDate(timestamp, "ymd"), "2026/06/16");
  assert.equal(localDayKey(timestamp), "2026-06-16");
});

test("formatFileSize summarizes recorded backup byte counts", () => {
  assert.equal(formatFileSize(undefined), "Not recorded");
  assert.equal(formatFileSize(-1), "Not recorded");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(1536), "1.5 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5 MB");
});

test("formatBackupSelfTest summarizes passed, failed, and missing checks", () => {
  assert.equal(formatBackupSelfTest(null), "Not tested");
  assert.equal(formatBackupSelfTest({ status: "passed", records: 1 }), "Passed 1 record");
  assert.equal(formatBackupSelfTest({ status: "passed", records: 12 }), "Passed 12 records");
  assert.equal(formatBackupSelfTest({ status: "failed", checksum: "mismatch" }), "Failed checksum");
  assert.equal(formatBackupSelfTest({ status: "failed", countMatches: false }), "Failed count");
  assert.equal(formatBackupSelfTest({ status: "failed" }), "Failed");
});

test("restorableBackupMetadata accepts only JSON backup metadata", () => {
  const jsonBackup = {
    exportedAt: "2026-06-16T12:00:00.000Z",
    format: "json"
  };

  assert.equal(restorableBackupMetadata(jsonBackup), jsonBackup);
  assert.equal(restorableBackupMetadata({ exportedAt: jsonBackup.exportedAt, format: "csv" }), null);
  assert.equal(restorableBackupMetadata({ exportedAt: jsonBackup.exportedAt, format: "html" }), null);
  assert.equal(restorableBackupMetadata({ exportedAt: jsonBackup.exportedAt }), null);
  assert.equal(restorableBackupMetadata(null), null);
});

test("themeDatasetValue leaves system theme to CSS media queries", () => {
  assert.equal(themeDatasetValue("system"), "");
  assert.equal(themeDatasetValue("dark"), "dark");
});

test("display dataset helpers leave standard readability settings implicit", () => {
  assert.equal(contrastDatasetValue("standard"), "");
  assert.equal(contrastDatasetValue("high"), "high");
  assert.equal(contrastDatasetValue("unknown"), "");
  assert.equal(textSizeDatasetValue("standard"), "");
  assert.equal(textSizeDatasetValue("large"), "large");
  assert.equal(textSizeDatasetValue("unknown"), "");
});

test("archiveHealthDetails summarizes startup, sync, and live capture metadata", () => {
  assert.deepEqual(
    archiveHealthDetails({}, { dateFormat: "iso" }),
    {
      healthText: "Archive sync not run yet",
      isWarning: true,
      isOk: false,
      startupText: "Not recorded",
      syncText: "Not synced yet",
      captureText: "Waiting for next visit",
      vaultText: "0 active · 0 stored",
      tombstoneText: "No deleted tombstones"
    }
  );

  const status = archiveHealthDetails(
    {
      lastStartedAt: "2026-06-16T08:00:00.000Z",
      lastChromeSync: {
        stored: 42,
        syncedAt: "2026-06-16T09:00:00.000Z"
      },
      lastLiveCapture: {
        capturedAt: "2026-06-16T10:00:00.000Z",
        url: "https://www.example.com/page"
      }
    },
    {
      dateFormat: "iso"
    }
  );

  assert.equal(status.healthText, "Archive recording ready");
  assert.equal(status.isOk, true);
  assert.match(status.startupText, /^2026-06-16 \d{2}:00$/);
  assert.match(status.syncText, /^2026-06-16 \d{2}:00 · 42 stored$/);
  assert.match(status.captureText, /^2026-06-16 \d{2}:00 · example\.com$/);
  assert.equal(status.vaultText, "0 active · 0 stored");
  assert.equal(status.tombstoneText, "No deleted tombstones");
});

test("archiveHealthDetails warns about vault data issues", () => {
  const status = archiveHealthDetails(
    {
      lastChromeSync: {
        stored: 12,
        syncedAt: "2026-06-16T09:00:00.000Z"
      }
    },
    {
      vaultHealth: {
        activeRecords: 10,
        storedRows: 12,
        deletedRecords: 2,
        missingUrlRecords: 1,
        invalidTimeRecords: 1,
        duplicateActiveRecords: 3,
        issueRecords: 5
      }
    }
  );

  assert.equal(status.healthText, "Vault data needs review");
  assert.equal(status.isWarning, true);
  assert.equal(status.isOk, false);
  assert.equal(status.vaultText, "1 missing URL · 1 bad time · 3 duplicate active");
  assert.equal(status.tombstoneText, "2 deleted tombstones");
});

test("backupStatusDetails summarizes missing, fresh, and stale backups", () => {
  assert.deepEqual(backupStatusDetails(null), {
    healthText: "No backup yet",
    isWarning: true,
    isOk: false,
    lastText: "Never",
    nextText: "After first backup",
    formatText: "-",
    recordsText: "0",
    sizeText: "-",
    selfTestText: "-",
    checksumText: "Not available"
  });

  const exportedAt = "2026-06-01T00:00:00.000Z";
  const fresh = backupStatusDetails(
    {
      exportedAt,
      format: "json",
      records: 12,
      sizeBytes: 1536,
      selfTest: {
        records: 12,
        status: "passed"
      },
      sha256: "1234567890abcdef1234567890abcdef"
    },
    {
      dateFormat: "iso",
      now: Date.parse("2026-06-16T00:00:00.000Z"),
      staleDays: 30
    }
  );

  assert.equal(fresh.healthText, "Backup current");
  assert.equal(fresh.isOk, true);
  assert.match(fresh.nextText, /^2026-07-01 \d{2}:\d{2}$/);
  assert.equal(fresh.formatText, "JSON");
  assert.equal(fresh.recordsText, "12");
  assert.equal(fresh.sizeText, "1.5 KB");
  assert.equal(fresh.selfTestText, "Passed 12 records");
  assert.equal(fresh.checksumText, "1234567890ab...90abcdef");

  const due = backupStatusDetails(
    { exportedAt, format: "json", records: 1 },
    {
      now: Date.parse("2026-07-01T00:00:00.000Z"),
      staleDays: 30
    }
  );
  assert.equal(due.healthText, "Backup due after 30 days");
  assert.equal(due.isWarning, true);

  const disabled = backupStatusDetails(
    { exportedAt, format: "json", records: 12 },
    {
      dateFormat: "iso",
      reminderDays: 0
    }
  );
  assert.equal(disabled.healthText, "Backup reminder off");
  assert.equal(disabled.nextText, "Off");
  assert.equal(disabled.isOk, false);
});
