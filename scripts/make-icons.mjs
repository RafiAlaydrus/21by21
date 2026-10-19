// Generates the app icons (black, bold white "21", thin green ring) as PNGs with no dependencies.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};
const poly = (pts) => pts.slice(1).map((p, i) => [pts[i][0], pts[i][1], p[0], p[1]]);
const arc = (cx, cy, r, a0, a1, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });

// digits in unit square coords
const top = 0.32, bottom = 0.68, r2 = 0.088, c2x = 0.43;
const two = poly([...arc(c2x, top + r2, r2, -170, 45), [c2x - r2, bottom], [c2x + r2 + 0.005, bottom]]);
const one = poly([[0.675 - 0.065, top + 0.065], [0.675, top], [0.675, bottom]]);
const strokes = [...two, ...one];

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const stroke = 0.062, ringR = 0.4, ringW = 0.016;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + 0.5) / size, v = (y + 0.5) / size, aa = 1 / size;
    let d = 9;
    for (const s of strokes) d = Math.min(d, segDist(u, v, ...s));
    const white = Math.max(0, Math.min(1, (stroke / 2 - d) / aa + 0.5));
    const rd = Math.abs(Math.hypot(u - 0.5, v - 0.5) - ringR);
    const green = Math.max(0, Math.min(1, (ringW / 2 - rd) / aa + 0.5));
    const i = (y * size + x) * 4;
    px[i] = Math.round(255 * white + 48 * green * (1 - white));
    px[i + 1] = Math.round(255 * white + 209 * green * (1 - white));
    px[i + 2] = Math.round(255 * white + 88 * green * (1 - white));
    px[i + 3] = 255;
  }
  return px;
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const px = render(size);
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['maskable-512', 512], ['apple-touch-icon', 180]])
  writeFileSync(`public/icons/${name}.png`, png(size));
console.log('icons written');
