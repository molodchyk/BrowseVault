# Codex Working Rules

This repository is browser-sensitive because local tools such as Cold Turkey and FocusMe can interfere with Chrome processes and because accidental Chrome profile creation is stressful user-state mutation.

## Browser Safety

- Do not launch Chrome, Chromium, Playwright, the Chrome MCP, the in-app browser, or any browser automation for this project.
- Do not create, target, rename, delete, or otherwise manage Chrome profiles from Codex.
- Do not troubleshoot, clean up, delete, or otherwise mutate Chrome profile folders or Chrome user-data folders from Codex.
- Do not use the active Chrome profile, `%LOCALAPPDATA%\Google\Chrome\User Data`, `Default`, `Profile`, `Profile 1`, or named personal profiles such as `Your Chrome`.
- Do not pass `--profile-directory`, `--user-data-dir`, `--load-extension`, `--disable-extensions-except`, remote debugging, or CDP attachment flags from repo scripts or assistant-driven commands.
- Do not use browser-control plugins, Chrome-control MCP tools, Playwright browser launches, CDP attachment, or the in-app browser for BrowseVault repo work.
- Do not treat Chrome or Playwright closing under local focus blockers as a BrowseVault product failure.
- If a Chrome/profile issue happens, stop repo work that touches Chrome and ask the user to handle Chrome manually.

Manual target-browser QA belongs in `docs/release/manual-browser-qa-checklist.md` and should be performed by the user in their normal browser session. Repo-owned checks stay non-browser for BrowseVault work in this workspace.
