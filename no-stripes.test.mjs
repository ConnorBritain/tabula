// Tests for the owner's "no coloured left stripes" rule (2026-11-20). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('index.html', import.meta.url), 'utf8');

// Why: the owner removed coloured side stripes as a look that reads like generic AI-made UI; if one comes back, the app drifts from the agreed visual system.
test('no element gets a coloured inset or left-border stripe', () => {
  assert.doesNotMatch(html, /box-shadow:\s*inset\s+\d+px\s+0\s+0\s+var\(--(aff|neg|error)[^)]*\)/);
  assert.doesNotMatch(html, /border-left:\s*\d+px\s+solid\s+var\(--(aff|neg|error)[^)]*\)/);
});

// Why: with the stripe gone, the label colour is the only quick side cue on a speech tile; without it judges cannot tell Aff from Neg at a glance.
test('speech tiles show their side in the label text colour', () => {
  assert.match(html, /\.sp\.aff\s*\{[^}]*color:\s*var\(--aff\)/);
  assert.match(html, /\.sp\.neg\s*\{[^}]*color:\s*var\(--neg\)/);
});
