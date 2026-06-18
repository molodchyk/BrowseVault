import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveInsightDetails,
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
      backupSaveMode: "surprise-folder",
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
      backupSaveMode: "downloads",
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
  assert.equal(formatBackupSelfTest({ status: "failed", restoreCountMatches: false }), "Failed restore rows");
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
      storageText: "Not checked yet",
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
      },
      lastStorageSelfCheck: {
        checkedAt: "2026-06-16T09:30:00.000Z",
        status: "passed"
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
  assert.match(status.storageText, /^Passed 2026-06-16 \d{2}:30$/);
  assert.equal(status.vaultText, "0 active · 0 stored");
  assert.equal(status.tombstoneText, "No deleted tombstones");
});

test("archiveHealthDetails warns when synced archive has no storage self-check", () => {
  const status = archiveHealthDetails({
    lastChromeSync: {
      stored: 12,
      syncedAt: "2026-06-16T09:00:00.000Z"
    }
  });

  assert.equal(status.healthText, "Storage check not run");
  assert.equal(status.isWarning, true);
  assert.equal(status.isOk, false);
  assert.equal(status.storageText, "Not checked yet");
});

test("archiveHealthDetails accepts localized empty recorder labels", () => {
  const status = archiveHealthDetails({}, {
    labels: {
      archiveNoTombstones: "Keine geloeschten Merker",
      archiveNotChecked: "Noch nicht geprueft",
      archiveNotRecorded: "Nicht aufgezeichnet",
      archiveNotSynced: "Noch nicht synchronisiert",
      archiveWaitingForVisit: "Wartet auf naechsten Besuch"
    }
  });

  assert.equal(status.startupText, "Nicht aufgezeichnet");
  assert.equal(status.syncText, "Noch nicht synchronisiert");
  assert.equal(status.captureText, "Wartet auf naechsten Besuch");
  assert.equal(status.storageText, "Noch nicht geprueft");
  assert.equal(status.tombstoneText, "Keine geloeschten Merker");
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
  assert.equal(status.storageText, "Not checked yet");
  assert.equal(status.vaultText, "1 missing URL · 1 bad time · 3 duplicate active");
  assert.equal(status.tombstoneText, "2 deleted tombstones");
});

test("archiveInsightDetails formats secondary archive summaries", () => {
  const details = archiveInsightDetails(
    {
      activeDays: 2,
      averageVisitsPerActiveDay: 2.5,
      oldestVisitTime: new Date(2026, 5, 16, 10, 0).getTime(),
      newestVisitTime: new Date(2026, 5, 17, 11, 0).getTime(),
      topDomains: [
        { domain: "docs.example", count: 3 },
        { domain: "github.com", count: 2 }
      ],
      busiestDays: [
        { day: "2026-06-17", count: 4 }
      ]
    },
    {
      dateFormat: "iso"
    }
  );

  assert.deepEqual(details, {
    topDomainsText: "docs.example (3) · github.com (2)",
    busiestDayText: "2026-06-17 · 4 visits",
    activeDaysText: "2 days · 2.5 visits/day",
    dateRangeText: "2026-06-16 to 2026-06-17"
  });

  assert.deepEqual(archiveInsightDetails({}, { dateFormat: "iso" }), {
    topDomainsText: "No domains yet",
    busiestDayText: "No visits yet",
    activeDaysText: "No active days yet",
    dateRangeText: "No visits yet"
  });
});

test("archiveInsightDetails accepts localized empty insight labels", () => {
  assert.deepEqual(archiveInsightDetails({}, {
    labels: {
      noActiveDaysYet: "Noch keine aktiven Tage",
      noDomainsYet: "Noch keine Domains",
      noVisitsYet: "Noch keine Besuche"
    }
  }), {
    topDomainsText: "Noch keine Domains",
    busiestDayText: "Noch keine Besuche",
    activeDaysText: "Noch keine aktiven Tage",
    dateRangeText: "Noch keine Besuche"
  });
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

test("backupStatusDetails accepts localized empty backup labels", () => {
  const status = backupStatusDetails(null, {
    labels: {
      backupChecksumUnavailable: "Nicht verfuegbar",
      backupHealthEmpty: "Noch keine Sicherung",
      backupNextAfterFirst: "Nach erster Sicherung",
      backupReminderOff: "Aus",
      statBackupEmpty: "Nie"
    },
    reminderDays: 0
  });

  assert.equal(status.healthText, "Noch keine Sicherung");
  assert.equal(status.lastText, "Nie");
  assert.equal(status.nextText, "Aus");
  assert.equal(status.checksumText, "Nicht verfuegbar");

  const disabled = backupStatusDetails(
    { exportedAt: "2026-06-01T00:00:00.000Z", format: "json", records: 12 },
    {
      labels: {
        backupReminderOff: "Aus"
      },
      reminderDays: 0
    }
  );
  assert.equal(disabled.nextText, "Aus");
});
