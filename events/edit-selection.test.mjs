import test from 'node:test';
import assert from 'node:assert/strict';
import { readFeedbackSelection, trackFeedbackSelection } from './js/edit-selection.js';
import { editDefaults } from './js/edit-options.js';
const globals = (values, run) => {
  const before = new Map(Object.keys(values).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  try { for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); return run(); }
  finally { for (const [key, value] of before) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } }
};

// Why: selection controls must work while typing, and must never include private-note fields or unrelated textareas.
test('textarea selection is restricted to public feedback and preserves exact offsets', () => globals({ document: { activeElement: null }, window: { scrollY: 15, getSelection: () => null } }, () => {
  const input = { dataset: { id: 'e1' }, value: 'A clear opening. A rushed ending.', selectionStart: 17, selectionEnd: 33, matches: (s) => s === 'textarea[data-vfield="comment"]', getBoundingClientRect: () => ({ top: 30, bottom: 90, left: 10, right: 350 }) };
  const root = { contains: (el) => el === input };
  document.activeElement = input;
  const selection = readFeedbackSelection(root);
  assert.deepEqual([selection.id, selection.start, selection.end, selection.base, selection.input], ['e1', 17, 33, input.value, true]);
  input.selectionEnd = 17; assert.equal(readFeedbackSelection(root), null);
  input.matches = () => false; assert.equal(readFeedbackSelection(root), null);
  input.matches = () => true; input.selectionEnd = 33;
  assert.equal(readFeedbackSelection({ contains: () => false }), null);
}));

// Why: a drag across multiple comments must not turn into an AI request against either whole comment.
test('read-only selections must start and end inside one public comment', () => globals({ document: { activeElement: null }, window: { scrollY: 0 } }, () => {
  const one = { dataset: { aiText: 'e1' }, textContent: 'One. Two.', closest() { return this; } }, two = { ...one, dataset: { aiText: 'e2' } };
  const first = { nodeType: 3, parentElement: one }, last = { nodeType: 3, parentElement: two };
  const range = { startContainer: first, startOffset: 5, endContainer: first, toString: () => 'Two.', cloneRange: () => ({ selectNodeContents() {}, setEnd() {}, toString: () => 'One. ' }), getBoundingClientRect: () => ({ top: 5, bottom: 20, left: 10, right: 50 }) };
  window.getSelection = () => ({ isCollapsed: false, rangeCount: 1, getRangeAt: () => range });
  const root = { contains: () => true };
  assert.deepEqual([readFeedbackSelection(root).start, readFeedbackSelection(root).end], [5, 9]);
  range.endContainer = last; assert.equal(readFeedbackSelection(root), null);
  range.endContainer = first; assert.equal(readFeedbackSelection({ contains: () => false }), null);
  one.closest = () => null; assert.equal(readFeedbackSelection(root), null);
}));

// Why: native selection events must not discard the saved excerpt when focus moves into the AI popover.
test('selection tracking excludes its own controls and removes every handler on exit', () => {
  const handlers = new Map(), docHandlers = new Map(), changes = [];
  const root = { contains: () => true, addEventListener: (n, f) => handlers.set(n, f), removeEventListener: (n) => handlers.delete(n) };
  globals({ document: { activeElement: null, addEventListener: (n, f) => docHandlers.set(n, f), removeEventListener: (n) => docHandlers.delete(n) }, window: { getSelection: () => null }, requestAnimationFrame: (f) => { return 1; }, cancelAnimationFrame() {} }, () => {
    const stop = trackFeedbackSelection(root, (v) => changes.push(v));
    docHandlers.get('pointerup')({ target: { closest: () => ({}) } });
    assert.equal(changes.length, 0);
    docHandlers.get('pointerup')({ target: { closest: () => null } }); assert.deepEqual(changes, [null]);
    stop(); assert.equal(handlers.size, 0); assert.equal(docHandlers.size, 0);
  });
});

// Why: old or damaged settings must yield a safe edit, while saved custom requests remain bounded wording data.
test('edit defaults validate operations and bound saved requests', () => {
  for (const value of [null, [], { mode: 'unknown' }, { mode: 'custom', request: ' ' }]) assert.equal(editDefaults(value).mode, 'full');
  assert.equal(editDefaults({ mode: 'concise' }).mode, 'concise');
  assert.equal(editDefaults({ mode: 'custom', request: 'x'.repeat(2000) }).request.length, 1000);
  assert.equal(editDefaults({ mode: 'custom', request: 'a\0b' }).request, 'ab');
});
