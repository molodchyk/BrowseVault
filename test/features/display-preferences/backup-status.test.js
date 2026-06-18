import test from "node:test";
import assert from "node:assert/strict";
import { backupStatusDetails } from "../../../src/features/display-preferences/core/preferences.js";

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
    confidenceText: "No restorable backup yet",
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
        restorableRecords: 12,
        checksum: "verified",
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
  assert.equal(fresh.confidenceText, "High - 12 restorable records verified");
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
      backupConfidenceMissing: "Keine wiederherstellbare Sicherung",
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
  assert.equal(status.confidenceText, "Keine wiederherstellbare Sicherung");
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

test("backupStatusDetails accepts localized dynamic backup labels", () => {
  const due = backupStatusDetails(
    {
      exportedAt: "2026-06-01T00:00:00.000Z",
      format: "",
      records: 1,
      selfTest: {
        checksum: "mismatch",
        status: "failed"
      }
    },
    {
      labels: {
        backupChecksumUnavailable: "Nicht verfuegbar",
        backupConfidenceChecksumRisk: "Risiko - Pruefsumme passt nicht",
        backupFormatUnknown: "unbekannt",
        backupHealthDueOne: ([days]) => `Faellig nach ${days} Tag`,
        backupSelfTestFailedChecksum: "Pruefsumme fehlgeschlagen",
        backupSizeNotRecorded: "Nicht aufgezeichnet"
      },
      now: Date.parse("2026-06-02T00:00:00.000Z"),
      reminderDays: 1
    }
  );

  assert.equal(due.healthText, "Faellig nach 1 Tag");
  assert.equal(due.formatText, "unbekannt");
  assert.equal(due.sizeText, "Nicht aufgezeichnet");
  assert.equal(due.selfTestText, "Pruefsumme fehlgeschlagen");
  assert.equal(due.confidenceText, "Risiko - Pruefsumme passt nicht");
  assert.equal(due.checksumText, "Nicht verfuegbar");
});

test("backupStatusDetails marks self-tests without checksums as limited confidence", () => {
  const status = backupStatusDetails({
    exportedAt: "2026-06-01T00:00:00.000Z",
    format: "json",
    records: 1,
    selfTest: {
      checksum: "not-included",
      countMatches: true,
      records: 1,
      restoreCountMatches: true,
      status: "passed"
    }
  });

  assert.equal(status.selfTestText, "Passed 1 record");
  assert.equal(status.confidenceText, "Limited - checksum not included");
});
