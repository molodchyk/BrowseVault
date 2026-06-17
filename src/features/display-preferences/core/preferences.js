import {
  DEFAULT_BACKUP_FILENAME_PREFIX,
  DEFAULT_BACKUP_FILENAME_TEMPLATE,
  normalizeBackupFilenamePrefix,
  normalizeBackupFilenameTemplate
} from "../../backup-import/core/backup-filenames.js";

export const PREFERENCES_KEY = "browseVault.preferences";
export const MAX_RESULT_LIMIT = 50000;
export const BACKUP_STALE_DAYS = 30;

export const DEFAULT_PREFERENCES = {
  theme: "system",
  accent: "teal",
  contrast: "standard",
  textSize: "standard",
  dateFormat: "system",
  defaultLimit: 500,
  backupReminderDays: BACKUP_STALE_DAYS,
  backupFilenamePrefix: DEFAULT_BACKUP_FILENAME_PREFIX,
  backupFilenameTemplate: DEFAULT_BACKUP_FILENAME_TEMPLATE
};

const THEMES = new Set(["system", "light", "dark"]);
const ACCENTS = new Set(["teal", "blue", "green", "purple", "slate"]);
const CONTRASTS = new Set(["standard", "high"]);
const TEXT_SIZES = new Set(["standard", "large"]);
const DATE_FORMATS = new Set(["system", "iso", "dmy", "mdy", "ymd"]);

function pickSupported(value, supported, fallback) {
  return supported.has(value) ? value : fallback;
}

export function clampResultLimit(value, defaultLimit = DEFAULT_PREFERENCES.defaultLimit) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return defaultLimit;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultLimit;
  }

  return Math.min(MAX_RESULT_LIMIT, Math.max(25, Math.round(parsed)));
}

export function clampBackupReminderDays(value, defaultDays = DEFAULT_PREFERENCES.backupReminderDays) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
    return defaultDays;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return defaultDays;
  }

  return Math.min(365, Math.max(0, Math.round(parsed)));
}

export function normalizePreferences(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    theme: pickSupported(source.theme, THEMES, DEFAULT_PREFERENCES.theme),
    accent: pickSupported(source.accent, ACCENTS, DEFAULT_PREFERENCES.accent),
    contrast: pickSupported(source.contrast, CONTRASTS, DEFAULT_PREFERENCES.contrast),
    textSize: pickSupported(source.textSize, TEXT_SIZES, DEFAULT_PREFERENCES.textSize),
    dateFormat: pickSupported(source.dateFormat, DATE_FORMATS, DEFAULT_PREFERENCES.dateFormat),
    defaultLimit: clampResultLimit(source.defaultLimit, DEFAULT_PREFERENCES.defaultLimit),
    backupReminderDays: clampBackupReminderDays(source.backupReminderDays, DEFAULT_PREFERENCES.backupReminderDays),
    backupFilenamePrefix: normalizeBackupFilenamePrefix(source.backupFilenamePrefix, DEFAULT_PREFERENCES.backupFilenamePrefix),
    backupFilenameTemplate: normalizeBackupFilenameTemplate(source.backupFilenameTemplate, DEFAULT_PREFERENCES.backupFilenameTemplate)
  };
}

export function themeDatasetValue(theme) {
  return theme === "system" ? "" : theme;
}

export function contrastDatasetValue(contrast) {
  return contrast === "high" ? "high" : "";
}

export function textSizeDatasetValue(textSize) {
  return textSize === "large" ? "large" : "";
}

export function formatShortDate(value, dateFormat = DEFAULT_PREFERENCES.dateFormat) {
  if (!value) {
    return "No visits yet";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  if (dateFormat === "iso") {
    return `${year}-${month}-${day}`;
  }

  if (dateFormat === "dmy") {
    return `${day}/${month}/${year}`;
  }

  if (dateFormat === "mdy") {
    return `${month}/${day}/${year}`;
  }

  if (dateFormat === "ymd") {
    return `${year}/${month}/${day}`;
  }

  return new Intl.DateTimeFormat(undefined).format(date);
}

export function formatDate(value, dateFormat = DEFAULT_PREFERENCES.dateFormat) {
  if (!value) {
    return "Unknown time";
  }

  const date = new Date(value);
  if (dateFormat === "iso") {
    return `${date.toISOString().slice(0, 10)} ${date.toTimeString().slice(0, 5)}`;
  }

  const datePart = formatShortDate(value, dateFormat);
  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return `${datePart}, ${timePart}`;
}

export function localDayKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDayHeading(value, dateFormat = DEFAULT_PREFERENCES.dateFormat) {
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(new Date(value));
  return `${weekday} · ${formatShortDate(value, dateFormat)}`;
}

export function formatCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? count.toLocaleString() : "0";
}

export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return "Not recorded";
  }

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  const units = ["KB", "MB", "GB"];
  let size = value / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 1 : 2;
  return `${size.toFixed(precision).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1")} ${units[unitIndex]}`;
}

export function formatChecksum(value) {
  if (!value) {
    return "Not available";
  }

  return value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

export function formatBackupSelfTest(selfTest) {
  if (!selfTest) {
    return "Not tested";
  }

  if (selfTest.status === "passed") {
    const records = Number(selfTest.records);
    return Number.isFinite(records)
      ? `Passed ${formatCount(records)} record${records === 1 ? "" : "s"}`
      : "Passed";
  }

  if (selfTest.checksum === "mismatch") {
    return "Failed checksum";
  }

  if (selfTest.countMatches === false) {
    return "Failed count";
  }

  return "Failed";
}

function timestampFromIso(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function archiveHealthDetails(meta = {}, options = {}) {
  const dateFormat = options.dateFormat || DEFAULT_PREFERENCES.dateFormat;
  const vaultHealth = options.vaultHealth || {};
  const sync = meta.lastChromeSync || null;
  const syncTimestamp = timestampFromIso(sync?.syncedAt);
  const startupTimestamp = timestampFromIso(meta.lastStartedAt) || timestampFromIso(meta.installedAt);
  const capture = meta.lastLiveCapture || null;
  const captureTimestamp = timestampFromIso(capture?.capturedAt);
  const storageCheck = meta.lastStorageSelfCheck || null;
  const storageCheckTimestamp = timestampFromIso(storageCheck?.checkedAt);
  const storageCheckOk = storageCheck?.status === "passed" && Boolean(storageCheckTimestamp);
  const hasSync = Boolean(syncTimestamp);
  const issueRecords = Number(vaultHealth.issueRecords || 0);
  const hasVaultIssues = issueRecords > 0;
  const activeRecords = Number(vaultHealth.activeRecords || 0);
  const storedRows = Number(vaultHealth.storedRows || activeRecords);
  const deletedRecords = Number(vaultHealth.deletedRecords || 0);
  const duplicateActiveRecords = Number(vaultHealth.duplicateActiveRecords || 0);
  const missingUrlRecords = Number(vaultHealth.missingUrlRecords || 0);
  const invalidTimeRecords = Number(vaultHealth.invalidTimeRecords || 0);

  const issueDetails = [
    missingUrlRecords ? `${formatCount(missingUrlRecords)} missing URL` : "",
    invalidTimeRecords ? `${formatCount(invalidTimeRecords)} bad time` : "",
    duplicateActiveRecords ? `${formatCount(duplicateActiveRecords)} duplicate active` : ""
  ].filter(Boolean);

  return {
    healthText: hasVaultIssues
      ? "Vault data needs review"
      : !storageCheckOk && hasSync
        ? "Storage check not run"
        : hasSync
          ? "Archive recording ready"
          : "Archive sync not run yet",
    isWarning: hasVaultIssues || !hasSync || !storageCheckOk,
    isOk: !hasVaultIssues && hasSync && storageCheckOk,
    startupText: startupTimestamp ? formatDate(startupTimestamp, dateFormat) : "Not recorded",
    syncText: hasSync
      ? `${formatDate(syncTimestamp, dateFormat)} · ${formatCount(sync.stored)} stored`
      : "Not synced yet",
    captureText: captureTimestamp
      ? `${formatDate(captureTimestamp, dateFormat)}${domainFromUrl(capture.url) ? ` · ${domainFromUrl(capture.url)}` : ""}`
      : "Waiting for next visit",
    storageText: storageCheckOk
      ? `Passed ${formatDate(storageCheckTimestamp, dateFormat)}`
      : storageCheck?.status === "failed"
        ? "Failed"
        : "Not checked yet",
    vaultText: hasVaultIssues
      ? issueDetails.join(" · ")
      : `${formatCount(activeRecords)} active · ${formatCount(storedRows)} stored`,
    tombstoneText: deletedRecords
      ? `${formatCount(deletedRecords)} deleted tombstone${deletedRecords === 1 ? "" : "s"}`
      : "No deleted tombstones"
  };
}

function timestampFromLocalDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return 0;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function pluralVisit(count) {
  const visits = Number(count || 0);
  return `${formatCount(visits)} visit${visits === 1 ? "" : "s"}`;
}

export function archiveInsightDetails(insights = {}, options = {}) {
  const dateFormat = options.dateFormat || DEFAULT_PREFERENCES.dateFormat;
  const topDomains = Array.isArray(insights.topDomains) ? insights.topDomains : [];
  const busiestDays = Array.isArray(insights.busiestDays) ? insights.busiestDays : [];
  const activeDaysValue = Number(insights.activeDays || 0);
  const averageValue = Number(insights.averageVisitsPerActiveDay || 0);
  const oldestValue = Number(insights.oldestVisitTime || 0);
  const newestValue = Number(insights.newestVisitTime || 0);
  const activeDays = Number.isFinite(activeDaysValue) ? activeDaysValue : 0;
  const averageVisitsPerActiveDay = Number.isFinite(averageValue) ? averageValue : 0;
  const oldestVisitTime = Number.isFinite(oldestValue) ? oldestValue : 0;
  const newestVisitTime = Number.isFinite(newestValue) ? newestValue : 0;
  const busiest = busiestDays[0];

  const topDomainsText = topDomains.length
    ? topDomains.map((entry) => `${entry.domain || "unknown"} (${formatCount(entry.count)})`).join(" · ")
    : "No domains yet";
  const busiestDayText = busiest
    ? `${formatShortDate(timestampFromLocalDay(busiest.day), dateFormat)} · ${pluralVisit(busiest.count)}`
    : "No visits yet";
  const activeDaysText = activeDays
    ? `${formatCount(activeDays)} day${activeDays === 1 ? "" : "s"} · ${averageVisitsPerActiveDay.toFixed(1)} visits/day`
    : "No active days yet";
  const dateRangeText = oldestVisitTime && newestVisitTime
    ? oldestVisitTime === newestVisitTime
      ? formatShortDate(newestVisitTime, dateFormat)
      : `${formatShortDate(oldestVisitTime, dateFormat)} to ${formatShortDate(newestVisitTime, dateFormat)}`
    : "No visits yet";

  return {
    topDomainsText,
    busiestDayText,
    activeDaysText,
    dateRangeText
  };
}

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

export function backupStatusDetails(backup, options = {}) {
  const timestamp = backupTimestamp(backup);
  const dateFormat = options.dateFormat || DEFAULT_PREFERENCES.dateFormat;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const reminderDays = Number.isFinite(options.reminderDays)
    ? options.reminderDays
    : Number.isFinite(options.staleDays)
      ? options.staleDays
      : DEFAULT_PREFERENCES.backupReminderDays;

  if (!timestamp) {
    return {
      healthText: "No backup yet",
      isWarning: true,
      isOk: false,
      lastText: "Never",
      nextText: reminderDays > 0 ? "After first backup" : "Off",
      formatText: "-",
      recordsText: "0",
      sizeText: "-",
      selfTestText: "-",
      checksumText: "Not available"
    };
  }

  const remindersEnabled = reminderDays > 0;
  const nextTimestamp = remindersEnabled ? timestamp + (reminderDays * 86400000) : 0;
  const isDue = remindersEnabled && now >= nextTimestamp;
  return {
    healthText: remindersEnabled
      ? isDue
        ? `Backup due after ${reminderDays} day${reminderDays === 1 ? "" : "s"}`
        : "Backup current"
      : "Backup reminder off",
    isWarning: isDue,
    isOk: remindersEnabled && !isDue,
    lastText: formatDate(timestamp, dateFormat),
    nextText: remindersEnabled ? formatDate(nextTimestamp, dateFormat) : "Off",
    formatText: String(backup.format || "unknown").toUpperCase(),
    recordsText: formatCount(backup.records),
    sizeText: formatFileSize(backup.sizeBytes),
    selfTestText: formatBackupSelfTest(backup.selfTest),
    checksumText: formatChecksum(backup.sha256)
  };
}
