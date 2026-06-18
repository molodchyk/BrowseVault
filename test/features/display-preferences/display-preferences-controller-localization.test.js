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
    }
  });

  await controller.refreshStats();

  assert.equal(elements.statBackup.textContent, "Nie");
  assert.equal(elements.backupHealth.textContent, "Noch keine Sicherung");
  assert.equal(elements.backupLast.textContent, "Nie");
  assert.equal(elements.backupNext.textContent, "Aus");
  assert.equal(elements.backupChecksum.textContent, "Nicht verfuegbar");
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
