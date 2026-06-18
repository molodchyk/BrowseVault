import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("playbook compliance validator runs as a direct CLI command", () => {
  const scriptPath = path.resolve("scripts", "playbook", "validate-playbook-compliance.mjs");
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Playbook compliance checked\./);
});
