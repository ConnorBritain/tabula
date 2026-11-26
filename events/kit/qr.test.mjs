// Why: if the on-device QR encoder is wrong, the printed judge card shows a code that phones cannot scan, or one that opens the wrong address.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr, qrSvg, formatBits, alignmentPositions, dataCodewords, MAX_VERSION } from './qr.js';

const URL_TEXT = 'https://events.tabulaspeech.com/';

// Known answer: the same link made by a separate, widely used encoder (the npm "qrcode" package, version 1.5.4, byte
// mode, level M). It chose version 3 and mask 2. Row y, column x; 1 is a dark module.
const KNOWN = [
  '11111110001111110001101111111',
  '10000010010001111010101000001',
  '10111010111001010011001011101',
  '10111010101100110100101011101',
  '10111010101000011011101011101',
  '10000010101100000000101000001',
  '11111110101010101010101111111',
  '00000000110000101000000000000',
  '10111110000110001100001111100',
  '01110000101011110011101110001',
  '01111110001001111000000000000',
  '00100000001111010000110101010',
  '00011110011000110101000001100',
  '11101000011000011011101110001',
  '10011010110110000110110111100',
  '11010101100010101000101110010',
  '11101110000110000100110001100',
  '11001000000001110111111110101',
  '10001010101111111010001000100',
  '10111000111011001011011110010',
  '10001011100100100110111110111',
  '00000000111000000110100011111',
  '11111110000110011101101011100',
  '10000010111000111011100010010',
  '10111010100010000100111110110',
  '10111010101000101011000101111',
  '10111010111110011110001111110',
  '10000010010001001000100111010',
  '11111110110111000101010110100',
];

const rows = (qr) => qr.modules.map((r) => r.map((d) => (d ? '1' : '0')).join(''));

// Why: A wrong QR matrix could send every printed card to an unreadable code.
test('the app link gives the known matrix: version 3, level M, mask 2', () => {
  const qr = encodeQr(URL_TEXT);
  assert.equal(qr.version, 3);
  assert.equal(qr.level, 'M');
  assert.equal(qr.mask, 2);
  assert.equal(qr.size, 29);
  assert.deepEqual(rows(qr), KNOWN);
});

// ---------- a small reader, written apart from the encoder, that reads the text back out of a matrix ----------
// GF(2^8) with exp and log tables (the encoder multiplies bit by bit), so a shared mistake is unlikely.
const EXP = new Array(512); const LOG = new Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

// The modules that are not data: finders with separators and format areas, timing, alignment patterns, version info.
function functionMap(ver) {
  const n = ver * 4 + 17;
  const f = Array.from({ length: n }, () => new Array(n).fill(false));
  const box = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (x >= 0 && y >= 0 && x < n && y < n) f[y][x] = true; };
  box(0, 0, 9, 9); box(n - 8, 0, 8, 9); box(0, n - 8, 9, 8);
  box(6, 0, 1, n); box(0, 6, n, 1);
  const p = alignmentPositions(ver);
  // No alignment pattern sits on a finder corner (top left, top right, bottom left).
  const finder = (x, y) => (x < 9 && y < 9) || (x > n - 9 && y < 9) || (x < 9 && y > n - 9);
  for (const y of p) for (const x of p) if (!finder(x, y)) box(x - 2, y - 2, 5, 5);
  if (ver >= 7) { box(n - 11, 0, 3, 6); box(0, n - 11, 6, 3); }
  return f;
}

// Read the format bits, undo the mask, read the codewords, check each block's error correction, and parse the text.
// Handles every version this encoder makes (blocks of two lengths included).
function readQr(m) {
  const n = m.length; const ver = (n - 17) / 4;
  let fmt = 0;
  for (let i = 0; i <= 5; i++) fmt |= (m[i][8] ? 1 : 0) << i;
  fmt |= (m[7][8] ? 1 : 0) << 6; fmt |= (m[8][8] ? 1 : 0) << 7; fmt |= (m[8][7] ? 1 : 0) << 8;
  for (let i = 9; i < 15; i++) fmt |= (m[8][14 - i] ? 1 : 0) << i;
  const info = (fmt ^ 0x5412) >>> 10;
  const level = ['M', 'L', 'H', 'Q'][info >>> 3]; const mask = info & 7;
  const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][mask];
  const f = functionMap(ver);
  const bits = [];
  for (let col = n - 1, up = true; col > 0; col -= 2, up = !up) {
    if (col === 6) col--;
    for (let k = 0; k < n; k++) {
      const y = up ? n - 1 - k : k;
      for (const x of [col, col - 1]) if (!f[y][x]) bits.push((m[y][x] !== maskFn(x, y)) ? 1 : 0);
    }
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) words.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  // Split the interleaved words back into blocks.
  const total = Math.floor(words.length);
  const nData = dataCodewords(ver, level);
  const BL = { L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4], M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5], Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8], H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8] }[level][ver];
  const ecc = (total - nData) / BL;
  const shortData = Math.floor(nData / BL); const nLong = nData % BL;
  const blocks = Array.from({ length: BL }, (_, j) => ({ d: [], e: [], dl: shortData + (j >= BL - nLong ? 1 : 0) }));
  let k = 0;
  for (let i = 0; i < shortData + 1; i++) for (const b of blocks) if (i < b.dl) b.d.push(words[k++]);
  for (let i = 0; i < ecc; i++) for (const b of blocks) b.e.push(words[k++]);
  // Each block, data then error correction, must be a code word: every syndrome is zero.
  for (const b of blocks) {
    const cw = b.d.concat(b.e);
    for (let r = 0; r < ecc; r++) {
      let s = 0;
      for (const c of cw) s = mul(s, EXP[r]) ^ c;
      assert.equal(s, 0, 'syndrome ' + r + ' of a block is not zero');
    }
  }
  const data = blocks.flatMap((b) => b.d);
  const dbits = data.flatMap((w) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (w >>> i) & 1));
  const take = (len) => { const v = dbits.splice(0, len).reduce((a, b) => (a << 1) | b, 0); return v; };
  assert.equal(take(4), 0b0100, 'byte mode');
  const len = take(ver < 10 ? 8 : 16);
  const bytes = []; for (let i = 0; i < len; i++) bytes.push(take(8));
  return { text: new TextDecoder().decode(new Uint8Array(bytes)), level, mask, ver };
}

// Why: A code must carry the public app address when a judge scans the printed card.
test('the reader reads the app link back from the encoder and from the known matrix', () => {
  const qr = encodeQr(URL_TEXT);
  assert.deepEqual(readQr(qr.modules), { text: URL_TEXT, level: 'M', mask: 2, ver: 3 });
  assert.equal(readQr(KNOWN.map((r) => [...r].map((c) => c === '1'))).text, URL_TEXT);
});

// Why: Longer QR payloads must remain readable across the supported error-correction levels.
test('text of many lengths reads back at every level and every version up to 10', () => {
  const seen = new Set();
  for (const level of ['L', 'M', 'Q', 'H']) {
    for (let len = 1; len <= 280; len += 7) {
      const text = ('https://example.org/?q=' + 'Ab9_é'.repeat(80)).slice(0, len);
      let qr;
      try { qr = encodeQr(text, { level }); } catch { continue; }
      seen.add(level + qr.version);
      const back = readQr(qr.modules);
      assert.equal(back.text, text, level + ' ' + len);
      assert.equal(back.level, level);
      assert.equal(back.mask, qr.mask);
    }
  }
  for (const level of ['L', 'M', 'Q', 'H']) for (let v = 1; v <= MAX_VERSION; v++) assert.ok(seen.has(level + v), level + v + ' was tested');
});

// Why: A mask choice must not make an otherwise valid code unreadable.
test('every forced mask still reads back', () => {
  for (let mask = 0; mask < 8; mask++) assert.equal(readQr(encodeQr(URL_TEXT, { mask }).modules).text, URL_TEXT);
});

// Why: Damaged format or version information can prevent a camera from reading an intact payload.
test('both format copies agree, and version 7 carries the standard version bits', () => {
  for (const level of ['L', 'M', 'Q', 'H']) {
    const m = encodeQr('x'.repeat(level === 'H' ? 60 : 90), { level, mask: 5 }).modules;
    const n = m.length;
    let a = 0, b = 0;
    for (let i = 0; i <= 5; i++) a |= (m[i][8] ? 1 : 0) << i;
    a |= (m[7][8] ? 1 : 0) << 6; a |= (m[8][8] ? 1 : 0) << 7; a |= (m[8][7] ? 1 : 0) << 8;
    for (let i = 9; i < 15; i++) a |= (m[8][14 - i] ? 1 : 0) << i;
    for (let i = 0; i < 8; i++) b |= (m[8][n - 1 - i] ? 1 : 0) << i;
    for (let i = 8; i < 15; i++) b |= (m[n - 15 + i][8] ? 1 : 0) << i;
    assert.equal(a, b, level);
    assert.equal(a, formatBits(level, 5), level);
    assert.equal(m[n - 8][8], true, 'the dark module');
  }
  // Version 7 (ISO/IEC 18004 table D.1): 000111 110010 010100, in both 6 x 3 blocks.
  const qr = encodeQr('x'.repeat(110), { level: 'M' });
  assert.equal(qr.version, 7);
  const n = qr.size;
  let top = 0, left = 0;
  for (let i = 0; i < 18; i++) {
    const r = Math.floor(i / 3), c = n - 11 + (i % 3);
    top |= (qr.modules[r][c] ? 1 : 0) << i;
    left |= (qr.modules[c][r] ? 1 : 0) << i;
  }
  assert.equal(top, 0x07c94);
  assert.equal(left, 0x07c94);
});

// Why: Wrong format information would make a scanner use the wrong mask or error-correction level.
test('format bits match the standard table', () => {
  assert.equal(formatBits('M', 0), 0b101010000010010);
  assert.equal(formatBits('L', 0), 0b111011111000100);
  assert.equal(formatBits('Q', 0), 0b011010101011111);
  assert.equal(formatBits('H', 0), 0b001011010001001);
  assert.equal(formatBits('M', 2), 0b101111001111100);
});

// Why: Unsupported QR input must fail before a coach prints a code that cannot be read.
test('text that does not fit and an unknown level are refused', () => {
  assert.throws(() => encodeQr('x'.repeat(214), { level: 'M' }), /too long/);
  assert.doesNotThrow(() => encodeQr('x'.repeat(213), { level: 'M' }));
  assert.throws(() => encodeQr('x', { level: 'Z' }), /Unknown/);
});

// Why: A QR needs clear light margins and safe label text to remain readable on the page.
test('the SVG is black on a white square with a quiet zone, and its label is escaped', () => {
  const qr = encodeQr(URL_TEXT);
  const svg = qrSvg(qr, 'a "b" <c> & d');
  assert.match(svg, /viewBox="0 0 37 37"/);
  assert.match(svg, /<rect width="37" height="37" fill="#fff"\/>/);
  assert.match(svg, /<path fill="#000" d="M4 4h1v1h-1z/);
  assert.match(svg, /aria-label="a &quot;b&quot; &lt;c> &amp; d"/);
  assert.equal((svg.match(/h1v1h-1z/g) || []).length, qr.modules.flat().filter(Boolean).length);
});
