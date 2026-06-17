import test from "node:test";
import assert from "node:assert/strict";
import { createBackupSelfTest } from "../../../src/features/backup-import/core/backup-verification.js";

const now = () => new Date("2026-06-16T12:00:00.000Z");

test("createBackupSelfTest passes when checksum and record count match", async () => {
  assert.deepEqual(
    await createBackupSelfTest(
      {
        counts: { visits: 2 },
        visits: [{ id: "one" }, { id: "two" }]
      },
      async () => ({ checked: true, ok: true }),
      now
    ),
    {
      checkedAt: "2026-06-16T12:00:00.000Z",
      checksum: "verified",
      countMatches: true,
      expectedRecords: 2,
      records: 2,
      status: "passed"
    }
  );
});

test("createBackupSelfTest fails on checksum mismatch or record count mismatch", async () => {
  const checksumMismatch = await createBackupSelfTest(
    {
      counts: { visits: 1 },
      visits: [{ id: "one" }]
    },
    async () => ({ checked: true, ok: false }),
    now
  );

  assert.equal(checksumMismatch.status, "failed");
  assert.equal(checksumMismatch.checksum, "mismatch");
  assert.equal(checksumMismatch.countMatches, true);

  const countMismatch = await createBackupSelfTest(
    {
      counts: { visits: 2 },
      visits: [{ id: "one" }]
    },
    async () => ({ checked: true, ok: true }),
    now
  );

  assert.equal(countMismatch.status, "failed");
  assert.equal(countMismatch.checksum, "verified");
  assert.equal(countMismatch.countMatches, false);
});
