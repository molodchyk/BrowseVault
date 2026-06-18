import test from "node:test";
import assert from "node:assert/strict";
import { backupStatusDetails } from "../../../src/features/display-preferences/core/preferences.js";
import { createDisplayPreferencesController } from "../../../src/features/display-preferences/ui/preferences-controller.js";

function classListHarness() {
  const classes = new Set();
  return {
    classes,
    toggle(name, force) {
      if (force) {
        classes.add(name);
        return true;
      }
      classes.delete(name);
      return false;
    }
  };
}

function input(value = "") {
  return { value };
}

function output() {
  return {
    textContent: ""
  };
}

function createHarness({
  stats = {
    visits: 0,
    domains: 0,
    newestVisitTime: 0,
    meta: {
      lastBackup: null
    }
  },
  getMessage = () => "",
  storedPreferences,
  preferences = {
    theme: "system",
    accent: "teal",
    contrast: "standard",
    textSize: "standard",
    dateFormat: "system",
    defaultLimit: 500,
    backupReminderDays: 30,
    backupSaveMode: "downloads",
    backupFilenamePrefix: "browsevault",
    backupFilenameTemplate: "{prefix}-{kind}-{date}"
  }
} = {}) {
  const storageWrites = [];
  const statusMessages = [];
  const refreshAfterSaveCalls = [];
  const renderedActivity = [];
  const backupHealthClassList = classListHarness();
  const archiveHealthClassList = classListHarness();
  const appState = {
    preferences: { ...preferences }
  };
  const elements = {
    activityLog: { id: "activity-log" },
    archiveCapture: output(),
    archiveHealth: {
      textContent: "",
      classList: archiveHealthClassList
    },
    archiveStorage: output(),
    archiveStartup: output(),
    archiveSync: output(),
    archiveVault: output(),
    archiveTombstones: output(),
    archiveTopDomains: output(),
    archiveBusiestDay: output(),
    archiveActiveDays: output(),
    archiveDateRange: output(),
    backupChecksum: output(),
    backupFormat: output(),
    backupHealth: {
      textContent: "",
      classList: backupHealthClassList
    },
    backupLast: output(),
    backupNext: output(),
    backupRecords: output(),
    backupSize: output(),
    backupSelfTest: output(),
    limit: input(""),
    prefAccent: input("teal"),
    prefContrast: input("standard"),
    prefTextSize: input("standard"),
    prefDateFormat: input("system"),
    prefLimit: input("500"),
    prefBackupReminder: input("30"),
    prefBackupSaveMode: input("downloads"),
    prefBackupPrefix: input("browsevault"),
    prefBackupTemplate: input("{prefix}-{kind}-{date}"),
    prefTheme: input("system"),
    statBackup: output(),
    statDomains: output(),
    statNewest: output(),
    statVisits: output()
  };
  const root = {
    dataset: {}
  };
  const controller = createDisplayPreferencesController({
    appState,
    elements,
    getMessage,
    getStats: async () => stats,
    refreshAfterSave: async () => refreshAfterSaveCalls.push(true),
    root,
    services: {
      backupStatusDetails: (backup, options) => backupStatusDetails(backup, {
        ...options,
        now: Date.parse("2026-06-16T00:00:00.000Z")
      }),
      getLocalStorage: async (key) => ({ [key]: storedPreferences }),
      renderActivityLog: (...args) => renderedActivity.push(args),
      setLocalStorage: async (record) => storageWrites.push(record)
    },
    setStatus: (message) => statusMessages.push(message)
  });

  return { appState, archiveHealthClassList, backupHealthClassList, controller, elements, refreshAfterSaveCalls, renderedActivity, root, statusMessages, storageWrites };
}

test("loadPreferences normalizes stored preferences and applies them to UI state", async () => {
  const { appState, controller, elements, root } = createHarness({
    storedPreferences: {
      accent: "blue",
      contrast: "high",
      textSize: "large",
      dateFormat: "dmy",
      defaultLimit: "750",
      backupReminderDays: "14",
      backupSaveMode: "ask",
      backupFilenamePrefix: "Team Backup:/2026",
      backupFilenameTemplate: "{date}/{prefix}/{kind}",
      theme: "dark"
    }
  });

  await controller.loadPreferences();

  assert.deepEqual(appState.preferences, {
    accent: "blue",
    contrast: "high",
    textSize: "large",
    dateFormat: "dmy",
    defaultLimit: 750,
    backupReminderDays: 14,
    backupSaveMode: "ask",
    backupFilenamePrefix: "Team-Backup-2026",
    backupFilenameTemplate: "{date}-{prefix}-{kind}",
    theme: "dark"
  });
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.dataset.accent, "blue");
  assert.equal(root.dataset.contrast, "high");
  assert.equal(root.dataset.textSize, "large");
  assert.equal(elements.prefTheme.value, "dark");
  assert.equal(elements.prefAccent.value, "blue");
  assert.equal(elements.prefContrast.value, "high");
  assert.equal(elements.prefTextSize.value, "large");
  assert.equal(elements.prefDateFormat.value, "dmy");
  assert.equal(elements.prefLimit.value, "750");
  assert.equal(elements.prefBackupReminder.value, "14");
  assert.equal(elements.prefBackupSaveMode.value, "ask");
  assert.equal(elements.prefBackupPrefix.value, "Team-Backup-2026");
  assert.equal(elements.prefBackupTemplate.value, "{date}-{prefix}-{kind}");
  assert.equal(elements.limit.value, "750");
});

test("savePreferences persists normalized values, refreshes stats, reruns searches, and reports status", async () => {
  const { appState, controller, elements, refreshAfterSaveCalls, statusMessages, storageWrites } = createHarness();
  elements.prefTheme.value = "light";
  elements.prefAccent.value = "purple";
  elements.prefContrast.value = "high";
  elements.prefTextSize.value = "large";
  elements.prefDateFormat.value = "iso";
  elements.prefLimit.value = "999999";
  elements.prefBackupReminder.value = "0";
  elements.prefBackupSaveMode.value = "ask";
  elements.prefBackupPrefix.value = "Client Reports";
  elements.prefBackupTemplate.value = "{date} / {prefix} / {kind}";

  await controller.savePreferences();

  assert.equal(appState.preferences.defaultLimit, 50000);
  assert.equal(elements.limit.value, "50000");
  assert.deepEqual(storageWrites, [
    {
      "browseVault.preferences": {
        accent: "purple",
        backupFilenamePrefix: "Client-Reports",
        backupFilenameTemplate: "{date}-{prefix}-{kind}",
        backupReminderDays: 0,
        backupSaveMode: "ask",
        contrast: "high",
        dateFormat: "iso",
        defaultLimit: 50000,
        textSize: "large",
        theme: "light"
      }
    }
  ]);
  assert.deepEqual(refreshAfterSaveCalls, [true]);
  assert.deepEqual(statusMessages, ["Settings saved"]);
});

test("savePreferences can localize the saved status", async () => {
  const { controller, statusMessages } = createHarness({
    getMessage: (key) => key === "statusSettingsSaved" ? "Einstellungen gespeichert" : ""
  });

  await controller.savePreferences();

  assert.deepEqual(statusMessages, ["Einstellungen gespeichert"]);
});

test("refreshStats renders stat cards and backup health details", async () => {
  const exportedAt = "2026-06-01T00:00:00.000Z";
  const { archiveHealthClassList, backupHealthClassList, controller, elements, renderedActivity } = createHarness({
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      backupReminderDays: 30,
      dateFormat: "iso",
      defaultLimit: 500
    },
    stats: {
      visits: 42,
      domains: 7,
      newestVisitTime: Date.parse("2026-06-16T12:00:00.000Z"),
      insights: {
        activeDays: 2,
        averageVisitsPerActiveDay: 21,
        oldestVisitTime: Date.parse("2026-06-15T08:00:00.000Z"),
        newestVisitTime: Date.parse("2026-06-16T12:00:00.000Z"),
        topDomains: [
          { domain: "docs.example.com", count: 20 },
          { domain: "github.com", count: 12 }
        ],
        busiestDays: [
          { day: "2026-06-16", count: 24 }
        ]
      },
      vaultHealth: {
        storedRows: 44,
        activeRecords: 42,
        deletedRecords: 2,
        chromeDeletedRecords: 1,
        missingUrlRecords: 0,
        invalidTimeRecords: 0,
        duplicateActiveRecords: 0,
        issueRecords: 0
      },
      meta: {
        lastChromeSync: {
          stored: 41,
          syncedAt: "2026-06-16T11:00:00.000Z"
        },
        lastLiveCapture: {
          capturedAt: "2026-06-16T12:05:00.000Z",
          url: "https://docs.example.com/page"
        },
        lastStorageSelfCheck: {
          checkedAt: "2026-06-16T12:06:00.000Z",
          status: "passed"
        },
        lastStartedAt: "2026-06-16T10:00:00.000Z",
        lastBackup: {
          exportedAt,
          format: "json",
          records: 42,
          sizeBytes: 1536,
          selfTest: {
            records: 42,
            status: "passed"
          },
          sha256: "1234567890abcdef1234567890abcdef"
        },
        activityLog: [{
          id: "backup-1",
          type: "backup",
          label: "JSON backup exported",
          count: 42,
          occurredAt: exportedAt
        }]
      }
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statVisits.textContent, "42");
  assert.equal(elements.statDomains.textContent, "7");
  assert.equal(elements.statNewest.textContent, "2026-06-16");
  assert.equal(elements.statBackup.textContent, "2026-06-01");
  assert.equal(elements.backupHealth.textContent, "Backup current");
  assert.match(elements.backupNext.textContent, /^2026-07-01 \d{2}:\d{2}$/);
  assert.equal(elements.backupFormat.textContent, "JSON");
  assert.equal(elements.backupRecords.textContent, "42");
  assert.equal(elements.backupSize.textContent, "1.5 KB");
  assert.equal(elements.backupSelfTest.textContent, "Passed 42 records");
  assert.equal(elements.backupChecksum.textContent, "1234567890ab...90abcdef");
  assert.equal(backupHealthClassList.classes.has("is-ok"), true);
  assert.equal(backupHealthClassList.classes.has("is-warning"), false);
  assert.equal(elements.archiveHealth.textContent, "Archive recording ready");
  assert.match(elements.archiveStartup.textContent, /^2026-06-16 \d{2}:00$/);
  assert.match(elements.archiveSync.textContent, /^2026-06-16 \d{2}:00 · 41 stored$/);
  assert.match(elements.archiveCapture.textContent, /^2026-06-16 \d{2}:05 · docs\.example\.com$/);
  assert.match(elements.archiveStorage.textContent, /^Passed 2026-06-16 \d{2}:06$/);
  assert.equal(elements.archiveVault.textContent, "42 active · 44 stored");
  assert.equal(elements.archiveTombstones.textContent, "2 deleted tombstones");
  assert.equal(elements.archiveTopDomains.textContent, "docs.example.com (20) · github.com (12)");
  assert.match(elements.archiveBusiestDay.textContent, /^2026-06-16 · 24 visits$/);
  assert.equal(elements.archiveActiveDays.textContent, "2 days · 21.0 visits/day");
  assert.equal(elements.archiveDateRange.textContent, "2026-06-15 to 2026-06-16");
  assert.equal(archiveHealthClassList.classes.has("is-ok"), true);
  assert.equal(archiveHealthClassList.classes.has("is-warning"), false);
  assert.equal(renderedActivity.length, 1);
  assert.equal(renderedActivity[0][0], elements.activityLog);
  assert.equal(renderedActivity[0][1].length, 1);
  assert.equal(renderedActivity[0][1][0].label, "JSON backup exported");
  assert.equal(renderedActivity[0][2].emptyText, "No activity logged yet.");
  assert.equal(renderedActivity[0][2].formatDate(Date.parse(exportedAt)), "2026-06-01");
});

test("refreshStats passes localized activity-log empty text", async () => {
  const { controller, renderedActivity } = createHarness({
    getMessage: (key) => key === "noActivityLogged" ? "Noch keine Aktivitaet protokolliert." : "",
    stats: {
      visits: 0,
      domains: 0,
      newestVisitTime: 0,
      insights: {},
      meta: {
        activityLog: [],
        lastBackup: null
      },
      vaultHealth: {}
    }
  });

  await controller.refreshStats();

  assert.equal(renderedActivity.length, 1);
  assert.equal(renderedActivity[0][2].emptyText, "Noch keine Aktivitaet protokolliert.");
});

test("refreshStats can localize the empty backup stat", async () => {
  const { controller, elements } = createHarness({
    getMessage: (key) => key === "statBackupEmpty" ? "Nie" : "",
    stats: {
      visits: 0,
      domains: 0,
      newestVisitTime: 0,
      insights: {},
      meta: {
        activityLog: [],
        lastBackup: null
      },
      vaultHealth: {}
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Nie");
});

test("refreshStats applies the configured backup reminder interval", async () => {
  const { backupHealthClassList, controller, elements } = createHarness({
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      backupFilenamePrefix: "browsevault",
      backupReminderDays: 14,
      dateFormat: "iso",
      defaultLimit: 500
    },
    stats: {
      visits: 42,
      domains: 7,
      newestVisitTime: Date.parse("2026-06-16T12:00:00.000Z"),
      meta: {
        lastBackup: {
          exportedAt: "2026-06-01T00:00:00.000Z",
          format: "json",
          records: 42
        }
      }
    }
  });

  await controller.refreshStats();

  assert.equal(elements.backupHealth.textContent, "Backup due after 14 days");
  assert.equal(backupHealthClassList.classes.has("is-warning"), true);
  assert.equal(backupHealthClassList.classes.has("is-ok"), false);
  assert.match(elements.backupNext.textContent, /^2026-06-15 \d{2}:\d{2}$/);
});

test("refreshStats ignores legacy non-JSON backup metadata", async () => {
  const { backupHealthClassList, controller, elements } = createHarness({
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      backupFilenamePrefix: "browsevault",
      backupReminderDays: 14,
      dateFormat: "iso",
      defaultLimit: 500
    },
    stats: {
      visits: 42,
      domains: 7,
      newestVisitTime: Date.parse("2026-06-16T12:00:00.000Z"),
      meta: {
        lastBackup: {
          exportedAt: "2026-06-15T00:00:00.000Z",
          format: "html",
          records: 42,
          sizeBytes: 1024
        }
      }
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Never");
  assert.equal(elements.backupHealth.textContent, "No backup yet");
  assert.equal(elements.backupLast.textContent, "Never");
  assert.equal(elements.backupFormat.textContent, "-");
  assert.equal(elements.backupRecords.textContent, "0");
  assert.equal(elements.backupSize.textContent, "-");
  assert.equal(backupHealthClassList.classes.has("is-warning"), true);
});

test("refreshStats passes localized empty backup status labels", async () => {
  const messages = new Map([
    ["backupChecksumUnavailable", "Nicht verfuegbar"],
    ["backupHealthEmpty", "Noch keine Sicherung"],
    ["backupNextAfterFirst", "Nach erster Sicherung"],
    ["backupReminderOff", "Aus"],
    ["statBackupEmpty", "Nie"]
  ]);
  const { controller, elements } = createHarness({
    getMessage: (key) => messages.get(key) || "",
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      backupFilenamePrefix: "browsevault",
      backupReminderDays: 0,
      dateFormat: "iso",
      defaultLimit: 500
    },
    stats: {
      visits: 0,
      domains: 0,
      newestVisitTime: 0,
      meta: {
        lastBackup: null
      }
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Nie");
  assert.equal(elements.backupHealth.textContent, "Noch keine Sicherung");
  assert.equal(elements.backupLast.textContent, "Nie");
  assert.equal(elements.backupNext.textContent, "Aus");
  assert.equal(elements.backupChecksum.textContent, "Nicht verfuegbar");
});

test("requested limits respect current field values and quick-open cap", () => {
  const { controller, elements } = createHarness();

  elements.limit.value = "1200";

  assert.equal(controller.requestedResultLimit(), 1200);
  assert.equal(controller.quickResultLimit(), 100);
});
