import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveIntegrityPayload,
  attachArchiveIntegrity,
  verifyArchiveIntegrity
} from "../../../src/features/backup-import/core/archive-integrity.js";

test("archiveIntegrityPayload hashes stable archive fields", () => {
  const payload = archiveIntegrityPayload({
    schemaVersion: 2,
    rules: [{ type: "blacklist", value: "example.com" }],
    visits: [{ id: "visit-1", url: "https://example.com" }],
    items: [{ id: "legacy-item" }]
  });

  assert.equal(
    payload,
    JSON.stringify({
      schemaVersion: 2,
      rules: [{ type: "blacklist", value: "example.com" }],
      visits: [{ id: "visit-1", url: "https://example.com" }]
    })
  );
});

test("archiveIntegrityPayload accepts legacy item archives", () => {
  assert.equal(
    archiveIntegrityPayload({
      items: [{ id: "legacy-item" }]
    }),
    JSON.stringify({
      schemaVersion: 1,
      rules: [],
      visits: [{ id: "legacy-item" }]
    })
  );
});

test("attachArchiveIntegrity stores hash metadata for the payload scope", async () => {
  const archive = {
    exportedAt: "2026-06-16T00:00:00.000Z",
    visits: [{ id: "visit-1" }]
  };
  const withIntegrity = await attachArchiveIntegrity(archive, async (payload) => `hash:${payload.length}`);

  assert.deepEqual(withIntegrity.integrity, {
    algorithm: "SHA-256",
    scope: "schemaVersion,rules,visits",
    sha256: `hash:${archiveIntegrityPayload(archive).length}`
  });
  assert.equal(archive.integrity, undefined);
});

test("verifyArchiveIntegrity reports missing, matching, and mismatched hashes", async () => {
  const archive = {
    visits: [{ id: "visit-1" }]
  };
  const hashText = async (payload) => `hash:${payload.length}`;
  const expected = await hashText(archiveIntegrityPayload(archive));

  assert.deepEqual(await verifyArchiveIntegrity(archive, hashText), {
    checked: false,
    ok: true
  });

  assert.deepEqual(
    await verifyArchiveIntegrity({
      ...archive,
      integrity: { sha256: expected }
    }, hashText),
    {
      checked: true,
      ok: true,
      expected,
      actual: expected
    }
  );

  assert.deepEqual(
    await verifyArchiveIntegrity({
      ...archive,
      integrity: { sha256: "wrong" }
    }, hashText),
    {
      checked: true,
      ok: false,
      expected: "wrong",
      actual: expected
    }
  );
});
