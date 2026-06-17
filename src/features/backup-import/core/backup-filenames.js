export const DEFAULT_BACKUP_FILENAME_PREFIX = "browsevault";

export function normalizeBackupFilenamePrefix(value, fallback = DEFAULT_BACKUP_FILENAME_PREFIX) {
  const normalized = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 48);

  if (normalized) {
    return normalized;
  }

  return fallback === DEFAULT_BACKUP_FILENAME_PREFIX
    ? DEFAULT_BACKUP_FILENAME_PREFIX
    : normalizeBackupFilenamePrefix(fallback, DEFAULT_BACKUP_FILENAME_PREFIX);
}

function exportDatePart(exportedAt) {
  const value = String(exportedAt || "");
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "undated";
}

export function backupExportFilename(prefix, kind, exportedAt, extension) {
  return `${normalizeBackupFilenamePrefix(prefix)}-${kind}-${exportDatePart(exportedAt)}.${extension}`;
}
