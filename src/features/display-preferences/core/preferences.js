import {
  DEFAULT_BACKUP_FILENAME_PREFIX,
  DEFAULT_BACKUP_FILENAME_TEMPLATE,
  normalizeBackupFilenamePrefix,
  normalizeBackupFilenameTemplate
} from "../../backup-import/core/backup-filenames.js";
export {
  archiveHealthDetails,
  archiveInsightDetails
} from "./archive-status.js";
export {
  backupStatusDetails,
  backupTimestamp,
  restorableBackupMetadata
} from "./backup-status.js";
export {
  formatBackupSelfTest,
  formatChecksum,
  formatCount,
  formatDate,
  formatDayHeading,
  formatFileSize,
  formatShortDate,
  localDayKey
} from "./formatting.js";

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
  backupSaveMode: "downloads",
  backupFilenamePrefix: DEFAULT_BACKUP_FILENAME_PREFIX,
  backupFilenameTemplate: DEFAULT_BACKUP_FILENAME_TEMPLATE
};

const THEMES = new Set(["system", "light", "dark"]);
const ACCENTS = new Set(["teal", "blue", "green", "purple", "slate"]);
const CONTRASTS = new Set(["standard", "high"]);
const TEXT_SIZES = new Set(["standard", "large"]);
const DATE_FORMATS = new Set(["system", "iso", "dmy", "mdy", "ymd"]);
const BACKUP_SAVE_MODES = new Set(["downloads", "ask"]);

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
    backupSaveMode: pickSupported(source.backupSaveMode, BACKUP_SAVE_MODES, DEFAULT_PREFERENCES.backupSaveMode),
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
