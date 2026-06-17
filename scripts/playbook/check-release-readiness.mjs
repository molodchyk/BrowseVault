import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checklistPath = path.join(root, "docs", "release", "manual-browser-qa-checklist.md");
const expectedChecks = [
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
  "Reset Vault is visible in Settings/Backup workflows and clearly says it does not delete Chrome history."
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldValue(source, label) {
  const match = source.match(new RegExp(`^- ${escapeRegExp(label)}:\\s*(.*)$`, "mi"));
  return match ? match[1].trim() : "";
}

function parseCheckRows(source) {
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

if (!fs.existsSync(checklistPath)) {
  throw new Error(`Missing manual browser QA checklist: ${path.relative(root, checklistPath)}`);
}

const checklist = fs.readFileSync(checklistPath, "utf8");

for (const label of [
  "Tester",
  "Date",
  "Commit",
  "Operating system",
  "Browser and version",
  "Loaded folder",
  "Extension ID"
]) {
  if (!fieldValue(checklist, label)) {
    fail(`Manual browser QA checklist is missing Evidence Header value: ${label}.`);
  }
}

if (fieldValue(checklist, "Result").toLowerCase() !== "pass") {
  fail("Manual browser QA checklist Result must be set to Pass after all target-browser checks pass.");
}

const checkRows = parseCheckRows(checklist);
for (const expectedCheck of expectedChecks) {
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

if (/automated Chrome or Playwright runs against a live Chrome profile/i.test(checklist) === false) {
  fail("Manual browser QA checklist must preserve the live Chrome profile automation warning.");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Release readiness checked: manual browser QA evidence is complete.");
