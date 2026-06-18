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

  return `# Release QA

- Never use the active Chrome profile for automated QA.
- Do not use \`${userDataPath}\`, \`Default\`, \`Profile\`, or \`Profile 1\` as an automated QA profile.
- Do not create or target named personal Chrome profiles such as \`${namedProfile}\` for automated QA.
- Automated browser QA must use a disposable temporary user-data directory, or stay manual.
- Do not add npm scripts that launch Chrome, Playwright, or a remote-debugging session against a real user profile.
- Do not pass \`${profileFlag}\`, \`${loadFlag}\`, \`${disableExceptFlag}\`, or CDP attachment flags from repo scripts.
- Validation scans package scripts, repository scripts, and tests for live Chrome profile automation patterns.
`;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "browsevault-chrome-qa-"));
  fs.mkdirSync(path.join(root, "docs", "release"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "test"), { recursive: true });
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

test("validateChromeQaSafety rejects scripts that attach to an existing Chrome session", () => {
  const root = makeFixture();
  const blockedApi = "connectOver" + "CDP";
  fs.writeFileSync(path.join(root, "scripts", "cdp.mjs"), `const api = "${blockedApi}";\n`);

  assert.throws(
    () => runSafety(root),
    /scripts\/cdp\.mjs contains forbidden live Chrome profile automation pattern/
  );
});
