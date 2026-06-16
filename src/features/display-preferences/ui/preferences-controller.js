import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  backupStatusDetails,
  clampResultLimit,
  formatShortDate,
  normalizePreferences,
  themeDatasetValue
} from "../core/preferences.js";
import {
  getLocalStorage,
  setLocalStorage
} from "../../../platform/chrome/storage.js";

const defaultServices = {
  backupStatusDetails,
  clampResultLimit,
  formatShortDate,
  getLocalStorage,
  normalizePreferences,
  setLocalStorage,
  themeDatasetValue
};

export function createDisplayPreferencesController({
  appState,
  elements,
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
      dateFormat: appState.preferences.dateFormat
    });

    elements.backupHealth.textContent = status.healthText;
    elements.backupHealth.classList.toggle("is-warning", status.isWarning);
    elements.backupHealth.classList.toggle("is-ok", status.isOk);
    elements.backupLast.textContent = status.lastText;
    elements.backupFormat.textContent = status.formatText;
    elements.backupRecords.textContent = status.recordsText;
    elements.backupChecksum.textContent = status.checksumText;
  }

  function applyPreferences() {
    root.dataset.theme = deps.themeDatasetValue(appState.preferences.theme);
    root.dataset.accent = appState.preferences.accent;

    elements.prefTheme.value = appState.preferences.theme;
    elements.prefAccent.value = appState.preferences.accent;
    elements.prefDateFormat.value = appState.preferences.dateFormat;
    elements.prefLimit.value = String(appState.preferences.defaultLimit);

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
    elements.statVisits.textContent = String(stats.visits);
    elements.statDomains.textContent = String(stats.domains);
    elements.statNewest.textContent = deps.formatShortDate(stats.newestVisitTime, appState.preferences.dateFormat);
    elements.statBackup.textContent = stats.meta.lastBackup?.exportedAt
      ? deps.formatShortDate(Date.parse(stats.meta.lastBackup.exportedAt), appState.preferences.dateFormat)
      : "Never";
    renderBackupStatus(stats.meta.lastBackup);
  }

  async function savePreferences() {
    appState.preferences = deps.normalizePreferences({
      theme: elements.prefTheme.value,
      accent: elements.prefAccent.value,
      dateFormat: elements.prefDateFormat.value,
      defaultLimit: elements.prefLimit.value
    });

    await deps.setLocalStorage({
      [PREFERENCES_KEY]: appState.preferences
    });
    elements.limit.value = String(appState.preferences.defaultLimit);
    applyPreferences();
    await refreshStats();
    await refreshAfterSave();
    setStatus("Settings saved");
  }

  return {
    applyPreferences,
    loadPreferences,
    quickResultLimit,
    refreshStats,
    renderBackupStatus,
    requestedResultLimit,
    savePreferences
  };
}
