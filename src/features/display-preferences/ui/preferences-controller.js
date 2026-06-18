import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  archiveInsightDetails,
  archiveHealthDetails,
  backupStatusDetails,
  clampResultLimit,
  contrastDatasetValue,
  formatShortDate,
  normalizePreferences,
  restorableBackupMetadata,
  textSizeDatasetValue,
  themeDatasetValue
} from "../core/preferences.js";
import {
  getLocalStorage,
  setLocalStorage
} from "../../../platform/chrome/storage.js";
import { renderActivityLog } from "../../activity-log/ui/render-activity-log.js";

const defaultServices = {
  archiveHealthDetails,
  archiveInsightDetails,
  backupStatusDetails,
  clampResultLimit,
  contrastDatasetValue,
  formatShortDate,
  getLocalStorage,
  normalizePreferences,
  renderActivityLog,
  restorableBackupMetadata,
  setLocalStorage,
  textSizeDatasetValue,
  themeDatasetValue
};

export function createDisplayPreferencesController({
  appState,
  elements,
  getMessage = () => "",
  getStats,
  refreshAfterSave,
  root,
  services = {},
  setStatus
}) {
  const deps = {
    ...defaultServices,
    ...services
  };

  function requestedResultLimit() {
    return deps.clampResultLimit(elements.limit.value || appState.preferences.defaultLimit);
  }

  function quickResultLimit() {
    return Math.min(requestedResultLimit(), 100);
  }

  function renderBackupStatus(backup) {
    const status = deps.backupStatusDetails(backup, {
      dateFormat: appState.preferences.dateFormat,
      labels: {
        backupChecksumUnavailable: getMessage("backupChecksumUnavailable") || "Not available",
        backupHealthEmpty: getMessage("backupHealthEmpty") || "No backup yet",
        backupNextAfterFirst: getMessage("backupNextAfterFirst") || "After first backup",
        backupReminderOff: getMessage("backupReminderOff") || "Off",
        statBackupEmpty: getMessage("statBackupEmpty") || "Never"
      },
      reminderDays: appState.preferences.backupReminderDays
    });

    elements.backupHealth.textContent = status.healthText;
    elements.backupHealth.classList.toggle("is-warning", status.isWarning);
    elements.backupHealth.classList.toggle("is-ok", status.isOk);
    elements.backupLast.textContent = status.lastText;
    elements.backupNext.textContent = status.nextText;
    elements.backupFormat.textContent = status.formatText;
    elements.backupRecords.textContent = status.recordsText;
    elements.backupSize.textContent = status.sizeText;
    elements.backupSelfTest.textContent = status.selfTestText;
    elements.backupChecksum.textContent = status.checksumText;
  }

  function renderArchiveHealth(meta) {
    const status = deps.archiveHealthDetails(meta, {
      dateFormat: appState.preferences.dateFormat,
      labels: {
        archiveNoTombstones: getMessage("archiveNoTombstones") || "No deleted tombstones",
        archiveNotChecked: getMessage("archiveNotChecked") || "Not checked yet",
        archiveNotRecorded: getMessage("archiveNotRecorded") || "Not recorded",
        archiveNotSynced: getMessage("archiveNotSynced") || "Not synced yet",
        archiveWaitingForVisit: getMessage("archiveWaitingForVisit") || "Waiting for next visit"
      },
      vaultHealth: appState.vaultHealth
    });

    elements.archiveHealth.textContent = status.healthText;
    elements.archiveHealth.classList.toggle("is-warning", status.isWarning);
    elements.archiveHealth.classList.toggle("is-ok", status.isOk);
    elements.archiveStartup.textContent = status.startupText;
    elements.archiveSync.textContent = status.syncText;
    elements.archiveCapture.textContent = status.captureText;
    elements.archiveStorage.textContent = status.storageText;
    elements.archiveVault.textContent = status.vaultText;
    elements.archiveTombstones.textContent = status.tombstoneText;
  }

  function renderArchiveInsights(insights) {
    const status = deps.archiveInsightDetails(insights, {
      dateFormat: appState.preferences.dateFormat,
      labels: {
        noActiveDaysYet: getMessage("noActiveDaysYet") || "No active days yet",
        noDomainsYet: getMessage("noDomainsYet") || "No domains yet",
        noVisitsYet: getMessage("noVisitsYet") || "No visits yet"
      }
    });

    elements.archiveTopDomains.textContent = status.topDomainsText;
    elements.archiveBusiestDay.textContent = status.busiestDayText;
    elements.archiveActiveDays.textContent = status.activeDaysText;
    elements.archiveDateRange.textContent = status.dateRangeText;
  }

  function applyPreferences() {
    root.dataset.theme = deps.themeDatasetValue(appState.preferences.theme);
    root.dataset.accent = appState.preferences.accent;
    root.dataset.contrast = deps.contrastDatasetValue(appState.preferences.contrast);
    root.dataset.textSize = deps.textSizeDatasetValue(appState.preferences.textSize);

    elements.prefTheme.value = appState.preferences.theme;
    elements.prefAccent.value = appState.preferences.accent;
    elements.prefContrast.value = appState.preferences.contrast;
    elements.prefTextSize.value = appState.preferences.textSize;
    elements.prefDateFormat.value = appState.preferences.dateFormat;
    elements.prefLimit.value = String(appState.preferences.defaultLimit);
    elements.prefBackupReminder.value = String(appState.preferences.backupReminderDays);
    elements.prefBackupSaveMode.value = appState.preferences.backupSaveMode;
    elements.prefBackupPrefix.value = appState.preferences.backupFilenamePrefix;
    elements.prefBackupTemplate.value = appState.preferences.backupFilenameTemplate;

    if (!elements.limit.value || Number(elements.limit.value) === DEFAULT_PREFERENCES.defaultLimit) {
      elements.limit.value = String(appState.preferences.defaultLimit);
    }
  }

  async function loadPreferences() {
    const result = await deps.getLocalStorage(PREFERENCES_KEY);
    appState.preferences = deps.normalizePreferences(result[PREFERENCES_KEY]);
    applyPreferences();
  }

  async function refreshStats() {
    const stats = await getStats();
    appState.vaultHealth = stats.vaultHealth;
    elements.statVisits.textContent = String(stats.visits);
    elements.statDomains.textContent = String(stats.domains);
    elements.statNewest.textContent = deps.formatShortDate(stats.newestVisitTime, appState.preferences.dateFormat);
    const backup = deps.restorableBackupMetadata(stats.meta.lastBackup);
    elements.statBackup.textContent = backup?.exportedAt
      ? deps.formatShortDate(Date.parse(backup.exportedAt), appState.preferences.dateFormat)
      : getMessage("statBackupEmpty") || "Never";
    renderBackupStatus(backup);
    renderArchiveHealth(stats.meta);
    renderArchiveInsights(stats.insights);
    deps.renderActivityLog(elements.activityLog, stats.meta.activityLog, {
      emptyText: getMessage("noActivityLogged") || "No activity logged yet.",
      formatDate: (timestamp) => deps.formatShortDate(timestamp, appState.preferences.dateFormat),
      getMessage
    });
  }

  async function savePreferences() {
    appState.preferences = deps.normalizePreferences({
      theme: elements.prefTheme.value,
      accent: elements.prefAccent.value,
      contrast: elements.prefContrast.value,
      textSize: elements.prefTextSize.value,
      dateFormat: elements.prefDateFormat.value,
      defaultLimit: elements.prefLimit.value,
      backupReminderDays: elements.prefBackupReminder.value,
      backupSaveMode: elements.prefBackupSaveMode.value,
      backupFilenamePrefix: elements.prefBackupPrefix.value,
      backupFilenameTemplate: elements.prefBackupTemplate.value
    });

    await deps.setLocalStorage({
      [PREFERENCES_KEY]: appState.preferences
    });
    elements.limit.value = String(appState.preferences.defaultLimit);
    applyPreferences();
    await refreshStats();
    await refreshAfterSave();
    setStatus(getMessage("statusSettingsSaved") || "Settings saved");
  }

  return {
    applyPreferences,
    loadPreferences,
    quickResultLimit,
    refreshStats,
    renderArchiveHealth,
    renderArchiveInsights,
    renderBackupStatus,
    requestedResultLimit,
    savePreferences
  };
}
