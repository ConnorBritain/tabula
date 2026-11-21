// Guard: nothing in events/ ships to the live debate host (debate.tabulaspeech.com). Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOW } from '../build-app.mjs';

// Why: the Speech Events prototype is throwaway test code for events.tabulaspeech.com; if the debate build copied it, judges could open a half-built tool on the live debate site.
test('the debate app build does not copy the events folder', () => {
  for (const name of ALLOW) assert.ok(!/^events(\/|$)/.test(name), `build-app.mjs ALLOW ships ${name}`);
});
