// Speech Events step S4 (docs/events/EXPERIENCE.md §2.6, §3, §3.2): the round's level and panel note, and the Judge
// frame line that shows them. Pure: no DOM, no storage, no clock.
//
// Round.level: 'prelim' | 'elim' (the read-time migration gives an old round 'prelim', migrate.js).
// Round.panel: { size: 3 | 5, note } when more judges sit in the room. The app does not run panels (§3.2, §11.2 risk
// 2): the panel is a note for the judge only. With one judge there is no panel field at all.
//
// Overtime is always a flag (§3). Under a panel the app reminds the judge: PANEL_OVERTIME_NOTE.
import { escapeHtml as esc } from '../../core/sheets.js';
import { statusPillHtml } from './status-pill.js';

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

// The panel sentence under the frame pills (design review §2.5 change 2: one plain sentence, no repeated number).
export const PANEL_FRAME_LINE = 'Agree on overtime with the panel before you flag.';

// The frame as HTML text ('' when there is nothing to show): the facts as a row of pills ("Elim", "Panel of 3", the
// panel note), then the panel sentence. The words are the same as frameLine; only the look changed.
export function frameHtml(room) {
  const p = panelOf(room);
  const facts = [...(levelOf(room) === 'elim' ? ['Elim'] : []), ...(p ? ['Panel of ' + p.size] : [])];
  if (!facts.length) return '';
  const note = p && p.note ? `<span class="muted round-frame-note">${esc(p.note)}</span>` : '';
  return `<div class="round-frame" id="round-frame"><p class="round-frame-pills">${facts.map((f) => statusPillHtml('outline', f)).join(' ')}${note ? ' ' + note : ''}</p>`
    + `${overtimeNote(room) ? `<p class="muted round-frame-line">${esc(PANEL_FRAME_LINE)}</p>` : ''}</div>`;
}

// The level and panel fields of the setup form, as HTML text. picked: { level, panelSize } to start with.
export function levelFieldsHtml(picked) {
  const p = picked || {};
  const lv = p.level === 'elim' ? 'elim' : 'prelim';
  return `<label class="field"><span id="setup-level-label">Round stage</span><select id="setup-level" aria-labelledby="setup-level-label" aria-describedby="setup-level-help">${LEVELS.map((l) => `<option value="${l.id}"${l.id === lv ? ' selected' : ''}>${l.label}</option>`).join('')}</select><span class="field-help" id="setup-level-help">Prelim is an early round. Elim is an elimination round, such as a semifinal or final.</span></label>
      <label class="field"><span id="setup-panel-label">Judges in the room</span><select id="setup-panel" aria-labelledby="setup-panel-label" aria-describedby="setup-panel-help">${PANEL_SIZES.map((n) => `<option value="${n}"${n === (p.panelSize || 1) ? ' selected' : ''}>${n === 1 ? 'Only me' : 'Panel of ' + n}</option>`).join('')}</select><span class="field-help" id="setup-panel-help">A panel is a group of judges for the same room. Count yourself. Each judge keeps their own ballot.</span></label>
      <label class="field wide" id="setup-panel-note-box" hidden><span>Panel note ${statusPillHtml('outline', 'Not on ballot')}</span><input id="setup-panel-note" autocomplete="off" maxlength="${PANEL_NOTE_MAX}" placeholder="Seats 1–3"></label>`;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).roundFrame = Object.freeze({
  PANEL_SIZES, PANEL_OVERTIME_NOTE, PANEL_FRAME_LINE, levelOf, panelOf, makePanel, frameLine, overtimeNote, frameHtml, levelFieldsHtml,
});
