// Speech Events icons (design build 2026-11-24; docs/design/EVENTS-COLOR-ICON-REVIEW.md §5.3, top 10 #10). One inline
// sprite of Lucide outline icons: app.js adds it to the page at boot (mountSprite), and each icon points to a symbol by
// name. A static import, so the service worker crawl caches this file and the icons work offline (no font, no CDN, no
// fetch). Icons are drawn in currentColor with a 1.5 px stroke and never carry a color of their own.
// Rules: an icon always sits next to a word (icon() is aria-hidden). Only the six controls in ICON_ONLY may show the
// icon alone, through iconButton(), which needs an aria-label.
// The shapes are Lucide's (https://lucide.dev), ISC License: Copyright (c) for portions of Lucide are held by Cole
// Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
// Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby
// granted, provided that the above copyright notice and this permission notice appear in all copies.
import { escapeHtml as esc } from '../../core/sheets.js';

const c10 = '<circle cx="12" cy="12" r="10"/>';
// name -> the inside of a 24 x 24 symbol.
export const ICONS = Object.freeze({
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  circle: c10,
  'circle-check': c10 + '<path d="m9 12 2 2 4-4"/>',
  'circle-dashed': '<path d="M10.1 2.18a10 10 0 0 1 3.8 0"/><path d="M13.9 21.82a10 10 0 0 1-3.8 0"/><path d="M17.61 3.72a10 10 0 0 1 2.69 2.7"/><path d="M2.18 13.9a10 10 0 0 1 0-3.8"/><path d="M20.28 17.61a10 10 0 0 1-2.7 2.69"/><path d="M21.82 10.1a10 10 0 0 1 0 3.8"/><path d="M3.72 6.39a10 10 0 0 1 2.7-2.69"/><path d="M6.39 20.28a10 10 0 0 1-2.69-2.7"/>',
  'circle-play': c10 + '<path d="M10 8l6 4-6 4z"/>',
  'cloud-off': '<path d="m2 2 20 20"/><path d="M5.78 5.78A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.31-.19"/><path d="M21.53 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7 7 0 0 0 10 5.07"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  'grip-vertical': '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  info: c10 + '<path d="M12 16v-4"/><path d="M12 8h.01"/>',
  'list-ordered': '<path d="M10 12h11"/><path d="M10 18h11"/><path d="M10 6h11"/><path d="M4 10h2"/><path d="M4 6h1v4"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  minus: '<path d="M5 12h14"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  pencil: '<path d="M21.17 6.81a1 1 0 0 0-3.98-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  play: '<path d="M6 3l14 9-14 9z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  'thumbs-up': '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z"/>',
  'triangle-alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
});

// The six controls that may show an icon with no word (§5.3), each with an aria-label: back (phone only), more, close,
// drag handle, rank up, rank down. "x" (close) is kept for the allowlist; no screen draws a close button yet.
export const ICON_ONLY = Object.freeze(['chevron-left', 'ellipsis', 'x', 'grip-vertical', 'chevron-up', 'chevron-down']);

// One icon as HTML text: hidden from screen readers (the word next to it says what it means). size: 14 (pills),
// 16 (inline, the default) or 20 (header, primary buttons, chevrons). An unknown name draws nothing (the icon test
// finds every name the code uses, so this never ships).
export function icon(name, size) {
  if (!Object.prototype.hasOwnProperty.call(ICONS, name)) return '';
  const s = size === 14 || size === 20 ? size : 16;
  return `<svg class="i i-${s}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
}

// An icon-only button (one of ICON_ONLY): the label is its accessible name. cls: its class; attrs: the rest of its
// attributes as HTML text (data-*, aria-expanded, disabled). A name off the list draws a button with the label as
// text, so a slip shows a word, never a mystery icon. The screens' "⋯" menus and the rank moves use it.
export function iconButton(name, label, cls, attrs) {
  const body = ICON_ONLY.includes(name) ? icon(name, 20) : esc(label);
  return `<button class="${esc(cls)}" type="button"${attrs ? ' ' + attrs : ''} aria-label="${esc(label)}">${body}</button>`;
}

// The sprite as HTML text: one hidden SVG with a symbol per icon.
export function spriteHtml() {
  const symbols = Object.entries(ICONS).map(([n, body]) => `<symbol id="i-${n}" viewBox="0 0 24 24">${body}</symbol>`).join('');
  return `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" class="icon-sprite">${symbols}</svg>`;
}

// Add the sprite to the page once (app.js at boot).
export function mountSprite(doc) {
  if (doc.getElementById('icon-sprite')) return;
  doc.body.insertAdjacentHTML('afterbegin', spriteHtml());
}
