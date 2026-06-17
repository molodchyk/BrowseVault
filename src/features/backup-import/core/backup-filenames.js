export const DEFAULT_BACKUP_FILENAME_PREFIX = "browsevault";
export const DEFAULT_BACKUP_FILENAME_TEMPLATE = "{prefix}-{kind}-{date}";

function sanitizeFilenameBase(value, fallback, maxLength = 120) {
  const normalized = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, maxLength);

  return normalized || fallback;
}

export function normalizeBackupFilenamePrefix(value, fallback = DEFAULT_BACKUP_FILENAME_PREFIX) {
  const normalized = sanitizeFilenameBase(value, "", 48);

  if (normalized) {
    return normalized;
  }

  return fallback === DEFAULT_BACKUP_FILENAME_PREFIX
    ? DEFAULT_BACKUP_FILENAME_PREFIX
    : normalizeBackupFilenamePrefix(fallback, DEFAULT_BACKUP_FILENAME_PREFIX);
}

export function normalizeBackupFilenameTemplate(value, fallback = DEFAULT_BACKUP_FILENAME_TEMPLATE) {
  const normalized = sanitizeFilenameBase(value, "", 120);

  if (normalized) {
    return normalized;
  }

  return fallback === DEFAULT_BACKUP_FILENAME_TEMPLATE
    ? DEFAULT_BACKUP_FILENAME_TEMPLATE
    : normalizeBackupFilenameTemplate(fallback, DEFAULT_BACKUP_FILENAME_TEMPLATE);
}

function exportDatePart(exportedAt) {
  const value = String(exportedAt || "");
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "undated";
}

function exportTimePart(exportedAt) {
  const value = String(exportedAt || "");
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}${match[2]}${match[3]}` : "unknown-time";
}

function extensionPart(extension) {
  return sanitizeFilenameBase(String(extension || "").replace(/^\.+/, ""), "txt", 16).toLowerCase();
}

export function backupExportFilename(prefix, kind, exportedAt, extension, template = DEFAULT_BACKUP_FILENAME_TEMPLATE) {
  const replacements = {
    prefix: normalizeBackupFilenamePrefix(prefix),
    kind: sanitizeFilenameBase(kind, "export", 32),
    date: exportDatePart(exportedAt),
    time: exportTimePart(exportedAt)
  };
  const base = normalizeBackupFilenameTemplate(template)
    .replace(/\{prefix\}/g, replacements.prefix)
    .replace(/\{kind\}/g, replacements.kind)
    .replace(/\{date\}/g, replacements.date)
    .replace(/\{time\}/g, replacements.time);

  return `${sanitizeFilenameBase(base, `${replacements.prefix}-${replacements.kind}-${replacements.date}`)}.${extensionPart(extension)}`;
}
