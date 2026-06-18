import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }
    offset += 2 + length;
  }

  return null;
}

function imageDimensions(root, file) {
  const buffer = fs.readFileSync(path.join(root, file));
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    return {
      height: buffer.readUInt32BE(20),
      width: buffer.readUInt32BE(16)
    };
  }

  return jpegDimensions(buffer);
}

export function validateStoreMedia(root, assert) {
  const storeMediaScript = fs.readFileSync(path.join(root, "scripts", "media", "generate-store-media.py"), "utf8");
  for (const expected of [
    "_locales",
    "extensionShortName",
    "appHeading",
    "extensionDescription",
    "buttonExportCsv",
    "buttonImportArchive"
  ]) {
    assert(storeMediaScript.includes(expected), `Store media generator must use locale-backed metadata: ${expected}`);
  }

  for (const screenshot of [
    "01-history-search.jpg",
    "02-quick-open.jpg",
    "03-backup-health.jpg",
    "04-rules-cleanup.jpg",
    "05-settings-privacy.jpg"
  ]) {
    const dimensions = imageDimensions(root, path.join("store-listing", "chrome-web-store", "media", "screenshots", screenshot));
    assert(dimensions?.width === 1280 && dimensions?.height === 800, `Store screenshot ${screenshot} must be 1280 x 800.`);
  }

  for (const [promo, width, height] of [
    ["small-promo.png", 440, 280],
    ["marquee-promo.png", 1400, 560]
  ]) {
    const dimensions = imageDimensions(root, path.join("store-listing", "chrome-web-store", "media", "promo", promo));
    assert(dimensions?.width === width && dimensions?.height === height, `Store promo ${promo} must be ${width} x ${height}.`);
  }

  const storePilotIcon = fs.readFileSync(path.join(root, "store-listing", "chrome-web-store", "media", "icon-128.png"));
  assert(
    storePilotIcon[0] === 137 && storePilotIcon[1] === 80 && storePilotIcon[2] === 78 && storePilotIcon[3] === 71,
    "StorePilot icon is not a PNG."
  );
  assert(
    storePilotIcon.readUInt32BE(16) === 128 && storePilotIcon.readUInt32BE(20) === 128,
    "StorePilot icon must be 128 x 128."
  );
}

function cliAssert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateStoreMedia(process.cwd(), cliAssert);
  console.log("Store media checked.");
}
