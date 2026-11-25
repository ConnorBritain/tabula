// Status pills (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md §5.1 "Status pill", owner D2 A). A
// status pill is not a control: a tint, a word, and an icon where it helps. It never uses the solid fill, which is for
// the one primary action of a view. Tones: 'live' (in progress, a quiet neutral tint), 'ok' (finished work only, the
// --ok tint), 'caution' (something left to do), 'err' (errors and over time only), 'outline' (plain words) and ''
// (the default pill). DESIGN.md §1.2: green is for done; the word always carries the meaning, so color is never alone.
// Cleanup (2026-11-25): every pill in events/ is made here, so the markup and the tone list live in one place.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';
import { routeHash } from './routes.js';

const TONES = Object.freeze(['', 'live', 'ok', 'caution', 'err', 'outline']);

// One pill as HTML text. opts: more attributes as HTML text (an id), or { attrs, cls, tag }: attrs as before, cls more
// classes after the tone ("pk-chip"), tag the element ('span' when left out; 'a' for a pill that is a link).
export function statusPillHtml(tone, word, iconName, opts) {
  const o = typeof opts === 'string' ? { attrs: opts } : (opts || {});
  const t = TONES.includes(tone) ? tone : '';
  const tag = o.tag === 'a' ? 'a' : 'span';
  return `<${tag} class="pill${t ? ' ' + t : ''}${o.cls ? ' ' + o.cls : ''}"${o.attrs ? ' ' + o.attrs : ''}>${iconName ? icon(iconName, 14) : ''}${esc(word)}</${tag}>`;
}

// The event pill (My day rows and the room header): the event's short name, a link to its type page. withTitle: the
// full name as a hover title too (My day, where the short name stands alone in a row).
export const eventPillHtml = (eventId, name, short, withTitle) => statusPillHtml('', short, '', {
  tag: 'a', cls: 'md-ev', attrs: `href="${esc(routeHash('type', eventId))}"${withTitle ? ` title="${esc(name)}"` : ''} aria-label="${esc('About ' + name)}"`,
});
