import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateChromeQaSafety } from "../../scripts/playbook/validate-chrome-qa-safety.mjs";

function assertCondition(condition, message) {
  assert.ok(condition, message);
}

function safeReleaseQa() {
  const localAppData = "%" + "LOCALAPPDATA" + "%";
  const userDataPath = [localAppData, "Google", "Chrome", "User Data"].join("\\\\");
  const namedProfile = "Your " + "Chrome";
  const profileFlag = "--profile-" + "directory";
  const loadFlag = "--load-" + "extension";
  const disableExceptFlag = "--disable-extensions-" + "except";
  const chromeExe = "chrome." + "exe";
  const googleChrome = "google-" + "chrome";
  const chromiumBrowser = "chromium-" + "browser";
  const chromeApp = "Google " + "Chrome.app";

  return `# Release QA

- Never use the active Chrome profile for automated QA.
- Do not use \`${userDataPath}\`, \`Default\`, \`Profile\`, or \`Profile 1\` as an automated QA profile.
- Do not create or target named personal Chrome profiles such as \`${namedProfile}\` for automated QA.
- Do not troubleshoot, clean up, delete, or otherwise mutate Chrome profile folders or Chrome user-data folders from Codex.
- Do not use browser-control plugins, Chrome-control MCP tools, Playwright browser launches, CDP attachment, or the in-app browser for BrowseVault repo work.
- Automated browser QA is out of scope for BrowseVault repo-owned checks in this workspace; keep target-browser QA manual.
- Do not add npm scripts that launch Chrome, Playwright, or a remote-debugging session against a real user profile.
- Do not add repo scripts that launch Chrome or Chromium executables such as \`${chromeExe}\`, \`${googleChrome}\`, \`${chromiumBrowser}\`, or \`${chromeApp}\`.
- Do not pass \`${profileFlag}\`, \`${loadFlag}\`, \`${disableExceptFlag}\`, or CDP attachment flags from repo scripts.
- Validation scans package scripts, repository scripts, and tests for live Chrome profile automation patterns.
- If a Chrome/profile issue happens, stop repo work that touches Chrome and ask the user to handle Chrome manually.
`;
}

function safeAgents() {
  const localAppData = "%" + "LOCALAPPDATA" + "%";
  const userDataPath = [localAppData, "Google", "Chrome", "User Data"].join("\\");
  const namedProfile = "Your " + "Chrome";
  const profileFlag = "--profile-" + "directory";
  const userDataFlag = "--user-" + "data-dir";
  const loadFlag = "--load-" + "extension";
  const disableExceptFlag = "--disable-extensions-" + "except";

  return `# Codex Working Rules

This repository is browser-sensitive because local tools such as Cold Turkey and FocusMe can interfere with Chrome processes and because accidental Chrome profile creation is stressful user-state mutation.

## Browser Safety

- Do not launch Chrome, Chromium, Playwright, the Chrome MCP, the in-app browser, or any browser automation for this project.
- Do not create, target, rename, delete, or otherwise manage Chrome profiles from Codex.
- Do not troubleshoot, clean up, delete, or otherwise mutate Chrome profile folders or Chrome user-data folders from Codex.
- Do not use the active Chrome profile, \`${userDataPath}\`, \`Default\`, \`Profile\`, \`Profile 1\`, or named personal profiles such as \`${namedProfile}\`.
- Do not pass \`${profileFlag}\`, \`${userDataFlag}\`, \`${loadFlag}\`, \`${disableExceptFlag}\`, remote debugging, or CDP attachment flags from repo scripts or assistant-driven commands.
- Do not use browser-control plugins, Chrome-control MCP tools, Playwright browser launches, CDP attachment, or the in-app browser for BrowseVault repo work.
- Do not treat Chrome or Playwright closing under local focus blockers as a BrowseVault product failure.
- If a Chrome/profile issue happens, stop repo work that touches Chrome and ask the user to handle Chrome manually.

Manual target-browser QA belongs in \`docs/release/manual-browser-qa-checklist.md\` and should be performed by the user in their normal browser session. Repo-owned checks stay non-browser for BrowseVault work in this workspace.
`;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "browsevault-chrome-qa-"));
  fs.mkdirSync(path.join(root, "docs", "release"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
  fs.writeFileSync(path.join(root, "AGENTS.md"), safeAgents());
  fs.writeFileSync(path.join(root, "docs", "release", "release-qa.md"), safeReleaseQa());
  fs.writeFileSync(path.join(root, "scripts", "safe.mjs"), "console.log('repo-only check');\n");
  fs.writeFileSync(path.join(root, "test", "safe.test.js"), "const check = 'repo-only';\n");
  return root;
}

function runSafety(root, scripts = {}) {
  validateChromeQaSafety(root, { scripts }, assertCondition);
}

test("validateChromeQaSafety accepts repo-only QA fixtures", () => {
  const root = makeFixture();

  runSafety(root, { check: "node scripts/safe.mjs" });
});

test("validateChromeQaSafety allows self-referential safety validator terms", () => {
  const root = makeFixture();
  const blockedFlag = "--profile-" + "directory";
  fs.mkdirSync(path.join(root, "scripts", "playbook"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "scripts", "playbook", "validate-chrome-qa-safety.mjs"),
    `const forbiddenPattern = "${blockedFlag}";\n`
  );

  runSafety(root);
});

test("validateChromeQaSafety requires root Codex browser-safety instructions", () => {
  const root = makeFixture();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Codex Working Rules\n");

  assert.throws(
    () => runSafety(root),
    /AGENTS\.md missing Chrome\/browser safety invariant/
  );
});

test("validateChromeQaSafety rejects package scripts that set a Chrome user data directory", () => {
  const root = makeFixture();
  const blockedFlag = "--user-data-" + "dir";

  assert.throws(
    () => runSafety(root, { bad: `node qa.js ${blockedFlag}=tmp` }),
    /package script "bad" contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects test files that launch a persistent browser context", () => {
  const root = makeFixture();
  const blockedApi = "launchPersistent" + "Context";
  fs.writeFileSync(path.join(root, "test", "bad.test.js"), `const api = "${blockedApi}";\n`);

  assert.throws(
    () => runSafety(root),
    /test\/bad\.test\.js contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects scripts that select a Chrome profile directory", () => {
  const root = makeFixture();
  const blockedFlag = "--profile-" + "directory";
  fs.writeFileSync(path.join(root, "scripts", "bad.mjs"), `console.log("${blockedFlag}=Default");\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/bad\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects playbook helpers that select a Chrome profile directory", () => {
  const root = makeFixture();
  const blockedFlag = "--profile-" + "directory";
  fs.mkdirSync(path.join(root, "scripts", "playbook"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "playbook", "bad-helper.mjs"), `console.log("${blockedFlag}=Default");\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/playbook\/bad-helper\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects scripts that attach to an existing Chrome session", () => {
  const root = makeFixture();
  const blockedApi = "connectOver" + "CDP";
  fs.writeFileSync(path.join(root, "scripts", "cdp.mjs"), `const api = "${blockedApi}";\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/cdp\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects package scripts that launch Chrome executables directly", () => {
  const root = makeFixture();
  const blockedBinary = "google-" + "chrome";

  assert.throws(
    () => runSafety(root, { bad: `${blockedBinary} --version` }),
    /package script "bad" contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects scripts that launch Chromium executables directly", () => {
  const root = makeFixture();
  const blockedBinary = "chromium-" + "browser";
  fs.writeFileSync(path.join(root, "scripts", "browser.mjs"), `const command = "${blockedBinary}";\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/browser\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects scripts that target the macOS Chrome app bundle", () => {
  const root = makeFixture();
  const blockedApp = "Google " + "Chrome.app";
  fs.writeFileSync(path.join(root, "scripts", "macos.mjs"), `const app = "${blockedApp}";\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/macos\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects scripts that invoke Chrome-control tooling", () => {
  const root = makeFixture();
  const blockedTool = "chrome:" + "control-chrome";
  fs.writeFileSync(path.join(root, "scripts", "tool.mjs"), `const tool = "${blockedTool}";\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/tool\.mjs contains forbidden live Chrome profile automation pattern/
  );
});

test("validateChromeQaSafety rejects package scripts that run Playwright browser tests", () => {
  const root = makeFixture();
  const blockedCommand = "playwright" + " test";

  assert.throws(
    () => runSafety(root, { bad: blockedCommand }),
    /package script "bad" contains forbidden live Chrome profile automation pattern/
  );
});
