import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoots = ["src", "test", "scripts"];
const escalationLines = 600;
const defaultHardLines = 900;
const knownDebtCaps = new Map();

function toProjectPath(fullPath) {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

function collectFiles(fullPath) {
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    return /\.(css|html|js|mjs)$/i.test(fullPath) ? [fullPath] : [];
  }

  return fs
    .readdirSync(fullPath, { withFileTypes: true })
    .flatMap((entry) => collectFiles(path.join(fullPath, entry.name)));
}

function countLines(fullPath) {
  const source = fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!source.length) {
    return 0;
  }

  const newlineCount = source.match(/\n/g)?.length || 0;
  return source.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function budgetFor(projectPath) {
  if (/\.css$/i.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "stylesheet",
      softLines: 500
    };
  }

  if (/\.html$/i.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "extension page",
      softLines: 500
    };
  }

  if (/^test\//.test(projectPath) || /\.test\.js$/i.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "test file",
      softLines: 500
    };
  }

  if (/\/ui\//.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "UI module",
      softLines: 450
    };
  }

  if (/\/core\//.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "core module",
      softLines: 300
    };
  }

  if (/^src\/(app|background)\.js$/i.test(projectPath)) {
    return {
      hardLines: defaultHardLines,
      label: "runtime entry",
      softLines: 150
    };
  }

  return {
    hardLines: defaultHardLines,
    label: "support module",
    softLines: 500
  };
}

const files = auditRoots
  .map((entry) => path.join(root, entry))
  .filter((fullPath) => fs.existsSync(fullPath))
  .flatMap((fullPath) => collectFiles(fullPath))
  .sort((left, right) => toProjectPath(left).localeCompare(toProjectPath(right)));

const warnings = [];
const violations = [];

for (const fullPath of files) {
  const projectPath = toProjectPath(fullPath);
  const lines = countLines(fullPath);
  const budget = budgetFor(projectPath);
  const debt = knownDebtCaps.get(projectPath);

  if (debt && lines > debt.maxLines) {
    violations.push(
      `${projectPath}: ${lines} lines, known debt cap ${debt.maxLines} lines (${debt.reason}).`
    );
    continue;
  }

  if (!debt && lines > budget.hardLines) {
    violations.push(`${projectPath}: ${lines} lines, hard max ${budget.hardLines} for ${budget.label}.`);
    continue;
  }

  if (lines > escalationLines) {
    warnings.push(`${projectPath}: ${lines} lines, over ${escalationLines}; split follow-up expected.`);
    continue;
  }

  if (lines > budget.softLines) {
    warnings.push(`${projectPath}: ${lines} lines, soft target ${budget.softLines} for ${budget.label}.`);
  }
}

if (warnings.length) {
  console.warn("File size warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (violations.length) {
  console.error("File size budget failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  console.error("Split oversized files by feature, surface, or responsibility before adding more code.");
  process.exit(1);
}

console.log(`File sizes checked ${files.length} files with ${warnings.length} warnings.`);
