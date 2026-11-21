// Source text for the static tests (tests that read the code as text). Run nothing here; tests require it.
// The page code is split by job into js/*.js plus the app.js entry, and the pure logic into logic/*.js plus the
// logic.js facade (the owner approved this module split before Slice 5). A check that used to read app.js or
// logic.js must still read all of that code, so these helpers join every file of a group, in the order index.html
// loads them. The list comes from index.html itself, so a new part is checked as soon as the page loads it.
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const scriptSrcs = () => [...read('index.html').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const APP_FILES = [...scriptSrcs().filter((s) => s.startsWith('js/')), 'app.js'];
const LOGIC_FILES = [...scriptSrcs().filter((s) => s.startsWith('logic/')), 'logic.js'];

// readSource('app.js') -> all page code; readSource('logic.js') -> all pure logic; readSource('ui.js') -> core/ui.js and
// ui.js; any other file -> that file.
function readSource(f) {
  if (f === 'app.js') return APP_FILES.map(read).join('\n');
  if (f === 'logic.js') return LOGIC_FILES.map(read).join('\n');
  // ui.js builds the toast, ask() and modalDialog from core/ui.js (step C3), so a check on ui.js reads both.
  // A new test that means one file only should read that file directly.
  if (f === 'ui.js') return ['core/ui.js', 'ui.js'].map(read).join('\n');
  return read(f);
}

module.exports = { APP_FILES, LOGIC_FILES, readSource };
