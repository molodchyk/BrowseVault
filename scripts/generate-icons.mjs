import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = process.cwd();
const outputDir = path.join(root, "assets", "icons");
const sizes = [16, 32, 48, 128];

fs.mkdirSync(outputDir, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);

  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));

  return Buffer.concat([length, name, data, checksum]);
}

function setPixel(data, size, x, y, color) {
  if (x < 0 || x >= size || y < 0 || y >= size) {
    return;
  }

  const offset = (y * size + x) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = color[3];
}

function drawRect(data, size, x, y, width, height, color) {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      setPixel(data, size, px, py, color);
    }
  }
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const teal = [21, 94, 99, 255];
  const dark = [12, 52, 56, 255];
  const gold = [217, 154, 70, 255];
  const white = [244, 250, 250, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const ratio = (x + y) / (size * 2);
      setPixel(pixels, size, x, y, [
        Math.round(teal[0] * (1 - ratio) + dark[0] * ratio),
        Math.round(teal[1] * (1 - ratio) + dark[1] * ratio),
        Math.round(teal[2] * (1 - ratio) + dark[2] * ratio),
        255
      ]);
    }
  }

  const margin = Math.max(2, Math.round(size * 0.16));
  const stroke = Math.max(2, Math.round(size * 0.09));
  const vaultX = margin;
  const vaultY = Math.round(size * 0.31);
  const vaultW = size - margin * 2;
  const vaultH = size - vaultY - margin;

  drawRect(pixels, size, vaultX, vaultY, vaultW, vaultH, white);
  drawRect(pixels, size, vaultX + stroke, vaultY + stroke, vaultW - stroke * 2, vaultH - stroke * 2, teal);
  drawRect(pixels, size, vaultX + stroke * 2, vaultY - stroke, vaultW - stroke * 4, stroke, gold);
  drawRect(pixels, size, Math.round(size * 0.45), Math.round(size * 0.55), stroke * 2, stroke * 2, gold);

  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of sizes) {
  fs.writeFileSync(path.join(outputDir, `icon${size}.png`), drawIcon(size));
}

console.log(`Generated ${sizes.length} BrowseVault icons.`);

