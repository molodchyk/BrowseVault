import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const auditRoots = ["src", "test", "scripts", "docs"];
const runtimeFolderLimit = 12;
const featureFolderLimit = 15;
const docsFolderLimit = 12;

function toProjectPath(fullPath) {
  return path.relative(root, fullPath).split(path.sep).join("/");
}

function isFeatureFolder(projectPath) {
  return /^(src|test)\/features\/[^/]+(?:\/.*)?$/.test(projectPath);
}

function budgetFor(projectPath) {
  if (projectPath === "docs" || projectPath.startsWith("docs/")) {
    return {
      maxFiles: docsFolderLimit,
      label: "documentation folder"
    };
  }

  if (isFeatureFolder(projectPath)) {
    return {
      maxFiles: featureFolderLimit,
      label: "feature folder"
    };
  }

  return {
    maxFiles: runtimeFolderLimit,
    label: "runtime/support folder"
  };
}

function collectDirectories(fullPath) {
  const stat = fs.statSync(fullPath);
  if (!stat.isDirectory()) {
    return [];
  }

  const childDirectories = fs
    .readdirSync(fullPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => collectDirectories(path.join(fullPath, entry.name)));

  return [fullPath, ...childDirectories];
}

function countFiles(fullPath) {
  return fs.readdirSync(fullPath, { withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

const directories = auditRoots
  .map((entry) => path.join(root, entry))
  .filter((fullPath) => fs.existsSync(fullPath))
  .flatMap((fullPath) => collectDirectories(fullPath))
  .sort((left, right) => toProjectPath(left).localeCompare(toProjectPath(right)));

const violations = [];

for (const fullPath of directories) {
  const projectPath = toProjectPath(fullPath);
  const fileCount = countFiles(fullPath);
  const budget = budgetFor(projectPath);

  if (fileCount > budget.maxFiles) {
    violations.push({
      projectPath,
      fileCount,
      ...budget
    });
  }
}

if (violations.length) {
  console.error("Folder density budget failed:");
  for (const violation of violations) {
    console.error(
      `- ${violation.projectPath}: ${violation.fileCount} files, max ${violation.maxFiles} for ${violation.label}.`
    );
  }
  console.error("Split crowded folders by feature, surface, documentation topic, or responsibility before adding more files.");
  process.exit(1);
}

console.log(`Folder density checked ${directories.length} folders.`);
