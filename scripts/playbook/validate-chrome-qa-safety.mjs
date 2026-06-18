import fs from "node:fs";
import path from "node:path";

const forbiddenAutomationPatterns = [
  /--user-data-dir/i,
  /--profile-directory/i,
  /--load-extension/i,
  /--disable-extensions-except/i,
  /launchPersistentContext/i,
  /chromium\.launch/i,
  /connectOverCDP/i,
  /remote-debugging-port/i,
  /chrome\.exe/i,
  /\bgoogle-chrome(?:-stable)?\b/i,
  /\bchromium-browser\b/i,
  /\bchromium\s+--/i,
  /Google Chrome\.app/i,
  /Contents[\\/]+MacOS[\\/]+Google Chrome/i,
  /\bopen\s+-a\s+["']?Google Chrome/i,
  /\bStart-Process\s+chrome\b/i,
  /Google[\\/]+Chrome[\\/]+User Data/i,
  /AppData[\\/]+Local[\\/]+Google[\\/]+Chrome/i,
  /\bYour Chrome\b/i,
  /%LOCALAPPDATA%/i,
  /\$env:LOCALAPPDATA/i
];

function projectPath(root, fullPath) {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

function scriptFiles(root, entry) {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return /\.(js|mjs|cjs|ps1|py)$/i.test(fullPath) ? [fullPath] : [];
  }

  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .flatMap((child) => scriptFiles(root, path.join(entry, child.name)));
}

function assertNoForbiddenAutomation(label, source, assert) {
  for (const pattern of forbiddenAutomationPatterns) {
    assert(!pattern.test(source), `${label} contains forbidden live Chrome profile automation pattern: ${pattern}.`);
  }
}

export function validateChromeQaSafety(root, packageJson, assert) {
  const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  for (const expected of [
    "Do not launch Chrome, Chromium, Playwright, the Chrome MCP, the in-app browser, or any browser automation for this project.",
    "Do not create, target, rename, delete, or otherwise manage Chrome profiles from Codex.",
    "Do not use the active Chrome profile, `%LOCALAPPDATA%\\Google\\Chrome\\User Data`, `Default`, `Profile`, `Profile 1`, or named personal profiles such as `Your Chrome`.",
    "Do not pass `--profile-directory`, `--user-data-dir`, `--load-extension`, `--disable-extensions-except`, remote debugging, or CDP attachment flags from repo scripts or assistant-driven commands.",
    "Do not treat Chrome or Playwright closing under local focus blockers as a BrowseVault product failure.",
    "Manual target-browser QA belongs in `docs/release/manual-browser-qa-checklist.md`"
  ]) {
    assert(agents.includes(expected), `AGENTS.md missing Chrome/browser safety invariant: ${expected}`);
  }

  const releaseQa = fs.readFileSync(path.join(root, "docs", "release", "release-qa.md"), "utf8");
  for (const expected of [
    "Never use the active Chrome profile for automated QA.",
    "Do not use `%LOCALAPPDATA%\\\\Google\\\\Chrome\\\\User Data`, `Default`, `Profile`, or `Profile 1` as an automated QA profile.",
    "Do not create or target named personal Chrome profiles such as `Your Chrome` for automated QA.",
    "Automated browser QA must use a disposable temporary user-data directory, or stay manual.",
    "Do not add npm scripts that launch Chrome, Playwright, or a remote-debugging session against a real user profile.",
    "Do not add repo scripts that launch Chrome or Chromium executables such as `chrome.exe`, `google-chrome`, `chromium-browser`, or `Google Chrome.app`.",
    "Do not pass `--profile-directory`, `--load-extension`, `--disable-extensions-except`, or CDP attachment flags from repo scripts.",
    "Validation scans package scripts, repository scripts, and tests for live Chrome profile automation patterns."
  ]) {
    assert(releaseQa.includes(expected), `Release QA notes missing Chrome profile safety invariant: ${expected}`);
  }

  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    assertNoForbiddenAutomation(`package script "${name}"`, command, assert);
  }

  for (const entry of ["scripts", "test"]) {
    for (const fullPath of scriptFiles(root, entry)) {
      const relativePath = projectPath(root, fullPath);
      if (relativePath.startsWith("scripts/playbook/")) {
        continue;
      }
      assertNoForbiddenAutomation(relativePath, fs.readFileSync(fullPath, "utf8"), assert);
    }
  }
}
