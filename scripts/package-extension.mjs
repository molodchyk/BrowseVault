import fs from "node:fs";
import path from "node:path";
import { crc32 } from "./zip-utils.mjs";

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const distDir = path.join(root, "dist");
const output = path.join(distDir, `browsevault-${manifest.version}.zip`);
const includeRoots = ["manifest.json", "src", "assets", "README.md", "PRIVACY.md", "LICENSE"];
const disallowedZipPathPatterns = [
  /^docs\//,
  /^test\//,
  /^scripts\//,
  /^store\//,
  /^store-listing\//,
  /^dist\//,
  /\.map$/i,
  /\.test\.js$/i
];

fs.mkdirSync(distDir, { recursive: true });

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function collectFiles(entry, prefix = "") {
  const fullPath = path.join(root, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isFile()) {
    return [{ fullPath, zipPath: path.join(prefix, path.basename(entry)).replaceAll("\\", "/") }];
  }

  return fs
    .readdirSync(fullPath)
    .flatMap((child) => collectFiles(path.join(entry, child), path.join(prefix, path.basename(entry))));
}

function shouldPackage(file) {
  if (file.zipPath.startsWith("src/") && path.extname(file.zipPath).toLowerCase() === ".md") {
    return false;
  }

  return true;
}

function validatePackageFiles(files) {
  assert(files.length > 0, "Package cannot be empty.");
  for (const file of files) {
    assert(
      file.zipPath === "manifest.json"
        || file.zipPath === "README.md"
        || file.zipPath === "PRIVACY.md"
        || file.zipPath === "LICENSE"
        || file.zipPath.startsWith("src/")
        || file.zipPath.startsWith("assets/"),
      `Unexpected package entry root: ${file.zipPath}`
    );
    for (const pattern of disallowedZipPathPatterns) {
      assert(!pattern.test(file.zipPath), `Disallowed package entry: ${file.zipPath}`);
    }
  }
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function writeZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const timestamp = new Date("2026-01-01T00:00:00Z");
  const { dosDate, dosTime } = dosDateTime(timestamp);

  for (const file of files) {
    const data = fs.readFileSync(file.fullPath);
    const name = Buffer.from(file.zipPath);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.writeFileSync(output, Buffer.concat([...localParts, centralDirectory, end]));
}

const files = includeRoots
  .flatMap((entry) => collectFiles(entry))
  .filter(shouldPackage)
  .sort((a, b) => a.zipPath.localeCompare(b.zipPath));
validatePackageFiles(files);
writeZip(files);
console.log(`Packaged ${files.length} files to ${output}`);
