# Decision Records

This file captures product and release decisions that should stay visible to future maintainers.

## ADR-001: Keep BrowseVault Local-First

BrowseVault stores archive data in the user's browser profile and does not include analytics, ads, tracking, remote code, content scripts, host permissions, or default network requests.

Reason: a local-first browser history product should prioritize trust, data ownership, backup reliability, and predictable permission behavior.

## ADR-002: Do Not Replace Chrome History By Default

BrowseVault opens from the toolbar action or keyboard command and includes a Settings escape hatch to open Chrome's native history page.

Reason: replacing browser-owned pages increases review risk and makes recovery from product bugs harder. Users should be able to keep Chrome's native history behavior available.

## ADR-003: Separate Vault Deletion From Chrome History Deletion

Deleting BrowseVault vault records and deleting URLs from Chrome history are separate actions with separate labels and confirmations.

Reason: Chrome history deletion happens by URL and can remove every native visit for that URL. BrowseVault should not hide that browser-level side effect behind a generic cleanup action.

## ADR-004: Keep Research Docs Out Of The Runtime Package

Market research, raw source snapshots, StorePilot files, tests, scripts, and feature docs stay in the repository, while `npm run package` produces a runtime-only ZIP plus root user-facing docs.

Reason: reviewers and maintainers need the research trail, but users should receive the smallest auditable extension package.

## ADR-005: Follow The Shared Extension Playbooks

BrowseVault tracks the shared browser-extension release playbook and the StorePilot import reference from this settings workspace.

References:

- [Browser Extension Playbook](../../browser-extension-playbook.md)
- [Extension Modularization Playbook](../architecture/extension-modularization-playbook.md)
- [StorePilot Project Reference](../../StorePilot/docs/reference.md)

## ADR-006: Do Not Automate Against Live Chrome Profiles

Automated browser QA must not launch or attach to the active Chrome profile, including the real Chrome user-data directory or named folders such as `Default`, `Profile`, or `Profile 1`.

Reason: profile-level automation can collide with focus-blocking tools, active sessions, and Chrome's profile registry. BrowseVault release checks should stay repo-only unless a browser run is explicitly confirmed, and browser automation must use a disposable temporary user-data directory.
