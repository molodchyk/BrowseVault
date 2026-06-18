import { createBackupActions } from "../../../src/features/backup-import/ui/actions.js";

export function previewElements() {
  return {
    importPreview: { id: "import-preview" },
    importPreviewTitle: { id: "import-preview-title" },
    importValid: { id: "import-valid" },
    importNew: { id: "import-new" },
    importExisting: { id: "import-existing" },
    importDuplicates: { id: "import-duplicates" },
    importHealth: { id: "import-health" },
    importPreviewNote: { id: "import-preview-note" },
    confirmImport: { id: "confirm-import" }
  };
}

export function createBackupActionsHarness({
  getMessage = () => "",
  getSortOrder = () => "newest",
  getSearchText = () => "docs site:example.com",
  preferences = {
    backupSaveMode: "downloads",
    backupFilenamePrefix: "browsevault"
  },
  searchVisits = async () => ({ results: [], total: 0 }),
  selected = [],
  stagedImport = null,
  services = {}
} = {}) {
  const statuses = [];
  const calls = [];
  const notifications = [];
  const appState = {
    preferences: {
      backupSaveMode: "downloads",
      ...preferences
    },
    stagedImport
  };
  const actions = createBackupActions({
    appState,
    elements: previewElements(),
    getMessage,
    getSortOrder,
    getSearchText,
    notifyVaultChanged: (reason) => notifications.push(reason),
    refreshStats: async () => calls.push("refreshStats"),
    renderRules: async () => calls.push("renderRules"),
    runSearch: async () => calls.push("runSearch"),
    searchVisits,
    selectedResults: async () => selected,
    services: {
      appendActivityLog: async () => {},
      renderImportPreview: (...args) => calls.push(["renderImportPreview", ...args]),
      ...services
    },
    setStatus: (message) => statuses.push(message),
    switchTab: (tabName) => calls.push(["switchTab", tabName])
  });

  return { actions, appState, calls, notifications, statuses };
}
