// Speech Events step S4 (docs/events/EXPERIENCE.md §2.6, §3, §3.2): the round's level and panel note, and the Judge
// frame line that shows them. Pure: no DOM, no storage, no clock.
//
// Round.level: 'prelim' | 'elim' (the read-time migration gives an old round 'prelim', migrate.js).
// Round.panel: { size: 3 | 5, note } when more judges sit in the room. The app does not run panels (§3.2, §11.2 risk
// 2): the panel is a note for the judge only. With one judge there is no panel field at all.
//
// Overtime is always a flag (§3). Under a panel the app reminds the judge: PANEL_OVERTIME_NOTE.
import { escapeHtml as esc } from '../../core/sheets.js';

const LEVELS = Object.freeze([{ id: 'prelim', label: 'Prelim' }, { id: 'elim', label: 'Elim' }]);
export const PANEL_SIZES = Object.freeze([1, 3, 5]);
const PANEL_NOTE_MAX = 120;
export const PANEL_OVERTIME_NOTE = 'Panel: agree on overtime before you flag.';

export const levelOf = (room) => (room && room.level === 'elim' ? 'elim' : 'prelim');

// The panel of a round, cleaned ({ size, note }), or null for one judge or a damaged value.
export function panelOf(room) {
  const p = room && room.panel;
  return p && typeof p === 'object' && typeof p.size === 'number' ? makePanel(p.size, p.note) : null;
}

// The panel to store from the setup form: null for one judge. size: the picked number (text or number).
export function makePanel(size, note) {
  const n = Number(size);
  if (!PANEL_SIZES.includes(n) || n === 1) return null;
  return { size: n, note: String(note || '').trim().slice(0, PANEL_NOTE_MAX) };
}

// The frame line under the room title: "Elim · Panel of 3 · <note>". A prelim with one judge shows nothing, so the
// common round looks as it did before S4.
export function frameLine(room) {
  const p = panelOf(room);
  const parts = [];
  if (levelOf(room) === 'elim') parts.push('Elim');
  if (p) parts.push('Panel of ' + p.size, ...(p.note ? [p.note] : []));
  return parts.join(' · ');
}

// The overtime reminder for a round: the panel note under a panel, else ''.
export const overtimeNote = (room) => (panelOf(room) ? PANEL_OVERTIME_NOTE : '');

// The frame as HTML text ('' when there is nothing to show).
export function frameHtml(room) {
  const line = frameLine(room);
  const ot = overtimeNote(room);
  if (!line) return '';
  return `<p class="round-frame" id="round-frame"><span>${esc(line)}</span>${ot ? ` <span class="muted">${esc(ot)}</span>` : ''}</p>`;
}

// The level and panel fields of the setup form, as HTML text. picked: { level, panelSize } to start with.
export function levelFieldsHtml(picked) {
  const p = picked || {};
  const lv = p.level === 'elim' ? 'elim' : 'prelim';
  return `<label class="field"><span>Level</span><select id="setup-level">${LEVELS.map((l) => `<option value="${l.id}"${l.id === lv ? ' selected' : ''}>${l.label}</option>`).join('')}</select></label>
      <label class="field"><span>Judges in the room</span><select id="setup-panel">${PANEL_SIZES.map((n) => `<option value="${n}"${n === (p.panelSize || 1) ? ' selected' : ''}>${n === 1 ? 'Only me' : 'Panel of ' + n}</option>`).join('')}</select></label>
      <label class="field wide" id="setup-panel-note-box" hidden><span>Panel note <span class="muted">(optional, for you only)</span></span><input id="setup-panel-note" autocomplete="off" maxlength="${PANEL_NOTE_MAX}" placeholder="For example: judges in seats 1 to 3"></label>`;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).roundFrame = Object.freeze({
  PANEL_SIZES, PANEL_OVERTIME_NOTE, levelOf, panelOf, makePanel, frameLine, overtimeNote, frameHtml, levelFieldsHtml,
});
