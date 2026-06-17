import test from "node:test";
import assert from "node:assert/strict";
import {
  backupStatusDetails,
  clampBackupReminderDays,
  clampResultLimit,
  formatFileSize,
  formatShortDate,
  localDayKey,
  normalizePreferences,
  themeDatasetValue
} from "../src/features/display-preferences/core/preferences.js";

test("normalizePreferences falls back for unsupported values and clamps limits", () => {
  assert.deepEqual(
    normalizePreferences({
      theme: "neon",
      accent: "blue",
      dateFormat: "dmy",
      defaultLimit: "999999",
      backupReminderDays: "999"
    }),
    {
      theme: "system",
      accent: "blue",
      dateFormat: "dmy",
      defaultLimit: 50000,
      backupReminderDays: 365
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

test("themeDatasetValue leaves system theme to CSS media queries", () => {
  assert.equal(themeDatasetValue("system"), "");
  assert.equal(themeDatasetValue("dark"), "dark");
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
    checksumText: "Not available"
  });

  const exportedAt = "2026-06-01T00:00:00.000Z";
  const fresh = backupStatusDetails(
    {
      exportedAt,
      format: "json",
      records: 12,
      sizeBytes: 1536,
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
  assert.equal(fresh.checksumText, "1234567890ab...90abcdef");

  const stale = backupStatusDetails(
    { exportedAt, format: "csv", records: 1 },
    {
      now: Date.parse("2026-07-16T00:00:00.000Z"),
      staleDays: 30
    }
  );
  assert.equal(stale.healthText, "Backup older than 30 days");
  assert.equal(stale.isWarning, true);

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
