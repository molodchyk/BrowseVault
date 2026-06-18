import assert from "node:assert/strict";
import test from "node:test";
import { checkReferenceSync, normalizeReferenceText } from "../../scripts/playbook/reference-sync-core.mjs";

function checkWithFiles(references, files) {
  return checkReferenceSync(references, {
    exists: (file) => files.has(file),
    readFile: (file) => files.get(file)
  });
}

test("normalizeReferenceText ignores platform line endings and trailing newline churn", () => {
  assert.equal(normalizeReferenceText("one\r\ntwo\r\n"), "one\ntwo");
  assert.equal(normalizeReferenceText("one\ntwo\n\n"), "one\ntwo");
});

test("checkReferenceSync accepts matching local reference copies", () => {
  const result = checkWithFiles(
    [{ label: "Reference", localPath: "local.md", sourcePath: "source.md" }],
    new Map([
      ["local.md", "same\r\ntext\r\n"],
      ["source.md", "same\ntext\n"]
    ])
  );

  assert.deepEqual(result, { errors: [], warnings: [] });
});

test("checkReferenceSync rejects stale local reference copies", () => {
  const result = checkWithFiles(
    [{ label: "Reference", localPath: "local.md", sourcePath: "source.md" }],
    new Map([
      ["local.md", "old"],
      ["source.md", "new"]
    ])
  );

  assert.equal(result.warnings.length, 0);
  assert.match(result.errors[0], /Reference local copy is stale/);
});

test("checkReferenceSync warns when an external workspace reference is unavailable", () => {
  const result = checkWithFiles(
    [{ label: "Reference", localPath: "local.md", sourcePath: "missing.md" }],
    new Map([["local.md", "same"]])
  );

  assert.equal(result.errors.length, 0);
  assert.match(result.warnings[0], /source reference is unavailable/);
});

test("checkReferenceSync errors when the committed local copy is missing", () => {
  const result = checkWithFiles(
    [{ label: "Reference", localPath: "missing.md", sourcePath: "source.md" }],
    new Map([["source.md", "same"]])
  );

  assert.equal(result.warnings.length, 0);
  assert.match(result.errors[0], /local copy is missing/);
});
