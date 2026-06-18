import {
  localizedCountMessage,
  localizedMessage
} from "./localized-messages.js";

function retentionDaysFromInput(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 ? days : null;
}

export function createCleanupActions({
  appState,
  deps,
  elements,
  getMessage,
  notifyVaultChanged,
  recordActivity,
  refreshStats,
  runSearch,
  setStatus
}) {
  async function previewRetentionCleanup() {
    const retentionDays = retentionDaysFromInput(elements.retentionDays.value);
    if (!retentionDays) {
      setStatus(localizedMessage(getMessage, "statusEnterRetentionDays", "Enter retention days of 1 or more"));
      return;
    }

    const candidates = await deps.getRetentionCleanupCandidates(retentionDays);
    if (!candidates.length) {
      setStatus(localizedMessage(getMessage, "statusNoCleanupCandidatesOlderThan", `No cleanup candidates older than ${retentionDays} days`, [String(retentionDays)]));
      return;
    }

    setStatus(localizedCountMessage(
      getMessage,
      candidates.length,
      "statusRetentionPreviewOne",
      "statusRetentionPreviewMany",
      `${candidates.length} vault record${candidates.length === 1 ? "" : "s"} older than ${retentionDays} days can be cleaned up. Whitelisted domains are kept.`,
      `${candidates.length} vault record${candidates.length === 1 ? "" : "s"} older than ${retentionDays} days can be cleaned up. Whitelisted domains are kept.`,
      [String(retentionDays)]
    ));
  }

  async function cleanupByRetention() {
    const retentionDays = retentionDaysFromInput(elements.retentionDays.value);
    if (!retentionDays) {
      setStatus(localizedMessage(getMessage, "statusEnterRetentionDays", "Enter retention days of 1 or more"));
      return;
    }

    const candidates = await deps.getRetentionCleanupCandidates(retentionDays);
    if (!candidates.length) {
      setStatus(localizedMessage(getMessage, "statusNoCleanupCandidatesOlderThan", `No cleanup candidates older than ${retentionDays} days`, [String(retentionDays)]));
      return;
    }

    const message = `Move ${candidates.length} vault record${candidates.length === 1 ? "" : "s"} older than ${retentionDays} days to undoable deletion? Whitelisted domains will be kept.`;
    if (!deps.confirmAction(localizedCountMessage(
      getMessage,
      candidates.length,
      "confirmRetentionCleanupOne",
      "confirmRetentionCleanupMany",
      message,
      message,
      [String(retentionDays)]
    ))) {
      setStatus(localizedMessage(getMessage, "statusRetentionCleanupCanceled", "Retention cleanup canceled"));
      return;
    }

    const deleted = await deps.markDeletedByIds(candidates.map((visit) => visit.id));
    await recordActivity({
      type: "cleanup",
      label: "Retention cleanup",
      count: deleted,
      detail: `${retentionDays} days`
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusCleanedRetentionOne",
      "statusCleanedRetentionMany",
      `Cleaned up ${deleted} old vault record${deleted === 1 ? "" : "s"}. Whitelisted domains kept.`,
      `Cleaned up ${deleted} old vault record${deleted === 1 ? "" : "s"}. Whitelisted domains kept.`
    ));
    notifyVaultChanged("vault-cleanup");
  }

  async function previewDuplicateCleanup() {
    const candidates = await deps.getDuplicateCleanupCandidates();
    if (!candidates.length) {
      setStatus(localizedMessage(getMessage, "statusNoDuplicateVaultRecords", "No duplicate vault records found"));
      return;
    }

    setStatus(localizedCountMessage(
      getMessage,
      candidates.length,
      "statusDuplicatePreviewOne",
      "statusDuplicatePreviewMany",
      `${candidates.length} duplicate vault record${candidates.length === 1 ? "" : "s"} can be cleaned up. One record per URL and visit time is kept.`,
      `${candidates.length} duplicate vault record${candidates.length === 1 ? "" : "s"} can be cleaned up. One record per URL and visit time is kept.`
    ));
  }

  async function cleanupDuplicates() {
    const candidates = await deps.getDuplicateCleanupCandidates();
    if (!candidates.length) {
      setStatus(localizedMessage(getMessage, "statusNoDuplicateVaultRecords", "No duplicate vault records found"));
      return;
    }

    const message = `Move ${candidates.length} duplicate vault record${candidates.length === 1 ? "" : "s"} to undoable deletion? One record per matching URL and visit time will be kept.`;
    if (!deps.confirmAction(localizedCountMessage(
      getMessage,
      candidates.length,
      "confirmDuplicateCleanupOne",
      "confirmDuplicateCleanupMany",
      message,
      message
    ))) {
      setStatus(localizedMessage(getMessage, "statusDuplicateCleanupCanceled", "Duplicate cleanup canceled"));
      return;
    }

    const deleted = await deps.markDeletedByIds(candidates.map((visit) => visit.id));
    await recordActivity({
      type: "cleanup",
      label: "Duplicate cleanup",
      count: deleted,
      detail: "Same URL and visit time"
    });
    appState.selectedIds.clear();
    await refreshStats();
    await runSearch();
    setStatus(localizedCountMessage(
      getMessage,
      deleted,
      "statusCleanedDuplicateOne",
      "statusCleanedDuplicateMany",
      `Cleaned up ${deleted} duplicate vault record${deleted === 1 ? "" : "s"}`,
      `Cleaned up ${deleted} duplicate vault record${deleted === 1 ? "" : "s"}`
    ));
    notifyVaultChanged("vault-cleanup");
  }

  return {
    cleanupByRetention,
    cleanupDuplicates,
    previewDuplicateCleanup,
    previewRetentionCleanup
  };
}
