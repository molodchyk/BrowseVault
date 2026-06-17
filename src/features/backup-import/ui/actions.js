import {
  analyzeImportArchive,
  appendActivityLog,
  exportArchive,
  importArchive,
  setMeta
} from "../../../storage.js";
import { visitsToCsv, visitsToHtml } from "../../history-export/core/export-format.js";
import { archiveFromFileText } from "../core/archive-parser.js";
import { backupExportFilename } from "../core/backup-filenames.js";
import { createBackupSelfTest } from "../core/backup-verification.js";
import {
  attachArchiveIntegrity,
  verifyArchiveIntegrity
} from "../core/archive-integrity.js";
import { renderImportPreview as renderImportPreviewUi } from "./render-import-preview.js";

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
  visitsToCsv,
  visitsToHtml
};

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

export function downloadJson(filename, data, runtime = globalThis) {
  return downloadText(filename, "application/json", JSON.stringify(data, null, 2), runtime);
}

export function downloadText(filename, mimeType, text, runtime = globalThis) {
  const blob = new runtime.Blob([text], { type: mimeType });
  const url = runtime.URL.createObjectURL(blob);
  const anchor = runtime.document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  runtime.URL.revokeObjectURL(url);
  return blob.size;
}

export function createBackupActions({
  appState,
  elements,
  getSearchText = () => "",
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
    return deps.backupExportFilename(appState.preferences?.backupFilenamePrefix, kind, exportedAt, extension);
  }

  async function recordActivity(event) {
    await deps.appendActivityLog(event);
    await refreshStats();
  }

  async function matchingResultsForExport() {
    const { results } = await searchVisits(getSearchText(), {
      limit: "all"
    });
    return results;
  }

  async function exportAll() {
    setStatus("Preparing archive");
    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive());
    const selfTest = await deps.createBackupSelfTest(archive, deps.verifyArchiveIntegrity, deps.now);
    if (selfTest.status !== "passed") {
      setStatus("Backup self-test failed");
      return;
    }

    const sizeBytes = deps.downloadJson(exportFilename("archive", archive.exportedAt, "json"), archive);
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
    setStatus("Exported archive");
  }

  async function exportCsv() {
    setStatus("Preparing CSV");
    const archive = await deps.exportArchive();
    const sizeBytes = deps.downloadText(
      exportFilename("history", archive.exportedAt, "csv"),
      "text/csv",
      deps.visitsToCsv(archive.visits)
    );
    await deps.setMeta("lastBackup", {
      exportedAt: archive.exportedAt,
      format: "csv",
      records: archive.counts.visits,
      sizeBytes
    });
    await recordActivity({
      type: "backup",
      label: "CSV backup exported",
      count: archive.counts.visits,
      detail: `${sizeBytes} bytes`,
      occurredAt: archive.exportedAt
    });
    setStatus("Exported CSV");
  }

  async function exportHtml() {
    setStatus("Preparing HTML");
    const archive = await deps.exportArchive();
    const sizeBytes = deps.downloadText(
      exportFilename("history", archive.exportedAt, "html"),
      "text/html",
      deps.visitsToHtml(archive.visits, archive.exportedAt)
    );
    await deps.setMeta("lastBackup", {
      exportedAt: archive.exportedAt,
      format: "html",
      records: archive.counts.visits,
      sizeBytes
    });
    await recordActivity({
      type: "backup",
      label: "HTML backup exported",
      count: archive.counts.visits,
      detail: `${sizeBytes} bytes`,
      occurredAt: archive.exportedAt
    });
    setStatus("Exported HTML");
  }

  async function exportSelected() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive(items));
    deps.downloadJson(exportFilename("selected", archive.exportedAt, "json"), archive);
    await recordActivity({
      type: "export",
      label: "Selected JSON exported",
      count: items.length,
      occurredAt: archive.exportedAt
    });
    setStatus(`Exported ${items.length} selected records as JSON`);
  }

  async function exportSelectedCsv() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const exportedAt = deps.now().toISOString();
    deps.downloadText(
      exportFilename("selected", exportedAt, "csv"),
      "text/csv",
      deps.visitsToCsv(items)
    );
    await recordActivity({
      type: "export",
      label: "Selected CSV exported",
      count: items.length,
      occurredAt: exportedAt
    });
    setStatus(`Exported ${items.length} selected records as CSV`);
  }

  async function exportSelectedHtml() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
      return;
    }

    const exportedAt = deps.now().toISOString();
    deps.downloadText(
      exportFilename("selected", exportedAt, "html"),
      "text/html",
      deps.visitsToHtml(items, exportedAt)
    );
    await recordActivity({
      type: "export",
      label: "Selected HTML exported",
      count: items.length,
      occurredAt: exportedAt
    });
    setStatus(`Exported ${items.length} selected records as HTML`);
  }

  async function exportFilteredResults() {
    setStatus("Preparing result archive");
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus("No matching records to export");
      return;
    }

    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive(items));
    deps.downloadJson(exportFilename("results", archive.exportedAt, "json"), archive);
    await recordActivity({
      type: "export",
      label: "Current results JSON exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: archive.exportedAt
    });
    setStatus(`Exported ${items.length} matching records as JSON`);
  }

  async function exportFilteredResultsCsv() {
    setStatus("Preparing result CSV");
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus("No matching records to export");
      return;
    }

    const exportedAt = deps.now().toISOString();
    deps.downloadText(
      exportFilename("results", exportedAt, "csv"),
      "text/csv",
      deps.visitsToCsv(items)
    );
    await recordActivity({
      type: "export",
      label: "Current results CSV exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: exportedAt
    });
    setStatus(`Exported ${items.length} matching records as CSV`);
  }

  async function exportFilteredResultsHtml() {
    setStatus("Preparing result HTML");
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus("No matching records to export");
      return;
    }

    const exportedAt = deps.now().toISOString();
    deps.downloadText(
      exportFilename("results", exportedAt, "html"),
      "text/html",
      deps.visitsToHtml(items, exportedAt)
    );
    await recordActivity({
      type: "export",
      label: "Current results HTML exported",
      count: items.length,
      detail: getSearchText().trim(),
      occurredAt: exportedAt
    });
    setStatus(`Exported ${items.length} matching records as HTML`);
  }

  async function importFromFile(file) {
    setStatus("Reading archive");
    const text = await file.text();
    const archive = deps.archiveFromFileText(file, text);
    const integrity = await deps.verifyArchiveIntegrity(archive);
    const analysis = await deps.analyzeImportArchive(archive);

    if (!analysis.validRows && !analysis.rules) {
      setStatus("No importable history records or rules found");
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
    setStatus("Review import preview");
  }

  function cancelStagedImport() {
    appState.stagedImport = null;
    renderImportPreview();
    setStatus("Import canceled");
  }

  async function confirmStagedImport() {
    if (!appState.stagedImport) {
      setStatus("Choose an archive first");
      return;
    }

    const { archive, integrity } = appState.stagedImport;
    if (integrity.checked && !integrity.ok && !deps.confirmAction("This archive checksum does not match. Import anyway?")) {
      setStatus("Import canceled");
      return;
    }

    setStatus("Importing archive");
    const result = await deps.importArchive(archive);
    appState.stagedImport = null;
    renderImportPreview();
    await renderRules();
    await runSearch();
    const integrityLabel = integrity.checked
      ? integrity.ok
        ? " with verified checksum"
        : " after checksum warning"
      : "";
    const ruleLabel = result.rules ? ` and ${result.rules} rule${result.rules === 1 ? "" : "s"}` : "";
    const duplicateLabel = result.duplicateRows
      ? `; ${result.duplicateRows} duplicate row${result.duplicateRows === 1 ? "" : "s"} merged`
      : "";
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
    setStatus(`Imported ${result.visits} record${result.visits === 1 ? "" : "s"}${ruleLabel}${integrityLabel}${duplicateLabel}`);
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
