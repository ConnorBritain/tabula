// Speech Events step S1 (docs/events/EXPERIENCE.md §2.2): the round-type router's registry.
//   round -> its event file -> family (data.js familyOf) -> WORKSPACES[family] -> the workspace module -> mount
// Every room family (f1, f2, f3, Custom) loads one module, the room workspace. Later families add a line here.
//
// Offline (§9): each module in WORKSPACES must be in the service worker list. build-sw.mjs adds every path below to
// the crawl, and events/router.test.mjs fails if one is missing from sw-files.js.
//
// Open point: §2.2 loads each module on demand with a dynamic import. events/sw.test.mjs (step E2) forbids that form in
// any page file, so until the owner decides on that test, the modules are imported here and handed out by path.
// loadWorkspace already returns a promise, so the change to a dynamic import stays inside this file.
import * as roomWorkspace from './room-workspace.js';
import * as congressWorkspace from '../congress/workspace.js';
import { familyOf } from './data.js';
import { roomEvent } from './room.js';

// family -> module path (relative to this file).
export const WORKSPACES = Object.freeze({
  f1: './room-workspace.js',
  f2: './room-workspace.js',
  f3: './room-workspace.js',
  custom: './room-workspace.js',
  congress: '../congress/workspace.js', // step S6: a Congress session (records in tabulaEvents.congress.v1)
});

const MODULES = Object.freeze({ './room-workspace.js': roomWorkspace, '../congress/workspace.js': congressWorkspace });

// A promise of the workspace module for a family. A family with no workspace rejects.
export async function loadWorkspace(family) {
  const path = Object.prototype.hasOwnProperty.call(WORKSPACES, family) ? WORKSPACES[family] : null;
  if (!path || !MODULES[path]) throw new Error('No workspace for the family ' + family);
  return MODULES[path];
}

// The family of a saved round. A room whose event file is not on this device opened in the room screen before S1
// (titled "Custom event"), so it still opens in the room workspace.
export const roundFamily = (events, round) => familyOf(roomEvent(events, round)) || 'custom';

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).workspaces = Object.freeze({ WORKSPACES, loadWorkspace, roundFamily });
