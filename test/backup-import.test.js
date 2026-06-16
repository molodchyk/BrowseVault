import test from "node:test";
import assert from "node:assert/strict";
import {
  importChecksumNote,
  importHealthState,
  importPreviewNote,
  importPreviewViewModel
} from "../src/features/backup-import/core/import-preview.js";

const baseAnalysis = {
  sourceApp: "BrowseVault",
  rows: 4,
  validRows: 3,
  invalidRows: 1,
  duplicateRows: 1,
  existingVisits: 1,
  newVisits: 1,
  rules: 2
};

test("importHealthState distinguishes checksum, rules-only, and limited previews", () => {
  assert.deepEqual(importHealthState(baseAnalysis, { checked: true, ok: false }), {
    className: "is-warning",
    text: "Checksum mismatch. This archive changed after export; import only if you trust this file.",
    buttonText: "Import Anyway"
  });

  assert.deepEqual(importHealthState(baseAnalysis, { checked: true, ok: true }), {
    className: "is-ok",
    text: "Restore check passed. 1 new record and 1 existing record detected.",
    buttonText: "Import Now"
  });

  assert.deepEqual(
    importHealthState({ ...baseAnalysis, validRows: 0, rules: 1 }, { checked: false, ok: true }),
    {
      className: "is-warning",
      text: "Rules-only import. No history records were found in this file.",
      buttonText: "Import Rules"
    }
  );

  assert.equal(importHealthState(baseAnalysis, { checked: false, ok: true }).buttonText, "Import Now");
});

test("import preview notes summarize skipped rows, rules, and checksum state", () => {
  assert.equal(importChecksumNote({ checked: true, ok: true }), "Checksum verified.");
  assert.equal(importChecksumNote({ checked: true, ok: false }), "Checksum mismatch. Import only if you trust this file.");
  assert.equal(importChecksumNote({ checked: false, ok: true }), "No checksum included.");
  assert.equal(
    importPreviewNote(baseAnalysis, { checked: true, ok: true }),
    "4 rows scanned. 1 row without URLs will be skipped. 2 domain rules will be imported or updated. Checksum verified."
  );

  assert.equal(
    importPreviewNote({ ...baseAnalysis, invalidRows: 2, rules: 1 }, { checked: false, ok: true }),
    "4 rows scanned. 2 rows without URLs will be skipped. 1 domain rule will be imported or updated. No checksum included."
  );
});

test("importPreviewViewModel provides hidden and populated preview states", () => {
  assert.deepEqual(importPreviewViewModel(null), {
    hidden: true,
    buttonText: "Import Now",
    healthClassName: "import-health",
    healthText: "Archive not checked"
  });

  assert.deepEqual(
    importPreviewViewModel({
      fileName: "archive.json",
      analysis: baseAnalysis,
      integrity: { checked: true, ok: true }
    }),
    {
      hidden: false,
      title: "archive.json from BrowseVault",
      validRows: "3",
      newVisits: "1",
      existingVisits: "1",
      duplicateRows: "1",
      healthClassName: "import-health is-ok",
      healthText: "Restore check passed. 1 new record and 1 existing record detected.",
      buttonText: "Import Now",
      note: "4 rows scanned. 1 row without URLs will be skipped. 2 domain rules will be imported or updated. Checksum verified."
    }
  );
});
