import {
  analyzeImportArchive,
  appendActivityLog,
  exportArchive,
  importArchive,
  setMeta
} from "../../../storage.js";
import { visitsToCsvAsync, visitsToHtmlAsync } from "../../history-export/core/export-format.js";
import { archiveFromFileText } from "../core/archive-parser.js";
import { backupExportFilename } from "../core/backup-filenames.js";
import { createBackupSelfTest } from "../core/backup-verification.js";
import {
  attachArchiveIntegrity,
  verifyArchiveIntegrity
} from "../core/archive-integrity.js";
import { downloadJson, downloadText } from "./downloads.js";
import { renderImportPreview as renderImportPreviewUi } from "./render-import-preview.js";

export { downloadJson, downloadText };

const defaultServices = {
  analyzeImportArchive,
  appendActivityLog,
  archiveFromFileText,
  attachArchiveIntegrity,
  backupExportFilename,
  confirmAction: (message) => globalThis.confirm(message),
  createBackupSelfTest,
  downloadJson,
  downloadText,
  exportArchive,
  importArchive,
  now: () => new Date(),
  renderImportPreview: renderImportPreviewUi,
  setMeta,
  verifyArchiveIntegrity,
  visitsToCsv: visitsToCsvAsync,
  visitsToHtml: visitsToHtmlAsync
};

function localizedMessage(getMessage, key, fallback, substitutions) {
  return getMessage?.(key, substitutions) || fallback;
}

function importIntegrityStatusLabel(integrity, getMessage) {
  if (!integrity.checked) {
    return "";
  }

  return integrity.ok
    ? localizedMessage(getMessage, "importStatusVerifiedChecksum", " with verified checksum")
    : localizedMessage(getMessage, "importStatusChecksumWarning", " after checksum warning");
}

function importRuleStatusLabel(ruleCount, getMessage) {
  if (!ruleCount) {
    return "";
  }

  return localizedMessage(
    getMessage,
    ruleCount === 1 ? "importStatusRuleOne" : "importStatusRuleMany",
    ` and ${ruleCount} rule${ruleCount === 1 ? "" : "s"}`,
    [String(ruleCount)]
  );
}

function importDuplicateStatusLabel(duplicateCount, getMessage) {
  if (!duplicateCount) {
    return "";
  }

  return localizedMessage(
    getMessage,
    duplicateCount === 1 ? "importStatusDuplicateOne" : "importStatusDuplicateMany",
    `; ${duplicateCount} duplicate row${duplicateCount === 1 ? "" : "s"} merged`,
    [String(duplicateCount)]
  );
}

export function backupImportPreviewElements(elements) {
  return {
    importPreview: elements.importPreview,
    importPreviewTitle: elements.importPreviewTitle,
    importValid: elements.importValid,
    importNew: elements.importNew,
    importExisting: elements.importExisting,
    importDuplicates: elements.importDuplicates,
    importHealth: elements.importHealth,
    importPreviewNote: elements.importPreviewNote,
    confirmImport: elements.confirmImport
  };
}

export function createBackupActions({
  appState,
  elements,
  getMessage = () => "",
  getSortOrder = () => "newest",
  getSearchText = () => "",
  notifyVaultChanged = () => false,
  refreshStats,
  renderRules,
  runSearch,
  searchVisits = async () => ({
    results: appState.currentResults || [],
    total: appState.currentTotal || 0
  }),
  selectedResults,
  services = {},
  setStatus,
  switchTab
}) {
  const deps = {
    ...defaultServices,
    ...services
  };
  const previewElements = backupImportPreviewElements(elements);

  function renderImportPreview() {
    deps.renderImportPreview(previewElements, appState.stagedImport);
  }

  function exportFilename(kind, exportedAt, extension) {
    return deps.backupExportFilename(
      appState.preferences?.backupFilenamePrefix,
      kind,
      exportedAt,
      extension,
      appState.preferences?.backupFilenameTemplate
    );
  }

  function saveOptions() {
    return {
      saveMode: appState.preferences?.backupSaveMode
    };
  }

  async function recordActivity(event) {
    await deps.appendActivityLog(event);
    await refreshStats();
  }

  async function matchingResultsForExport() {
    const { results } = await searchVisits(getSearchText(), {
      limit: "all",
      sortOrder: getSortOrder()
    });
    return results;
  }

  async function exportAll() {
    setStatus(localizedMessage(getMessage, "statusPreparingArchive", "Preparing archive"));
    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive());
    const selfTest = await deps.createBackupSelfTest(archive, deps.verifyArchiveIntegrity, deps.now);
    if (selfTest.status !== "passed") {
      setStatus(localizedMessage(getMessage, "statusBackupSelfTestFailed", "Backup self-test failed"));
      return;
    }

    const sizeBytes = await deps.downloadJson(exportFilename("archive", archive.exportedAt, "json"), archive, saveOptions());
    await deps.setMeta("lastBackup", {
      exportedAt: archive.exportedAt,
      format: "json",
      records: archive.counts.visits,
      sizeBytes,
      selfTest,
      sha256: archive.integrity.sha256
    });
    await recordActivity({
      type: "backup",
      label: "JSON backup exported",
      count: archive.counts.visits,
      detail: `${sizeBytes} bytes`,
      occurredAt: archive.exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedArchive", "Exported archive"));
  }

  async function exportCsv() {
    setStatus(localizedMessage(getMessage, "statusPreparingCsv", "Preparing CSV"));
    const archive = await deps.exportArchive(null, { includeCategories: true });
    const sizeBytes = await deps.downloadText(
      exportFilename("history", archive.exportedAt, "csv"),
      "text/csv",
      await deps.visitsToCsv(archive.visits),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Full CSV exported",
      count: archive.counts.visits,
      detail: `${sizeBytes} bytes`,
      occurredAt: archive.exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedCsv", "Exported CSV"));
  }

  async function exportHtml() {
    setStatus(localizedMessage(getMessage, "statusPreparingHtml", "Preparing HTML"));
    const archive = await deps.exportArchive(null, { includeCategories: true });
    const sizeBytes = await deps.downloadText(
      exportFilename("history", archive.exportedAt, "html"),
      "text/html",
      await deps.visitsToHtml(archive.visits, archive.exportedAt),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Full HTML exported",
      count: archive.counts.visits,
      detail: `${sizeBytes} bytes`,
      occurredAt: archive.exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedHtml", "Exported HTML"));
  }

  async function exportSelected() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive(items, { preserveOrder: true }));
    await deps.downloadJson(exportFilename("selected", archive.exportedAt, "json"), archive, saveOptions());
    await recordActivity({
      type: "export",
      label: "Selected JSON exported",
      count: items.length,
      occurredAt: archive.exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedSelectedJson", `Exported ${items.length} selected records as JSON`, [String(items.length)]));
  }

  async function exportSelectedCsv() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const exportedAt = deps.now().toISOString();
    await deps.downloadText(
      exportFilename("selected", exportedAt, "csv"),
      "text/csv",
      await deps.visitsToCsv(items),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Selected CSV exported",
      count: items.length,
      occurredAt: exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedSelectedCsv", `Exported ${items.length} selected records as CSV`, [String(items.length)]));
  }

  async function exportSelectedHtml() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusSelectRecordsFirst", "Select records first"));
      return;
    }

    const exportedAt = deps.now().toISOString();
    await deps.downloadText(
      exportFilename("selected", exportedAt, "html"),
      "text/html",
      await deps.visitsToHtml(items, exportedAt),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Selected HTML exported",
      count: items.length,
      occurredAt: exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedSelectedHtml", `Exported ${items.length} selected records as HTML`, [String(items.length)]));
  }

  async function exportFilteredResults() {
    setStatus(localizedMessage(getMessage, "statusPreparingResultArchive", "Preparing result archive"));
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusNoMatchingRecordsToExport", "No matching records to export"));
      return;
    }

    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive(items, { preserveOrder: true }));
    await deps.downloadJson(exportFilename("results", archive.exportedAt, "json"), archive, saveOptions());
    await recordActivity({
      type: "export",
      label: "Current results JSON exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: archive.exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedMatchingJson", `Exported ${items.length} matching records as JSON`, [String(items.length)]));
  }

  async function exportFilteredResultsCsv() {
    setStatus(localizedMessage(getMessage, "statusPreparingResultCsv", "Preparing result CSV"));
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusNoMatchingRecordsToExport", "No matching records to export"));
      return;
    }

    const exportedAt = deps.now().toISOString();
    await deps.downloadText(
      exportFilename("results", exportedAt, "csv"),
      "text/csv",
      await deps.visitsToCsv(items),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Current results CSV exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedMatchingCsv", `Exported ${items.length} matching records as CSV`, [String(items.length)]));
  }

  async function exportFilteredResultsHtml() {
    setStatus(localizedMessage(getMessage, "statusPreparingResultHtml", "Preparing result HTML"));
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus(localizedMessage(getMessage, "statusNoMatchingRecordsToExport", "No matching records to export"));
      return;
    }

    const exportedAt = deps.now().toISOString();
    await deps.downloadText(
      exportFilename("results", exportedAt, "html"),
      "text/html",
      await deps.visitsToHtml(items, exportedAt),
      saveOptions()
    );
    await recordActivity({
      type: "export",
      label: "Current results HTML exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: exportedAt
    });
    setStatus(localizedMessage(getMessage, "statusExportedMatchingHtml", `Exported ${items.length} matching records as HTML`, [String(items.length)]));
  }

  async function importFromFile(file) {
    setStatus(localizedMessage(getMessage, "statusReadingArchive", "Reading archive"));
    const text = await file.text();
    const archive = deps.archiveFromFileText(file, text);
    const integrity = await deps.verifyArchiveIntegrity(archive);
    const analysis = await deps.analyzeImportArchive(archive);

    if (!analysis.validRows && !analysis.rules) {
      setStatus(localizedMessage(getMessage, "statusNoImportableRecordsOrRules", "No importable history records or rules found"));
      return;
    }

    appState.stagedImport = {
      archive,
      analysis,
      fileName: file.name,
      integrity
    };
    renderImportPreview();
    switchTab("backup");
    setStatus(localizedMessage(getMessage, "statusReviewImportPreview", "Review import preview"));
  }

  function cancelStagedImport() {
    appState.stagedImport = null;
    renderImportPreview();
    setStatus(localizedMessage(getMessage, "statusImportCanceled", "Import canceled"));
  }

  async function confirmStagedImport() {
    if (!appState.stagedImport) {
      setStatus(localizedMessage(getMessage, "statusChooseArchiveFirst", "Choose an archive first"));
      return;
    }

    const { archive, integrity } = appState.stagedImport;
    if (integrity.checked && !integrity.ok && !deps.confirmAction(localizedMessage(
      getMessage,
      "confirmImportChecksumMismatch",
      "This archive checksum does not match. Import anyway?"
    ))) {
      setStatus(localizedMessage(getMessage, "statusImportCanceled", "Import canceled"));
      return;
    }

    setStatus(localizedMessage(getMessage, "statusImportingArchive", "Importing archive"));
    const result = await deps.importArchive(archive);
    appState.stagedImport = null;
    renderImportPreview();
    await renderRules();
    await runSearch();
    const integrityLabel = importIntegrityStatusLabel(integrity, getMessage);
    const ruleLabel = importRuleStatusLabel(result.rules, getMessage);
    const duplicateLabel = importDuplicateStatusLabel(result.duplicateRows, getMessage);
    const activityDetail = [
      result.rules ? `${result.rules} rule${result.rules === 1 ? "" : "s"}` : "",
      result.duplicateRows ? `${result.duplicateRows} duplicate row${result.duplicateRows === 1 ? "" : "s"} merged` : ""
    ].filter(Boolean).join("; ");
    await recordActivity({
      type: "import",
      label: "Archive imported",
      count: result.visits,
      detail: activityDetail,
      occurredAt: result.importedAt
    });
    const recordLabel = localizedMessage(
      getMessage,
      result.visits === 1 ? "importStatusRecordOne" : "importStatusRecordMany",
      `${result.visits} record${result.visits === 1 ? "" : "s"}`,
      [String(result.visits)]
    );
    setStatus(localizedMessage(
      getMessage,
      "statusImportedArchive",
      `Imported ${recordLabel}${ruleLabel}${integrityLabel}${duplicateLabel}`,
      [recordLabel, ruleLabel, integrityLabel, duplicateLabel]
    ));
    notifyVaultChanged("vault-import");
  }

  return {
    cancelStagedImport,
    confirmStagedImport,
    exportAll,
    exportCsv,
    exportFilteredResults,
    exportFilteredResultsCsv,
    exportFilteredResultsHtml,
    exportHtml,
    exportSelected,
    exportSelectedCsv,
    exportSelectedHtml,
    importFromFile,
    renderImportPreview
  };
}
