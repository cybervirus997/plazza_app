// Original geometric Plazza mark. Uses only Node built-ins; no remote assets.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function icon(transparent) {
  const size = 1024;
  const data = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.abs(x - size / 2), dy = Math.abs(y - size / 2);
    const cross = (dx < 57 && dy < 200) || (dx < 200 && dy < 57);
    const index = y * (1 + size * 4) + 1 + x * 4;
    data.set(cross ? [255, 255, 255, 255] : transparent ? [0, 0, 0, 0] : [8, 125, 102, 255], index);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(data)), chunk('IEND', Buffer.alloc(0))]);
}
const directory = path.resolve(__dirname, '../assets/images');
fs.writeFileSync(path.join(directory, 'plazza-icon.png'), icon(false));
fs.writeFileSync(path.join(directory, 'plazza-foreground.png'), icon(true));
