// The one fold style (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md §5.4, top 10 #9). Native
// <details>/<summary>, the native marker hidden, a chevron that points down at the end of the row ("opens here"); it
// turns 180° when open (no motion under reduced motion). A chevron that points right means "goes to a screen" and never
// marks a fold. The row is full width, 44 px or more, with a full 1 px control edge.
import { escapeHtml as esc } from '../../core/sheets.js';
import { icon } from './icons.js';

// The summary of a fold as HTML text. label: the words (HTML text, already escaped); extra: more HTML after the label
// (a value in words, a pill), or nothing.
export const foldSummaryHtml = (label, extra) => `<summary class="fold-row"><span class="fold-label">${label}</span>${extra || ''}${icon('chevron-down', 20)}</summary>`;

// A quiet value after the label ("Prelim · Only me"), with an id so the screen can change it in place.
export const foldValueHtml = (text, id) => `<span class="fold-value muted"${id ? ` id="${esc(id)}"` : ''}>${esc(text)}</span>`;
