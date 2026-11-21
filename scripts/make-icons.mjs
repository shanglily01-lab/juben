import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function paint(x, y, size) {
  const cx = (x + 0.5) / size - 0.5;
  const cy = (y + 0.5) / size - 0.5;
  const radius = Math.hypot(cx, cy);
  const ink = [255, 246, 228, 255];
  const red = [184, 110, 0, 255];
  const paper = [255, 214, 102, 255];
  const px = (x + 0.5) / size;
  const py = (y + 0.5) / size;
  if (radius > 0.34) return ink;
  if (radius > 0.27) return red;
  if (px > 0.43 && px < 0.57 && py > 0.43 && py < 0.57) return red;
  return paper;
}

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const index = row + 1 + x * 4;
      raw[index] = r;
      raw[index + 1] = g;
      raw[index + 2] = b;
      raw[index + 3] = a;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(process.cwd(), "public");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-192.png"), png(192));
fs.writeFileSync(path.join(dir, "icon-512.png"), png(512));
fs.writeFileSync(path.join(dir, "apple-touch-icon.png"), png(180));
console.log("icons written");
