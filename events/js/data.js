// Tabula Speech Events: the event loader (docs/events/LANDING.md §4.1, step E1). It reads events/published.json, then
// every event and rules profile file it lists, and loads them through the shared registry (core/defs.js), so every
// version stays findable and an old room opens with the rules it was judged under. No DOM: the app passes in how to
// read a file (fetch in the page, the file system in tests).
import { createRegistry, defKey } from '../../core/defs.js';

// The events app's prepare hook: a key, and the limit in minutes for the timer face.
export const prepareEvent = (d) => Object.assign({}, d, { key: defKey(d.id, d.version), limitMinutes: d.timing.limit / 60 });
export const prepareProfile = (p) => Object.assign({}, p, { key: defKey(p.id, p.version) });

// readJson(path): a promise of the parsed file at a path under events/ ('published.json', 'defs/oo.v1.json').
// Returns { events, profiles, order }: two registries (get, resolve, keys) and the event ids in published.json's order
// (the order the event picker shows). A manifest with no events or no profiles, or a file that is listed but missing
// or broken, rejects the whole load, so the app never runs with half its rules.
export async function loadEventData(readJson) {
  const pub = await readJson('published.json');
  if (!pub || !Array.isArray(pub.defs) || !pub.defs.length || !Array.isArray(pub.profiles) || !pub.profiles.length) throw new Error('published.json lists no events or no profiles');
  const [defs, profiles] = await Promise.all([
    Promise.all(pub.defs.map((f) => readJson('defs/' + f))),
    Promise.all(pub.profiles.map((f) => readJson('profiles/' + f))),
  ]);
  const events = createRegistry(defs, { prepare: prepareEvent });
  const order = [];
  for (const d of defs) if (!order.includes(d.id)) order.push(d.id);
  return { events, profiles: createRegistry(profiles, { prepare: prepareProfile }), order };
}
