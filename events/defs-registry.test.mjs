// The Speech Events data files load through the shared registry, core/defs.js (docs/events/LANDING.md §3, step C1).
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRegistry, defKey } from '../core/defs.js';

const readJson = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const PUB = readJson('published.json');
const FILES = PUB.defs.map((f) => readJson('defs/' + f));

// The events app's own prepare hook, as the Speech Events shell (E1) will use it: a key, and the limit in minutes
// for the timer face. Debate's prepare (logic/format.js) is a different hook on the same registry.
const prepare = (d) => Object.assign({}, d, { key: defKey(d.id, d.version), limitMinutes: d.timing.limit / 60 });

// Why: the two apps must share one registry. If the event files cannot load through it, Speech Events needs its own
// copy, and a fix in one copy (for example "never lose an old version") misses the other.
test('every published event file loads through the shared registry with an events prepare', () => {
  const reg = createRegistry(FILES, { prepare });
  assert.equal(reg.keys().length, PUB.defs.length);
  for (const f of PUB.defs) {
    const [id, v] = f.replace(/\.json$/, '').split('.v');
    const d = reg.get(id, Number(v));
    assert.ok(d, f + ' is not in the registry');
    assert.equal(d.key, id + '@' + v, f);
    assert.equal(d.limitMinutes * 60, d.timing.limit, f);
    assert.ok(Object.isFrozen(d) && Object.isFrozen(d.timing) && Object.isFrozen(d.tags), f + ' is not frozen');
  }
  for (const d of FILES) assert.equal(reg.get(d.id).version, Math.max(...FILES.filter((o) => o.id === d.id).map((o) => o.version)), d.id + ': get(id) is not the newest version');
});
