import test from "node:test";
import assert from "node:assert/strict";
import { createBackupSelfTest } from "../../../src/features/backup-import/core/backup-verification.js";

const now = () => new Date("2026-06-16T12:00:00.000Z");

test("createBackupSelfTest passes when checksum and record count match", async () => {
  assert.deepEqual(
    await createBackupSelfTest(
      {
        counts: { visits: 2 },
        visits: [
          { id: "one", url: "https://example.com/one" },
          { id: "two", url: "https://example.com/two" }
        ]
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
      restorableRecords: 2,
      restoreCountMatches: true,
      status: "passed"
    }
  );
});

test("createBackupSelfTest fails on checksum mismatch or record count mismatch", async () => {
  const checksumMismatch = await createBackupSelfTest(
    {
      counts: { visits: 1 },
      visits: [{ id: "one", url: "https://example.com/one" }]
    },
    async () => ({ checked: true, ok: false }),
    now
  );

  assert.equal(checksumMismatch.status, "failed");
  assert.equal(checksumMismatch.checksum, "mismatch");
  assert.equal(checksumMismatch.countMatches, true);
  assert.equal(checksumMismatch.restoreCountMatches, true);

  const countMismatch = await createBackupSelfTest(
    {
      counts: { visits: 2 },
      visits: [{ id: "one", url: "https://example.com/one" }]
    },
    async () => ({ checked: true, ok: true }),
    now
  );

  assert.equal(countMismatch.status, "failed");
  assert.equal(countMismatch.checksum, "verified");
  assert.equal(countMismatch.countMatches, false);
  assert.equal(countMismatch.restoreCountMatches, false);
});

test("createBackupSelfTest fails when backup rows are not restorable", async () => {
  const result = await createBackupSelfTest(
    {
      counts: { visits: 2 },
      visits: [
        { id: "one", url: "https://example.com/one" },
        { id: "two", title: "Missing URL" }
      ]
    },
    async () => ({ checked: true, ok: true }),
    now
  );

  assert.equal(result.status, "failed");
  assert.equal(result.records, 2);
  assert.equal(result.restorableRecords, 1);
  assert.equal(result.countMatches, true);
  assert.equal(result.restoreCountMatches, false);
});
