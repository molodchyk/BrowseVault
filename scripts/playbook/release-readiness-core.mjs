export const evidenceHeaderLabels = [
  "Tester",
  "Date",
  "Commit",
  "Operating system",
  "Browser and version",
  "Loaded folder",
  "Extension ID"
];

export const expectedManualBrowserQaChecks = [
  "Toolbar action opens BrowseVault.",
  "Keyboard command opens BrowseVault when configured by the browser.",
  "First screen is the History search workflow, not a marketing screen.",
  "Search input is focused or immediately reachable, and a normal query returns usable results.",
  "Long URLs and titles stay inside the viewport with no page-level horizontal scrollbar.",
  "Settings, Rules, Backup, and retention action buttons stay compact instead of stretching across the page.",
  "Opening BrowseVault from a non-BrowseVault active tab creates another BrowseVault tab instead of enforcing one global app tab.",
  "Deleting a vault record in one BrowseVault tab refreshes another open BrowseVault tab.",
  "Rules list groups Category, Blacklist, and Whitelist rows by type rather than repeating the type on every row.",
  "Theme, accent, contrast, text size, date display, and default result-limit settings save and apply.",
  "Open Chrome History opens the native browser history page.",
  "JSON backup export completes and reports backup health/self-test status.",
  "Import preview appears for a supported archive file and can be canceled safely.",
  "Reset Vault is visible in Settings/Backup workflows and clearly says it does not delete Chrome history.",
  "Chrome Web Store screenshots match the current UI and store listing copy."
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fieldValue(source, label) {
  const match = source.match(new RegExp(`^- ${escapeRegExp(label)}:[ \\t]*(.*)$`, "mi"));
  return match ? match[1].trim() : "";
}

export function parseCheckRows(source) {
  const rows = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith("|") || /^\|\s*-+/.test(line) || /^\|\s*Check\s*\|/i.test(line)) {
      continue;
    }

    const cells = line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length >= 3) {
      rows.set(cells[0], {
        notes: cells.slice(2).join("|").trim(),
        result: cells[1]
      });
    }
  }
  return rows;
}

export function checkReleaseReadinessChecklist(checklist, { currentCommit }) {
  const errors = [];
  const fail = (message) => errors.push(message);

  for (const label of evidenceHeaderLabels) {
    if (!fieldValue(checklist, label)) {
      fail(`Manual browser QA checklist is missing Evidence Header value: ${label}.`);
    }
  }

  const recordedCommit = fieldValue(checklist, "Commit").toLowerCase();
  const headCommit = currentCommit.toLowerCase();
  if (recordedCommit && !recordedCommit.startsWith(headCommit)) {
    fail(`Manual browser QA checklist Commit must match current HEAD ${headCommit}, got ${recordedCommit}.`);
  }

  if (fieldValue(checklist, "Result").toLowerCase() !== "pass") {
    fail("Manual browser QA checklist Result must be set to Pass after all target-browser checks pass.");
  }

  const checkRows = parseCheckRows(checklist);
  for (const expectedCheck of expectedManualBrowserQaChecks) {
    const row = checkRows.get(expectedCheck);
    if (!row) {
      fail(`Manual browser QA checklist is missing required flow check: ${expectedCheck}`);
      continue;
    }

    if (row.result.toLowerCase() !== "pass") {
      fail(`Manual browser QA flow check must be Pass: ${expectedCheck} Current result: ${row.result || "(blank)"}.`);
    }
  }

  if (fieldValue(checklist, "Ship decision").toLowerCase() !== "ship") {
    fail("Manual browser QA checklist Ship decision must be set to Ship for release readiness.");
  }

  if (!fieldValue(checklist, "Screenshots or notes location")) {
    fail("Manual browser QA checklist must include a screenshots or notes location.");
  }

  const requiredWarnings = [
    {
      message: "Manual browser QA checklist must preserve the live Chrome profile automation warning.",
      pattern: /automated Chrome or Playwright runs against a live Chrome profile/i
    },
    {
      message: "Manual browser QA checklist must preserve the named Chrome profile warning.",
      pattern: /Do not create or target named personal Chrome profiles/i
    },
    {
      message: "Manual browser QA checklist must preserve the Chrome launch-flag automation warning.",
      pattern: /--profile-directory.*--load-extension.*--disable-extensions-except.*remote debugging flags/i
    }
  ];

  for (const warning of requiredWarnings) {
    if (warning.pattern.test(checklist) === false) {
      fail(warning.message);
    }
  }

  return errors;
}
