import fs from "node:fs";
import path from "node:path";
import { validateChromeQaSafety } from "./validate-chrome-qa-safety.mjs";

const root = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

validateChromeQaSafety(root, packageJson, assert);

console.log("Chrome QA profile safety checked.");
