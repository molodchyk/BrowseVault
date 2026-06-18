import {
  formatCount,
  formatDate,
  formatShortDate
} from "./formatting.js";
import { countMessage, label, message } from "./status-labels.js";

const DEFAULT_DATE_FORMAT = "system";

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
    missingUrlRecords
      ? countMessage(
        options,
        missingUrlRecords,
        "archiveIssueMissingUrlOne",
        "archiveIssueMissingUrlMany",
        "1 missing URL",
        `${formatCount(missingUrlRecords)} missing URLs`
      )
      : "",
    invalidTimeRecords
      ? countMessage(
        options,
        invalidTimeRecords,
        "archiveIssueBadTimeOne",
        "archiveIssueBadTimeMany",
        "1 bad time",
        `${formatCount(invalidTimeRecords)} bad times`
      )
      : "",
    duplicateActiveRecords
      ? countMessage(
        options,
        duplicateActiveRecords,
        "archiveIssueDuplicateActiveOne",
        "archiveIssueDuplicateActiveMany",
        "1 duplicate active",
        `${formatCount(duplicateActiveRecords)} duplicate active`
      )
      : ""
  ].filter(Boolean);

  return {
    healthText: hasVaultIssues
      ? label(options, "archiveHealthVaultReview", "Vault data needs review")
      : !storageCheckOk && hasSync
        ? label(options, "archiveHealthStorageNotRun", "Storage check not run")
        : hasSync
          ? label(options, "archiveHealthReady", "Archive recording ready")
          : label(options, "archiveSyncNotRun", "Archive sync not run yet"),
    isWarning: hasVaultIssues || !hasSync || !storageCheckOk,
    isOk: !hasVaultIssues && hasSync && storageCheckOk,
    startupText: startupTimestamp ? formatDate(startupTimestamp, dateFormat) : label(options, "archiveNotRecorded", "Not recorded"),
    syncText: hasSync
      ? message(
        options,
        "archiveSyncStored",
        `${formatDate(syncTimestamp, dateFormat)} · ${formatCount(sync.stored)} stored`,
        [formatDate(syncTimestamp, dateFormat), formatCount(sync.stored)]
      )
      : label(options, "archiveNotSynced", "Not synced yet"),
    captureText: captureTimestamp
      ? `${formatDate(captureTimestamp, dateFormat)}${domainFromUrl(capture.url) ? ` · ${domainFromUrl(capture.url)}` : ""}`
      : label(options, "archiveWaitingForVisit", "Waiting for next visit"),
    storageText: storageCheckOk
      ? message(
        options,
        "archiveStoragePassed",
        `Passed ${formatDate(storageCheckTimestamp, dateFormat)}`,
        [formatDate(storageCheckTimestamp, dateFormat)]
      )
      : storageCheck?.status === "failed"
        ? label(options, "archiveStorageFailed", "Failed")
        : label(options, "archiveNotChecked", "Not checked yet"),
    vaultText: hasVaultIssues
      ? issueDetails.join(" · ")
      : message(
        options,
        "archiveVaultRecordCounts",
        `${formatCount(activeRecords)} active · ${formatCount(storedRows)} stored`,
        [formatCount(activeRecords), formatCount(storedRows)]
      ),
    tombstoneText: deletedRecords
      ? countMessage(
        options,
        deletedRecords,
        "archiveDeletedTombstoneOne",
        "archiveDeletedTombstoneMany",
        "1 deleted tombstone",
        `${formatCount(deletedRecords)} deleted tombstones`
      )
      : label(options, "archiveNoTombstones", "No deleted tombstones")
  };
}

function timestampFromLocalDay(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return 0;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function pluralVisit(count, options) {
  const visits = Number(count || 0);
  return countMessage(
    options,
    visits,
    "archiveVisitOne",
    "archiveVisitMany",
    "1 visit",
    `${formatCount(visits)} visits`
  );
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
    ? topDomains.map((entry) => {
      const domain = entry.domain || label(options, "archiveUnknownDomain", "unknown");
      return message(
        options,
        "archiveDomainCount",
        `${domain} (${formatCount(entry.count)})`,
        [domain, formatCount(entry.count)]
      );
    }).join(" · ")
    : label(options, "noDomainsYet", "No domains yet");
  const busiestDayText = busiest
    ? message(
      options,
      "archiveBusiestDayVisits",
      `${formatShortDate(timestampFromLocalDay(busiest.day), dateFormat)} · ${pluralVisit(busiest.count, options)}`,
      [formatShortDate(timestampFromLocalDay(busiest.day), dateFormat), pluralVisit(busiest.count, options)]
    )
    : label(options, "noVisitsYet", "No visits yet");
  const activeDaysText = activeDays
    ? countMessage(
      options,
      activeDays,
      "archiveActiveDayStatsOne",
      "archiveActiveDayStatsMany",
      `1 day · ${averageVisitsPerActiveDay.toFixed(1)} visits/day`,
      `${formatCount(activeDays)} days · ${averageVisitsPerActiveDay.toFixed(1)} visits/day`,
      [averageVisitsPerActiveDay.toFixed(1)]
    )
    : label(options, "noActiveDaysYet", "No active days yet");
  const dateRangeText = oldestVisitTime && newestVisitTime
    ? oldestVisitTime === newestVisitTime
      ? formatShortDate(newestVisitTime, dateFormat)
      : message(
        options,
        "archiveDateRange",
        `${formatShortDate(oldestVisitTime, dateFormat)} to ${formatShortDate(newestVisitTime, dateFormat)}`,
        [formatShortDate(oldestVisitTime, dateFormat), formatShortDate(newestVisitTime, dateFormat)]
      )
    : label(options, "noVisitsYet", "No visits yet");

  return {
    topDomainsText,
    busiestDayText,
    activeDaysText,
    dateRangeText
  };
}
