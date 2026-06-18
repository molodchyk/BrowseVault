import test from "node:test";
import assert from "node:assert/strict";
import { backupStatusDetails } from "../../../src/features/display-preferences/core/preferences.js";
import { createDisplayPreferencesController } from "../../../src/features/display-preferences/ui/preferences-controller.js";

function classListHarness() {
  return {
    toggle() {
      return false;
    }
  };
}

function input(value = "") {
  return { value };
}

function output() {
  return { textContent: "" };
}

function createHarness({
  getMessage = () => "",
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
  },
  stats = {
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
} = {}) {
  const renderedActivity = [];
  const statusMessages = [];
  const elements = {
    activityLog: { id: "activity-log" },
    archiveCapture: output(),
    archiveHealth: { textContent: "", classList: classListHarness() },
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
    backupConfidence: output(),
    backupFormat: output(),
    backupHealth: { textContent: "", classList: classListHarness() },
    backupLast: output(),
    backupNext: output(),
    backupRecords: output(),
    backupSize: output(),
    backupSelfTest: output(),
    limit: input(""),
    prefAccent: input("teal"),
    prefBackupPrefix: input("browsevault"),
    prefBackupReminder: input("30"),
    prefBackupSaveMode: input("downloads"),
    prefBackupTemplate: input("{prefix}-{kind}-{date}"),
    prefContrast: input("standard"),
    prefDateFormat: input("system"),
    prefLimit: input("500"),
    prefTextSize: input("standard"),
    prefTheme: input("system"),
    statBackup: output(),
    statDomains: output(),
    statNewest: output(),
    statVisits: output()
  };
  const controller = createDisplayPreferencesController({
    appState: {
      preferences: { ...preferences }
    },
    elements,
    getMessage,
    getStats: async () => stats,
    refreshAfterSave: async () => {},
    root: { dataset: {} },
    services: {
      backupStatusDetails: (backup, options) => backupStatusDetails(backup, {
        ...options,
        now: Date.parse("2026-06-16T00:00:00.000Z")
      }),
      getLocalStorage: async () => ({}),
      renderActivityLog: (...args) => renderedActivity.push(args),
      setLocalStorage: async () => {}
    },
    setStatus: (message) => statusMessages.push(message)
  });

  return { controller, elements, renderedActivity, statusMessages };
}

test("savePreferences can localize the saved status", async () => {
  const { controller, statusMessages } = createHarness({
    getMessage: (key) => key === "statusSettingsSaved" ? "Einstellungen gespeichert" : ""
  });

  await controller.savePreferences();

  assert.deepEqual(statusMessages, ["Einstellungen gespeichert"]);
});

test("refreshStats passes localized activity-log empty text", async () => {
  const { controller, renderedActivity } = createHarness({
    getMessage: (key) => key === "noActivityLogged" ? "Noch keine Aktivitaet protokolliert." : ""
  });

  await controller.refreshStats();

  assert.equal(renderedActivity.length, 1);
  assert.equal(renderedActivity[0][2].emptyText, "Noch keine Aktivitaet protokolliert.");
});

test("refreshStats passes activity-log label localization through the renderer", async () => {
  const { controller, renderedActivity } = createHarness({
    getMessage: (key) => key === "activityLabelJsonBackupExported" ? "JSON Sicherung exportiert" : "",
    stats: {
      visits: 1,
      domains: 1,
      newestVisitTime: Date.parse("2026-06-16T00:00:00.000Z"),
      insights: {},
      meta: {
        activityLog: [{
          id: "backup-1",
          type: "backup",
          label: "JSON backup exported",
          count: 1,
          occurredAt: "2026-06-16T00:00:00.000Z"
        }],
        lastBackup: null
      },
      vaultHealth: {}
    }
  });

  await controller.refreshStats();

  assert.equal(renderedActivity.length, 1);
  assert.equal(renderedActivity[0][2].getMessage("activityLabelJsonBackupExported"), "JSON Sicherung exportiert");
});

test("refreshStats can localize the empty backup stat", async () => {
  const { controller, elements } = createHarness({
    getMessage: (key) => key === "statBackupEmpty" ? "Nie" : ""
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Nie");
});

test("refreshStats can localize the empty newest stat", async () => {
  const { controller, elements } = createHarness({
    getMessage: (key) => key === "statNewestEmpty" ? "Keine Besuche" : ""
  });

  await controller.refreshStats();

  assert.equal(elements.statNewest.textContent, "Keine Besuche");
});

test("refreshStats passes localized empty backup status labels", async () => {
  const messages = new Map([
    ["backupChecksumUnavailable", "Nicht verfuegbar"],
    ["backupConfidenceMissing", "Keine wiederherstellbare Sicherung"],
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
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Nie");
  assert.equal(elements.backupHealth.textContent, "Noch keine Sicherung");
  assert.equal(elements.backupLast.textContent, "Nie");
  assert.equal(elements.backupNext.textContent, "Aus");
  assert.equal(elements.backupConfidence.textContent, "Keine wiederherstellbare Sicherung");
  assert.equal(elements.backupChecksum.textContent, "Nicht verfuegbar");
});

test("refreshStats passes localized dynamic backup status labels", async () => {
  const { controller, elements } = createHarness({
    getMessage(key, substitutions = []) {
      if (key === "backupHealthDueMany") {
        return `Sicherung faellig nach ${substitutions[0]} Tagen`;
      }

      if (key === "backupSelfTestPassedRecordMany") {
        return `${substitutions[0]} Datensaetze bestanden`;
      }

      if (key === "backupConfidenceHighRecordMany") {
        return `Hoch - ${substitutions[0]} wiederherstellbare Datensaetze`;
      }

      return "";
    },
    stats: {
      visits: 1,
      domains: 1,
      newestVisitTime: Date.parse("2026-06-16T00:00:00.000Z"),
      insights: {},
      meta: {
        activityLog: [],
        lastBackup: {
          exportedAt: "2026-05-01T00:00:00.000Z",
          format: "json",
          records: 12,
          sizeBytes: 1536,
          selfTest: {
            records: 12,
            restorableRecords: 12,
            checksum: "verified",
            status: "passed"
          }
        }
      },
      vaultHealth: {}
    }
  });

  await controller.refreshStats();

  assert.equal(elements.backupHealth.textContent, "Sicherung faellig nach 30 Tagen");
  assert.equal(elements.backupSelfTest.textContent, "12 Datensaetze bestanden");
  assert.equal(elements.backupConfidence.textContent, "Hoch - 12 wiederherstellbare Datensaetze");
});

test("refreshStats passes localized archive recorder empty labels", async () => {
  const messages = new Map([
    ["archiveNoTombstones", "Keine geloeschten Merker"],
    ["archiveNotChecked", "Noch nicht geprueft"],
    ["archiveNotRecorded", "Nicht aufgezeichnet"],
    ["archiveNotSynced", "Noch nicht synchronisiert"],
    ["archiveWaitingForVisit", "Wartet auf naechsten Besuch"]
  ]);
  const { controller, elements } = createHarness({
    getMessage: (key) => messages.get(key) || ""
  });

  await controller.refreshStats();

  assert.equal(elements.archiveStartup.textContent, "Nicht aufgezeichnet");
  assert.equal(elements.archiveSync.textContent, "Noch nicht synchronisiert");
  assert.equal(elements.archiveCapture.textContent, "Wartet auf naechsten Besuch");
  assert.equal(elements.archiveStorage.textContent, "Noch nicht geprueft");
  assert.equal(elements.archiveTombstones.textContent, "Keine geloeschten Merker");
});

test("refreshStats passes localized dynamic archive recorder labels", async () => {
  const { controller, elements } = createHarness({
    getMessage(key, substitutions = []) {
      if (key === "archiveHealthReady") {
        return "Archiv bereit";
      }

      if (key === "archiveSyncStored") {
        return `${substitutions[1]} gespeichert`;
      }

      if (key === "archiveVaultRecordCounts") {
        return `${substitutions[0]} aktiv / ${substitutions[1]} gespeichert`;
      }

      return "";
    },
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      dateFormat: "iso",
      defaultLimit: 500,
      backupReminderDays: 30,
      backupSaveMode: "downloads",
      backupFilenamePrefix: "browsevault",
      backupFilenameTemplate: "{prefix}-{kind}-{date}"
    },
    stats: {
      visits: 3,
      domains: 1,
      newestVisitTime: Date.parse("2026-06-16T00:00:00.000Z"),
      insights: {},
      meta: {
        activityLog: [],
        lastBackup: null,
        lastChromeSync: {
          stored: 42,
          syncedAt: "2026-06-16T09:00:00.000Z"
        },
        lastStorageSelfCheck: {
          checkedAt: "2026-06-16T09:30:00.000Z",
          status: "passed"
        }
      },
      vaultHealth: {
        activeRecords: 3,
        storedRows: 5
      }
    }
  });

  await controller.refreshStats();

  assert.equal(elements.archiveHealth.textContent, "Archiv bereit");
  assert.equal(elements.archiveSync.textContent, "42 gespeichert");
  assert.equal(elements.archiveVault.textContent, "3 aktiv / 5 gespeichert");
});

test("refreshStats passes localized archive insight empty labels", async () => {
  const messages = new Map([
    ["noActiveDaysYet", "Noch keine aktiven Tage"],
    ["noDomainsYet", "Noch keine Domains"],
    ["noVisitsYet", "Noch keine Besuche"]
  ]);
  const { controller, elements } = createHarness({
    getMessage: (key) => messages.get(key) || ""
  });

  await controller.refreshStats();

  assert.equal(elements.archiveTopDomains.textContent, "Noch keine Domains");
  assert.equal(elements.archiveBusiestDay.textContent, "Noch keine Besuche");
  assert.equal(elements.archiveActiveDays.textContent, "Noch keine aktiven Tage");
  assert.equal(elements.archiveDateRange.textContent, "Noch keine Besuche");
});

test("refreshStats passes localized dynamic archive insight labels", async () => {
  const { controller, elements } = createHarness({
    getMessage(key, substitutions = []) {
      if (key === "archiveDomainCount") {
        return `${substitutions[0]} mit ${substitutions[1]}`;
      }

      if (key === "archiveVisitMany") {
        return `${substitutions[0]} Besuche`;
      }

      if (key === "archiveBusiestDayVisits") {
        return `${substitutions[0]}: ${substitutions[1]}`;
      }

      if (key === "archiveActiveDayStatsMany") {
        return `${substitutions[0]} aktive Tage`;
      }

      if (key === "archiveDateRange") {
        return `${substitutions[0]} bis ${substitutions[1]}`;
      }

      return "";
    },
    preferences: {
      theme: "system",
      accent: "teal",
      contrast: "standard",
      textSize: "standard",
      dateFormat: "iso",
      defaultLimit: 500,
      backupReminderDays: 30,
      backupSaveMode: "downloads",
      backupFilenamePrefix: "browsevault",
      backupFilenameTemplate: "{prefix}-{kind}-{date}"
    },
    stats: {
      visits: 4,
      domains: 1,
      newestVisitTime: Date.parse("2026-06-17T00:00:00.000Z"),
      insights: {
        activeDays: 2,
        averageVisitsPerActiveDay: 2,
        oldestVisitTime: new Date(2026, 5, 16, 10, 0).getTime(),
        newestVisitTime: new Date(2026, 5, 17, 11, 0).getTime(),
        topDomains: [
          { domain: "example.com", count: 4 }
        ],
        busiestDays: [
          { day: "2026-06-17", count: 4 }
        ]
      },
      meta: {
        activityLog: [],
        lastBackup: null
      },
      vaultHealth: {}
    }
  });

  await controller.refreshStats();

  assert.equal(elements.archiveTopDomains.textContent, "example.com mit 4");
  assert.equal(elements.archiveBusiestDay.textContent, "2026-06-17: 4 Besuche");
  assert.equal(elements.archiveActiveDays.textContent, "2 aktive Tage");
  assert.equal(elements.archiveDateRange.textContent, "2026-06-16 bis 2026-06-17");
});
