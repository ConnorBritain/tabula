// Speech Events judge card (events/kit/index.html): draws the QR code on this device, shows what the coach types on
// the card, switches between one card and two cards to cut apart, and prints. No network call, and nothing is saved:
// the typed text lives only in the open page. The QR code always holds APP_URL and nothing else.
// The builders at the top are pure (events/kit/kit.test.mjs calls them); start() does the DOM.
import { encodeQr, qrSvg } from './qr.js';

/** The link in the QR code. A constant: no typed text, no query string, nothing about the device. */
export const APP_URL = 'https://events.tabulaspeech.com/';
export const MAX_LEN = 80;
/** The not-affiliated line on the card. One constant, so a wording change is one edit. */
export const AFFILIATION_LINE = 'Tabula is not affiliated with the NSDA.';

/** The card line for a typed value: trimmed, one line, at most MAX_LEN characters; '' hides the line. */
export const cardLine = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);

/** The QR code for the app link as SVG text. */
export const appQrSvg = () => qrSvg(encodeQr(APP_URL, { level: 'M' }), 'QR code for ' + APP_URL);

export function start(doc) {
  const $ = (s) => doc.querySelector(s);
  const sheet = $('#kit-sheet');
  const first = $('#kit-card');
  const svg = appQrSvg();
  const cards = () => [...sheet.querySelectorAll('.kit-card')];

  // Fill one card's QR code and typed lines. textContent only: typed text is never read as HTML.
  function fill(card) {
    const qr = card.querySelector('[data-kit="qr"]');
    if (qr && !qr.firstChild) qr.innerHTML = svg;
    const name = cardLine($('#kit-name').value);
    const help = cardLine($('#kit-help').value);
    const nameEl = card.querySelector('[data-kit="name"]');
    nameEl.textContent = name;
    nameEl.hidden = !name;
    card.querySelector('[data-kit="help"]').textContent = help;
    card.querySelector('[data-kit="help-line"]').hidden = !help;
    card.querySelector('[data-kit="affiliation"]').textContent = AFFILIATION_LINE;
  }

  // Two cards: a copy of the first. Screen readers read the first card only, so the copy is hidden from them.
  function layout(two) {
    sheet.classList.toggle('two-up', two);
    const all = cards();
    if (two && all.length === 1) {
      const copy = first.cloneNode(true);
      copy.removeAttribute('id');
      copy.setAttribute('aria-hidden', 'true');
      sheet.appendChild(copy);
    }
    if (!two) all.slice(1).forEach((c) => c.remove());
    cards().forEach(fill);
  }

  cards().forEach(fill);
  doc.addEventListener('input', (e) => { if (e.target.id === 'kit-name' || e.target.id === 'kit-help') cards().forEach(fill); });
  doc.addEventListener('change', (e) => { if (e.target.name === 'kit-layout') layout(e.target.value === 'two'); });
  $('#kit-print').addEventListener('click', () => doc.defaultView.print());
  // A page restored from the browser's back cache keeps the radio choice; match it.
  const picked = $('input[name="kit-layout"]:checked');
  layout(Boolean(picked && picked.value === 'two'));
}

if (typeof document === 'object' && document && document.getElementById('kit-sheet')) start(document);
