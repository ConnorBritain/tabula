// The v1 rule checks, read from their one source: the table in docs/events/EVENTS.md §7.
// The schema test and the prototype data builder both use this, so a check exists only once.
import { readFileSync } from 'node:fs';

const EVENTS_MD = new URL('../docs/events/EVENTS.md', import.meta.url);

/** [{ id, label }] for each row of the EVENTS.md §7 table, in table order. */
export function readCheckList(md = readFileSync(EVENTS_MD, 'utf8')) {
  const start = md.indexOf('## 7.');
  if (start < 0) throw new Error('EVENTS.md has no §7');
  const end = md.indexOf('\n## ', start + 1);
  const section = md.slice(start, end < 0 ? undefined : end);
  return [...section.matchAll(/^\|\s*`([A-Za-z]+)`\s*\|\s*"([^"]+)"\s*\|/gm)].map((m) => ({ id: m[1], label: m[2] }));
}
