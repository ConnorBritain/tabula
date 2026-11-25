// Tests for the shared definition registry, core/defs.js. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegistry, defKey } from './defs.js';

const files = [{ id: 'a', version: 1, n: 1 }, { id: 'a', version: 2, n: 2 }, { id: 'b', version: 1, n: 3, list: [{ x: 1 }] }];

// Why: a saved record must open with the exact version it was made under; if an old version stops being findable,
// old work opens with new rules or not at all.
test('get finds every version by id and version, and the newest by id alone', () => {
  const reg = createRegistry(files);
  assert.equal(reg.get('a', 1).n, 1);
  assert.equal(reg.get('a', '2').n, 2, 'a version read from a file or the address is a string');
  assert.equal(reg.get('a').n, 2);
  assert.equal(reg.get('a', 3), null);
  assert.equal(reg.get('z'), null);
  assert.equal(reg.get('constructor'), null, 'an id from the address must not reach Object.prototype');
  assert.deepEqual(reg.keys(), ['a@1', 'a@2', 'b@1']);
  assert.equal(defKey('a', 2), 'a@2');
});

// Why: the newest version must win whatever order the files load in; the page loads them in script order, so a
// later file with a lower version must not become the default for new work.
test('the newest version wins in any load order', () => {
  assert.equal(createRegistry([...files].reverse()).get('a').n, 2);
});

// Why: definitions are shared by every screen; if one screen could change one, every other screen would read the change.
test('prepare shapes each file, and the result is frozen all the way down', () => {
  const src = { id: 'b', version: 1, list: [{ x: 1 }] };
  const reg = createRegistry([src], { prepare: (f) => Object.assign({}, f, { count: f.list.length }) });
  const d = reg.get('b', 1);
  assert.equal(d.count, 1);
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d.list) && Object.isFrozen(d.list[0]));
  assert.ok(!Object.isFrozen(src), 'prepare copied the top level, so the file object itself is not frozen');
  assert.ok(Object.isFrozen(src.list), 'nested data is shared with the file and frozen in place (see core/defs.js)');
});

// Why: a record from a newer copy of the app names a version this copy lacks; without a fallback a pure function
// meets null and breaks the screen.
test('resolve gives the fallback for an unknown id or version, and null with no fallback', () => {
  const reg = createRegistry(files, { fallback: { id: 'a', version: 1 } });
  assert.equal(reg.resolve('a', 2).n, 2);
  assert.equal(reg.resolve('a', 9).n, 1);
  assert.equal(reg.resolve('nope').n, 1);
  assert.equal(createRegistry(files).resolve('nope'), null);
});

// Why: a bad or doubled file must stop loading at once; a quiet skip would open old records with the wrong rules.
test('a file with a bad id or version, a doubled file, or a missing fallback throws', () => {
  assert.throws(() => createRegistry([{ version: 1 }]), /no id/);
  assert.throws(() => createRegistry([{ id: 'a', version: 0 }]), /version/);
  assert.throws(() => createRegistry([{ id: 'a', version: 1.5 }]), /version/);
  assert.throws(() => createRegistry([{ id: 'a', version: 1 }, { id: 'a', version: 1 }]), /listed twice/);
  assert.throws(() => createRegistry(files, { fallback: { id: 'a', version: 7 } }), /fallback a@7/);
});
