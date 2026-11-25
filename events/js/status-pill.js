// Status pills (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md §5.1 "Status pill", owner D2 A). A
// status pill is not a control: a tint, a word, and an icon where it helps. It never uses the solid fill, which is for
// the one primary action of a view. Tones: 'live' (in progress, a quiet neutral tint), 'ok' (finished work only, the
// --ok tint), 'caution' (something left to do), 'err' (errors and over time only), 'outline' (plain words) and ''
// (the default pill). DESIGN.md §1.2: green is for done; the word always carries the meaning, so color is never alone.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';

export const TONES = Object.freeze(['', 'live', 'ok', 'caution', 'err', 'outline']);

// One pill as HTML text. attrs: more attributes as HTML text (an id), or nothing.
export function statusPillHtml(tone, word, iconName, attrs) {
  const t = TONES.includes(tone) ? tone : '';
  return `<span class="pill${t ? ' ' + t : ''}"${attrs ? ' ' + attrs : ''}>${iconName ? icon(iconName, 14) : ''}${esc(word)}</span>`;
}
