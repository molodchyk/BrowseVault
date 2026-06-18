import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { checkReleaseReadinessChecklist } from "./release-readiness-core.mjs";

const root = process.cwd();
const checklistPath = path.join(root, "docs", "release", "manual-browser-qa-checklist.md");

function currentCommit() {
  return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
    cwd: root,
    encoding: "utf8"
  }).trim();
}

if (!fs.existsSync(checklistPath)) {
  throw new Error(`Missing manual browser QA checklist: ${path.relative(root, checklistPath)}`);
}

const checklist = fs.readFileSync(checklistPath, "utf8");
const errors = checkReleaseReadinessChecklist(checklist, { currentCommit: currentCommit() });
if (errors.length) {
  for (const error of errors) {
    console.error(error);
  }
  process.exit(1);
}

console.log("Release readiness checked: manual browser QA evidence is complete.");
