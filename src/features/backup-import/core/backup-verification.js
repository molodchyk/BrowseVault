import { verifyArchiveIntegrity } from "./archive-integrity.js";

function archiveVisitCount(archive) {
  if (Array.isArray(archive?.visits)) {
    return archive.visits.length;
  }

  if (Array.isArray(archive?.items)) {
    return archive.items.length;
  }

  return 0;
}

function expectedVisitCount(archive, fallback) {
  const expected = Number(archive?.counts?.visits);
  return Number.isFinite(expected) ? expected : fallback;
}

export async function createBackupSelfTest(
  archive,
  verifyIntegrity = verifyArchiveIntegrity,
  now = () => new Date()
) {
  const integrity = await verifyIntegrity(archive);
  const records = archiveVisitCount(archive);
  const expectedRecords = expectedVisitCount(archive, records);
  const countMatches = records === expectedRecords;
  const passed = integrity.ok && countMatches;

  return {
    checkedAt: now().toISOString(),
    status: passed ? "passed" : "failed",
    records,
    expectedRecords,
    checksum: integrity.checked
      ? integrity.ok
        ? "verified"
        : "mismatch"
      : "not-included",
    countMatches
  };
}
