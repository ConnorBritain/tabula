// Speech Events judge card: a small QR code encoder that runs on the device (no network, no library). It makes the
// code for the app link printed on the judge card (events/kit/index.html).
// Scope: byte mode only, versions 1 to 10 (up to 213 bytes at level M), error correction L, M, Q or H. A link fits
// easily. It follows ISO/IEC 18004. Its steps and formulas are adapted from Project Nayuki's QR Code generator library
// (https://www.nayuki.io/page/qr-code-generator-library), which is under the MIT License below.
// events/kit/qr.test.mjs checks the matrix against a known answer and reads the text back out of it.
//
// Copyright (c) Project Nayuki. (MIT License)
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the following conditions:
// - The above copyright notice and this permission notice shall be included in all copies or substantial portions of
//   the Software.
// - The Software is provided "as is", without warranty of any kind, express or implied, including but not limited to
//   the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the
//   authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract,
//   tort or otherwise, arising from, out of or in connection with the Software or the use or other dealings in the
//   Software.

// Error correction words per block and the number of blocks, for each level and version 1..10 (index 0 unused).
const ECC_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
// The two format bits for each level (L is 01, M is 00, Q is 11, H is 10).
const LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };
export const MAX_VERSION = 10;

// The modules left for data and error correction after the function patterns, for one version.
export function rawModules(ver) {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** How many data bytes (codewords) a version holds at a level. */
export const dataCodewords = (ver, level) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[level][ver] * BLOCKS[level][ver];

// ---------- Reed-Solomon over GF(2^8), polynomial 0x11D ----------
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const out = new Array(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = gfMul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return out;
}

function rsRemainder(data, divisor) {
  const out = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ out.shift();
    out.push(0);
    divisor.forEach((d, i) => { out[i] ^= gfMul(d, factor); });
  }
  return out;
}

// ---------- the codewords ----------
// The data bytes for the text: mode 0100, the length, the bytes, the end mark, then 0xEC 0x11 pad bytes.
function dataBytes(bytes, ver, level) {
  const cap = dataCodewords(ver, level) * 8;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const out = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}

// Split the data into blocks, add each block's error correction, and interleave them.
function withEcc(data, ver, level) {
  const nBlocks = BLOCKS[level][ver];
  const eccLen = ECC_PER_BLOCK[level][ver];
  const raw = Math.floor(rawModules(ver) / 8);
  const nShort = nBlocks - (raw % nBlocks);
  const shortLen = Math.floor(raw / nBlocks);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) out.push(b[i]); });
  }
  return out;
}

// ---------- the matrix ----------
/** The centre rows and columns of the alignment patterns for a version. */
export function alignmentPositions(ver) {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

// The 15 format bits for a level and mask (BCH code, then the fixed XOR mask 0x5412).
export function formatBits(level, mask) {
  const data = (LEVEL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function makeGrid(ver) {
  const size = ver * 4 + 17;
  const dark = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, on) => { dark[y][x] = on; fixed[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const pos = alignmentPositions(ver);
  const last = pos.length - 1;
  pos.forEach((ay, i) => pos.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, on); set(b, a, on);
    }
  }
  return { size, dark, fixed, set };
}

function drawFormat(g, level, mask) {
  const bits = formatBits(level, mask);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const { size, set } = g;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true); // the dark module
}

function drawCodewords(g, words) {
  const { size, dark, fixed } = g;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && i < words.length * 8) { dark[y][x] = ((words[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
      }
    }
  }
}

const applyMask = (g, mask) => {
  for (let y = 0; y < g.size; y++) for (let x = 0; x < g.size; x++) if (!g.fixed[y][x] && MASKS[mask](x, y)) g.dark[y][x] = !g.dark[y][x];
};

// The standard penalty score of a finished matrix (rules N1 to N4). The mask with the lowest score is used.
export function penalty(dark) {
  const size = dark.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < size; i++) { lines.push(dark[i]); lines.push(dark.map((row) => row[i])); }
  for (const line of lines) {
    // N1: a run of 5 or more of one colour.
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    // N3: 1:1:3:1:1 finder-like pattern with 4 light modules on one side.
    const s = line.map((d) => (d ? '1' : '0')).join('');
    for (let i = 0; i + 11 <= size; i++) {
      const w = s.slice(i, i + 11);
      if (w === '10111010000' || w === '00001011101') score += 40;
    }
  }
  // N2: each 2x2 block of one colour.
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = dark[y][x];
      if (c === dark[y][x + 1] && c === dark[y + 1][x] && c === dark[y + 1][x + 1]) score += 3;
    }
  }
  // N4: how far the share of dark modules is from half.
  const darkCount = dark.reduce((a, row) => a + row.filter(Boolean).length, 0);
  score += Math.floor(Math.abs((darkCount * 100) / (size * size) - 50) / 5) * 10;
  return score;
}

/**
 * Encode text as a QR code. opts: { level: 'L' | 'M' | 'Q' | 'H' (default 'M'), mask: 0..7 (default: the lowest
 * penalty) }. Returns { version, size, level, mask, modules } where modules[y][x] is true for a dark module. Throws when
 * the text does not fit in version 10.
 */
export function encodeQr(text, opts = {}) {
  const level = opts.level || 'M';
  if (!(level in LEVEL_BITS)) throw new Error('Unknown error correction level: ' + level);
  const bytes = [...new TextEncoder().encode(String(text))];
  let ver = 1;
  while (ver <= MAX_VERSION && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > dataCodewords(ver, level) * 8) ver++;
  if (ver > MAX_VERSION) throw new Error('The text is too long for this QR code (' + bytes.length + ' bytes).');
  const words = withEcc(dataBytes(bytes, ver, level), ver, level);
  const build = (mask) => {
    const g = makeGrid(ver);
    drawFormat(g, level, mask);
    drawCodewords(g, words);
    applyMask(g, mask);
    return g;
  };
  let best = null;
  const masks = opts.mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [opts.mask];
  for (const mask of masks) {
    const g = build(mask);
    const score = masks.length > 1 ? penalty(g.dark) : 0;
    if (!best || score < best.score) best = { g, mask, score };
  }
  return { version: ver, size: best.g.size, level, mask: best.mask, modules: best.g.dark };
}

/**
 * The QR code as SVG text: black modules on a white square with a 4-module quiet zone, so it prints and scans the
 * same in light and dark themes. label: the accessible name.
 */
export function qrSvg(qr, label) {
  const n = qr.size + 8;
  let d = '';
  qr.modules.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  const name = String(label).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" role="img" aria-label="${name}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}
