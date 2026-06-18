import assert from "node:assert/strict";
import test from "node:test";
import {
  checkReleaseReadinessChecklist,
  expectedAutomatedGateChecks,
  expectedManualBrowserQaChecks,
  fieldValue
} from "../../scripts/playbook/release-readiness-core.mjs";

function completeChecklist({
  automatedGateResult = "Pass",
  commit = "abc1234",
  includeExecutableWarning = true,
  flowResult = "Pass",
  includeLaunchFlagWarning = true,
  includeLiveProfileWarning = true,
  includeNamedProfileWarning = true,
  result = "Pass",
  shipDecision = "Ship"
} = {}) {
  const liveProfileWarning = includeLiveProfileWarning
    ? "Do not use automated Chrome or Playwright runs against a live Chrome profile for this checklist."
    : "";
  const namedProfileWarning = includeNamedProfileWarning
    ? `Do not create or target named personal Chrome profiles such as \`${"Your " + "Chrome"}\` for this checklist.`
    : "";
  const launchFlagWarning = includeLaunchFlagWarning
    ? `Do not use repo scripts or assistant-driven browser automation to pass ${"--profile-" + "directory"}, ${"--load-" + "extension"}, ${"--disable-extensions-" + "except"}, or remote debugging flags to Chrome for this checklist.`
    : "";
  const executableWarning = includeExecutableWarning
    ? `Do not add repo scripts that launch Chrome or Chromium executables such as ${"`chrome." + "exe`"}, ${"`google-" + "chrome`"}, ${"`chromium-" + "browser`"}, or ${"`Google " + "Chrome.app`"}.`
    : "";
  const flowRows = expectedManualBrowserQaChecks
    .map((check) => `| ${check} | ${flowResult} | checked |`)
    .join("\n");
  const automatedGateRows = expectedAutomatedGateChecks
    .map((command) => `| ${command} | ${automatedGateResult} | checked |`)
    .join("\n");

  return `# Manual Browser QA Checklist

${liveProfileWarning}
${namedProfileWarning}
${launchFlagWarning}
${executableWarning}

## Evidence Header

- Tester: QA
- Date: 2026-06-18
- Commit: ${commit}
- Operating system: Windows
- Browser and version: Chrome 137
- Loaded folder: C:\\Users\\molod\\Documents\\Personal\\settings\\BrowseVault
- Extension ID: abcdefghijklmnop
- Result: ${result}

## Automated Gate Checks

| Command | Result | Notes |
| --- | --- | --- |
${automatedGateRows}

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

test("checkReleaseReadinessChecklist rejects incomplete automated gate evidence", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ automatedGateResult: "Not run" }), {
    currentCommit: "abc1234"
  });

  assert(errors.some((error) => error.includes("npm run validate")));
});

test("checkReleaseReadinessChecklist preserves the live-profile automation warning", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ includeLiveProfileWarning: false }), {
    currentCommit: "abc1234"
  });

  assert(errors.includes("Manual browser QA checklist must preserve the live Chrome profile automation warning."));
});

test("checkReleaseReadinessChecklist preserves the named-profile warning", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ includeNamedProfileWarning: false }), {
    currentCommit: "abc1234"
  });

  assert(errors.includes("Manual browser QA checklist must preserve the named Chrome profile warning."));
});

test("checkReleaseReadinessChecklist preserves the Chrome launch-flag warning", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ includeLaunchFlagWarning: false }), {
    currentCommit: "abc1234"
  });

  assert(errors.includes("Manual browser QA checklist must preserve the Chrome launch-flag automation warning."));
});

test("checkReleaseReadinessChecklist preserves the Chrome executable launch warning", () => {
  const errors = checkReleaseReadinessChecklist(completeChecklist({ includeExecutableWarning: false }), {
    currentCommit: "abc1234"
  });

  assert(errors.includes("Manual browser QA checklist must preserve the Chrome executable launch warning."));
});
