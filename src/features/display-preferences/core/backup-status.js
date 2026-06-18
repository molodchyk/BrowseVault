import {
  formatChecksum,
  formatCount,
  formatDate,
  formatFileSize
} from "./formatting.js";
import { countMessage, label } from "./status-labels.js";

const DEFAULT_DATE_FORMAT = "system";
const DEFAULT_BACKUP_REMINDER_DAYS = 30;

export function backupTimestamp(backup) {
  if (!backup?.exportedAt) {
    return 0;
  }

  const timestamp = Date.parse(backup.exportedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function restorableBackupMetadata(backup) {
  if (!backup || backup.format !== "json") {
    return null;
  }

  return backup;
}

function localizedBackupSelfTest(selfTest, options) {
  if (!selfTest) {
    return label(options, "backupSelfTestNotTested", "Not tested");
  }

  if (selfTest.status === "passed") {
    const records = Number(selfTest.records);
    return Number.isFinite(records)
      ? countMessage(
        options,
        records,
        "backupSelfTestPassedRecordOne",
        "backupSelfTestPassedRecordMany",
        "Passed 1 record",
        `Passed ${formatCount(records)} records`
      )
      : label(options, "backupSelfTestPassed", "Passed");
  }

  if (selfTest.checksum === "mismatch") {
    return label(options, "backupSelfTestFailedChecksum", "Failed checksum");
  }

  if (selfTest.countMatches === false) {
    return label(options, "backupSelfTestFailedCount", "Failed count");
  }

  if (selfTest.restoreCountMatches === false) {
    return label(options, "backupSelfTestFailedRestoreRows", "Failed restore rows");
  }

  return label(options, "backupSelfTestFailed", "Failed");
}

function localizedRestoreConfidence(backup, options) {
  if (!backup) {
    return label(options, "backupConfidenceMissing", "No restorable backup yet");
  }

  const selfTest = backup.selfTest;
  if (!selfTest) {
    return label(options, "backupConfidenceUnknown", "Unknown until a JSON backup self-test runs");
  }

  if (selfTest.status === "passed" &&
    selfTest.checksum === "verified" &&
    selfTest.countMatches !== false &&
    selfTest.restoreCountMatches !== false) {
    const restorableRecords = Number(selfTest.restorableRecords ?? selfTest.records ?? backup.records);
    return Number.isFinite(restorableRecords)
      ? countMessage(
        options,
        restorableRecords,
        "backupConfidenceHighRecordOne",
        "backupConfidenceHighRecordMany",
        "High - 1 restorable record verified",
        `High - ${formatCount(restorableRecords)} restorable records verified`
      )
      : label(options, "backupConfidenceHigh", "High - checksum and restore rows verified");
  }

  if (selfTest.checksum === "mismatch") {
    return label(options, "backupConfidenceChecksumRisk", "Risk - checksum mismatch");
  }

  if (selfTest.checksum === "not-included") {
    return label(options, "backupConfidenceChecksumMissing", "Limited - checksum not included");
  }

  if (selfTest.countMatches === false) {
    return label(options, "backupConfidenceCountRisk", "Risk - backup count mismatch");
  }

  if (selfTest.restoreCountMatches === false) {
    return label(options, "backupConfidenceRestoreRisk", "Risk - restore row check failed");
  }

  return label(options, "backupConfidenceRisk", "Risk - self-test failed");
}

export function backupStatusDetails(backup, options = {}) {
  const timestamp = backupTimestamp(backup);
  const dateFormat = options.dateFormat || DEFAULT_DATE_FORMAT;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const reminderDays = Number.isFinite(options.reminderDays)
    ? options.reminderDays
    : Number.isFinite(options.staleDays)
      ? options.staleDays
      : DEFAULT_BACKUP_REMINDER_DAYS;

  if (!timestamp) {
    return {
      healthText: label(options, "backupHealthEmpty", "No backup yet"),
      isWarning: true,
      isOk: false,
      lastText: label(options, "statBackupEmpty", "Never"),
      nextText: reminderDays > 0
        ? label(options, "backupNextAfterFirst", "After first backup")
        : label(options, "backupReminderOff", "Off"),
      formatText: "-",
      recordsText: "0",
      sizeText: "-",
      selfTestText: "-",
      confidenceText: localizedRestoreConfidence(null, options),
      checksumText: label(options, "backupChecksumUnavailable", "Not available")
    };
  }

  const remindersEnabled = reminderDays > 0;
  const nextTimestamp = remindersEnabled ? timestamp + (reminderDays * 86400000) : 0;
  const isDue = remindersEnabled && now >= nextTimestamp;
  return {
    healthText: remindersEnabled
      ? isDue
        ? countMessage(
          options,
          reminderDays,
          "backupHealthDueOne",
          "backupHealthDueMany",
          "Backup due after 1 day",
          `Backup due after ${formatCount(reminderDays)} days`
        )
        : label(options, "backupHealthCurrent", "Backup current")
      : label(options, "backupHealthReminderOff", "Backup reminder off"),
    isWarning: isDue,
    isOk: remindersEnabled && !isDue,
    lastText: formatDate(timestamp, dateFormat),
    nextText: remindersEnabled ? formatDate(nextTimestamp, dateFormat) : label(options, "backupReminderOff", "Off"),
    formatText: backup.format
      ? String(backup.format).toUpperCase()
      : label(options, "backupFormatUnknown", "unknown"),
    recordsText: formatCount(backup.records),
    sizeText: Number.isFinite(Number(backup.sizeBytes)) && Number(backup.sizeBytes) >= 0
      ? formatFileSize(backup.sizeBytes)
      : label(options, "backupSizeNotRecorded", "Not recorded"),
    selfTestText: localizedBackupSelfTest(backup.selfTest, options),
    confidenceText: localizedRestoreConfidence(backup, options),
    checksumText: backup.sha256
      ? formatChecksum(backup.sha256)
      : label(options, "backupChecksumUnavailable", "Not available")
  };
}
