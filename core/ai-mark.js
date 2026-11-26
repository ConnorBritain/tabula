// The shared AI mark identifies an AI action; it grants no permission and makes no request.
// Speech Events keeps the same white core with a green gradient on its accent edges.
const STAR = 'M8 1C8.7 5.3 10.7 7.3 15 8C10.7 8.7 8.7 10.7 8 15C7.3 10.7 5.3 8.7 1 8C5.3 7.3 7.3 5.3 8 1Z';
const LEFT = 'M1 8C3.15 7.65 4.725 6.975 5.725 5.725L4.8 8Z';
const RIGHT = 'M15 8C12.85 8.35 11.275 9.025 10.275 10.275L11.2 8Z';

export function aiMark(palette = 'debate', key = '') {
  if (!['debate', 'events'].includes(palette)) throw new Error('Unknown AI mark palette');
  if (palette === 'events' && !key) throw new Error('A green AI mark needs a unique key');
  // Encode every character so distinct item ids cannot collide or become SVG markup.
  const id = 'ai-green-' + Array.from(String(key), (c) => c.codePointAt(0).toString(16)).join('-');
  const green = palette === 'events';
  const defs = green ? `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="1" y1="8" x2="15" y2="8"><stop stop-color="var(--ai-green-dark)"/><stop offset="1" stop-color="var(--ai-green-light)"/></linearGradient></defs>` : '';
  const left = green ? `url(#${id})` : 'var(--ai-blue)';
  const right = green ? `url(#${id})` : 'var(--ai-red)';
  return `<svg class="ai-sparkle" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${defs}<path fill="var(--ai-white)" stroke="var(--border-ctl)" stroke-width=".5" stroke-linejoin="round" d="${STAR}"/><path fill="${left}" d="${LEFT}"/><path fill="${right}" d="${RIGHT}"/></svg>`;
}

export function lockMark() {
  return '<svg class="lock" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/></svg>';
}

(globalThis.TabulaCore = globalThis.TabulaCore || {})['ai-mark'] = Object.freeze({ aiMark, lockMark });
