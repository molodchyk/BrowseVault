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
import { stringifyJson } from "../core/json-stringify.js";
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
  stringifyJson,
  verifyArchiveIntegrity,
  visitsToCsv: visitsToCsvAsync,
  visitsToHtml: visitsToHtmlAsync
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

export async function downloadJson(filename, data, options = {}, runtime = globalThis) {
  const text = await stringifyJson(data, {
    chunkSize: options.jsonChunkSize,
    scheduler: options.jsonScheduler,
    space: 2
  });
  return downloadText(filename, "application/json", text, options, runtime);
}

function downloadWithSavePrompt(url, filename, runtime) {
  const downloads = runtime.chrome?.downloads;
  if (!downloads?.download) {
    return null;
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, downloadId) => {
      if (settled) {
        return;
      }

      settled = true;
      if (error) {
        reject(error);
        return;
      }

      resolve(downloadId);
    };
    const callback = (downloadId) => {
      const lastError = runtime.chrome?.runtime?.lastError;
      finish(lastError ? new Error(lastError.message) : null, downloadId);
    };

    try {
      const maybePromise = downloads.download.call(downloads, {
        filename,
        saveAs: true,
        url
      }, callback);

      if (maybePromise?.then) {
        maybePromise.then((downloadId) => finish(null, downloadId)).catch((error) => finish(error));
      }
    } catch (error) {
      finish(error);
    }
  });
}

export async function downloadText(filename, mimeType, text, options = {}, runtime = globalThis) {
  const blob = new runtime.Blob([text], { type: mimeType });
  const url = runtime.URL.createObjectURL(blob);
  const useSavePrompt = options.saveMode === "ask";

  if (useSavePrompt) {
    const prompted = downloadWithSavePrompt(url, filename, runtime);
    if (prompted) {
      try {
        await prompted;
        return blob.size;
      } finally {
        runtime.URL.revokeObjectURL(url);
      }
    }
  }

  const anchor = runtime.document.createElement("a");

  try {
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    return blob.size;
  } finally {
    runtime.URL.revokeObjectURL(url);
  }
}

export function createBackupActions({
  appState,
  elements,
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
    setStatus("Preparing archive");
    const archive = await deps.attachArchiveIntegrity(await deps.exportArchive());
    const selfTest = await deps.createBackupSelfTest(archive, deps.verifyArchiveIntegrity, deps.now);
    if (selfTest.status !== "passed") {
      setStatus("Backup self-test failed");
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
    setStatus("Exported archive");
  }

  async function exportCsv() {
    setStatus("Preparing CSV");
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
    setStatus("Exported CSV");
  }

  async function exportHtml() {
    setStatus("Preparing HTML");
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
    setStatus("Exported HTML");
  }

  async function exportSelected() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
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
    setStatus(`Exported ${items.length} selected records as JSON`);
  }

  async function exportSelectedCsv() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
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
    setStatus(`Exported ${items.length} selected records as CSV`);
  }

  async function exportSelectedHtml() {
    const items = await selectedResults();
    if (!items.length) {
      setStatus("Select records first");
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
    setStatus(`Exported ${items.length} selected records as HTML`);
  }

  async function exportFilteredResults() {
    setStatus("Preparing result archive");
    const items = await matchingResultsForExport();
    if (!items.length) {
      setStatus("No matching records to export");
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
