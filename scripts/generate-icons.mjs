import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createVidGramPng(size, safeMarginRatio = 0.12) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const margin = size * safeMarginRatio;
  const innerSize = size - margin * 2;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Slate-900 background #0F172A
      let r = 15, g = 23, b = 42, a = 255;

      // Gradient factor
      const t = Math.min(1, Math.max(0, ((x - margin) + (y - margin)) / (innerSize * 2)));
      const gr = Math.round(244 + (245 - 244) * t);
      const gg = Math.round(63 + (158 - 63) * t);
      const gb = Math.round(94 + (11 - 94) * t);

      // Rounded frame inside safe zone
      const dx = Math.abs(x - cx);
      const dy = Math.abs(y - cy);
      const halfBox = innerSize * 0.42;
      const stroke = Math.max(3, size * 0.045);

      const inOuter = dx <= halfBox && dy <= halfBox;
      const inInner = dx <= (halfBox - stroke) && dy <= (halfBox - stroke);
      if (inOuter && !inInner) {
        r = gr; g = gg; b = gb;
      }

      // Play triangle inside center
      const relX = (x - cx) / innerSize;
      const relY = (y - cy) / innerSize;
      if (relX >= -0.11 && relX <= 0.16) {
        const halfH = (0.16 - relX) * 0.62;
        if (Math.abs(relY) <= halfH) {
          r = gr; g = gg; b = gb;
        }
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const pubDir = path.resolve('public');
fs.mkdirSync(pubDir, { recursive: true });
fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createVidGramPng(192, 0.08));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createVidGramPng(512, 0.08));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createVidGramPng(512, 0.16));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createVidGramPng(180, 0.08));
console.log('Generated VidGram PWA PNG icons.');
