import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { collectStorageContracts } from "../../scripts/playbook/storage-ownership/storage-ownership-core.mjs";

test("playbook compliance validator runs as a direct CLI command", () => {
  const scriptPath = path.resolve("scripts", "playbook", "validate-playbook-compliance.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Playbook compliance checked\./);
});

test("store media validator runs as a direct CLI command", () => {
  const scriptPath = path.resolve("scripts", "playbook", "validate-store-media.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Store media checked\./);
});

test("storage ownership scanner derives metadata and local storage keys from source", () => {
  const contracts = collectStorageContracts(process.cwd());

  assert(contracts.metaKeys.includes("lastStartedAt"));
  assert(contracts.metaKeys.includes("lastBackup"));
  assert(contracts.metaKeys.includes("savedSearches"));
  assert(contracts.localKeys.includes("browseVault.preferences"));
  assert(contracts.localKeys.includes("browseVault.vaultInvalidation"));
  assert(contracts.localKeys.includes("browseVault.localPreviewStorage"));
});
