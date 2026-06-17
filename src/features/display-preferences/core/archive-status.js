import {
  formatBackupSelfTest,
  formatChecksum,
  formatCount,
  formatDate,
  formatFileSize,
  formatShortDate
} from "./formatting.js";

const DEFAULT_DATE_FORMAT = "system";
const DEFAULT_BACKUP_REMINDER_DAYS = 30;

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
  const dateFormat = options.dateFormat || DEFAULT_DATE_FORMAT;
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
  const dateFormat = options.dateFormat || DEFAULT_DATE_FORMAT;
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
  const dateFormat = options.dateFormat || DEFAULT_DATE_FORMAT;
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const reminderDays = Number.isFinite(options.reminderDays)
    ? options.reminderDays
    : Number.isFinite(options.staleDays)
      ? options.staleDays
      : DEFAULT_BACKUP_REMINDER_DAYS;

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
