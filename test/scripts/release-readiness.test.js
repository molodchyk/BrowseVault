import assert from "node:assert/strict";
import test from "node:test";
import {
  checkReleaseReadinessChecklist,
  expectedManualBrowserQaChecks,
  fieldValue
} from "../../scripts/playbook/release-readiness-core.mjs";

function completeChecklist({
  commit = "abc1234",
  flowResult = "Pass",
  includeWarning = true,
  result = "Pass",
  shipDecision = "Ship"
} = {}) {
  const warning = includeWarning
    ? "Do not use automated Chrome or Playwright runs against a live Chrome profile for this checklist."
    : "";
  const flowRows = expectedManualBrowserQaChecks
    .map((check) => `| ${check} | ${flowResult} | checked |`)
    .join("\n");

  return `# Manual Browser QA Checklist

${warning}

## Evidence Header

- Tester: QA
- Date: 2026-06-18
- Commit: ${commit}
- Operating system: Windows
- Browser and version: Chrome 137
- Loaded folder: C:\\Users\\molod\\Documents\\Personal\\settings\\BrowseVault
- Extension ID: abcdefghijklmnop
- Result: ${result}

## Required Flow Checks

| Check | Result | Notes |
| --- | --- | --- |
${flowRows}

## Release Decision

- Ship decision: ${shipDecision}
- Blocking issues: none
- Follow-up issues: none
- Screenshots or notes location: docs/release/manual-browser-qa-checklist.md
`;
}

test("fieldValue does not consume the next evidence header line when a value is blank", () => {
  const source = "- Commit:\n- Operating system: Windows";

  assert.equal(fieldValue(source, "Commit"), "");
  assert.equal(fieldValue(source, "Operating system"), "Windows");
});

test("checkReleaseReadinessChecklist accepts complete same-commit manual evidence", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist(), {
    currentCommit: "abc1234"
  });

  assert.deepEqual(errors, []);
});

test("checkReleaseReadinessChecklist rejects stale commit evidence", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ commit: "def5678" }), {
    currentCommit: "abc1234"
  });

  assert(errors.some((error) => error.includes("Commit must match current HEAD abc1234")));
});

test("checkReleaseReadinessChecklist rejects incomplete manual flow evidence", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ flowResult: "Not run", result: "Not run" }), {
    currentCommit: "abc1234"
  });

  assert(errors.some((error) => error.includes("Result must be set to Pass")));
  assert(errors.some((error) => error.includes("Toolbar action opens BrowseVault")));
});

test("checkReleaseReadinessChecklist preserves the live-profile automation warning", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ includeWarning: false }), {
    currentCommit: "abc1234"
  });

  assert(errors.includes("Manual browser QA checklist must preserve the live Chrome profile automation warning."));
});
