// Speech Events design build (docs/design/EVENTS-DESIGN-REVIEW.md §2.5–§2.7, top 10 #8): the speaker's question
// (extemp, F2: entry.question, question.js) or topic (impromptu, F3, and Pro Con Challenge, F4: entry.topic, runs.js)
// at the top of the card, under the speaker code and above the timer. Empty, it is a one-line field with a short
// placeholder. Filled, it shows as a quote line with an Edit button, and the roster row shows its first words.
// It plugs into createRoomScreen as a view (room-screen.js names the hooks). Every keystroke saves; the field keeps
// its id ("question" or "topic") so a redraw keeps its cursor (room-screen.js keeps the focus by id).
// The builders at the top are pure (Node tests call them); createQuoteView does the DOM.
import { escapeHtml as esc } from '../../core/sheets.js';
import { asksQuestion, questionOf, setQuestion, shortText, QUESTION_MAX } from './question.js';
import { hasRuns, topicOf, setTopic, TOPIC_MAX } from './runs.js';
import { updateEntry, roomEvent } from './room.js';

// The roster shows this many characters of the line at most.
export const ROW_QUOTE_MAX = 48;

// What this event asks the judge to note, or null: { field, label, placeholder, max }.
export function quoteKind(event) {
  if (asksQuestion(event)) return { field: 'question', label: 'Question drawn', placeholder: 'The question the speaker drew', max: QUESTION_MAX };
  if (hasRuns(event)) return { field: 'topic', label: (event.topic && event.topic.label) || 'Topic', placeholder: "The student's topic", max: TOPIC_MAX };
  if (event && event.timing && event.timing.inRoomPrep) return { field: 'topic', label: 'Topic', placeholder: 'The topic the speaker picked', max: TOPIC_MAX };
  return null;
}

// The value of the field for an entry, one line.
export const quoteOf = (entry, kind) => (kind.field === 'question' ? questionOf(entry) : topicOf(entry).replace(/\s+/g, ' '));

// The part at the top of the card ('' for an event with no question or topic, or a no show). editing: the judge
// tapped Edit (the field shows even when it has a value).
export function quoteHtml(entry, event, editing) {
  const k = quoteKind(event);
  if (!k || !entry || entry.status === 'noShow') return '';
  const text = quoteOf(entry, k);
  if (text && !editing) {
    return `<div class="quote" id="quote"><p class="quote-line"><span class="sr-only">${esc(k.label)}: </span>“${esc(text)}”</p>
      <button class="b quiet small" type="button" data-qact="edit" data-key="quote-edit" aria-label="Edit the ${esc(k.label.toLowerCase())}">Edit</button></div>`;
  }
  const raw = k.field === 'question' ? entry.question || '' : entry.topic || '';
  return `<div class="quote" id="quote"><label class="field quote-field" for="${k.field}"><span>${esc(k.label)}</span>
      <input id="${k.field}" data-qfield="${k.field}" maxlength="${k.max}" autocomplete="off" placeholder="${esc(k.placeholder)}" value="${esc(raw)}"></label></div>`;
}

// The roster row's quote line: the first words ('' with none).
export function rowQuoteHtml(entry, event) {
  const k = quoteKind(event);
  const text = k && entry ? quoteOf(entry, k) : '';
  return text ? `<span class="row-quote" title="${esc(text)}">“${esc(shortText(text, ROW_QUOTE_MAX))}”</span>` : '';
}

export function createQuoteView() {
  let ctx = null;
  let editing = null; // the entry id whose field is open for an edit
  const env = () => ctx.env;
  const event = (r) => roomEvent(env().data.events, r);
  const $ = (s) => env().el.querySelector(s);

  function onInput(ev) {
    const f = ev.target.dataset && ev.target.dataset.qfield;
    const r = ctx.room();
    if (!f || !r || !r.current) return;
    const now = env().now();
    ctx.save(f === 'question' ? setQuestion(r, ev.target.value, now) : updateEntry(r, r.current, (e) => setTopic(e, ev.target.value), now));
    ctx.drawRoster(); // the row's first words follow the field (the roster keeps its own focus)
  }
  // Enter closes the field into the quote line, and the focus goes to its Edit button.
  function onKey(ev) {
    if (ev.key !== 'Enter' || !(ev.target.dataset && ev.target.dataset.qfield)) return;
    ev.preventDefault();
    editing = null;
    ctx.drawStage();
    const b = $('[data-qact="edit"]'); if (b) b.focus();
  }
  function onClick(ev) {
    const b = ev.target.closest('[data-qact="edit"]');
    const r = ctx.room();
    if (!b || !r) return;
    editing = r.current;
    ctx.drawStage();
    const k = quoteKind(event(r));
    const input = k && document.getElementById(k.field);
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
  }

  return {
    rowSub: (r, e) => rowQuoteHtml(e, event(r)),
    stageHtml: (r, e) => { if (editing && editing !== e.id) editing = null; return quoteHtml(e, event(r), editing === e.id); },
    mounted() { const box = $('#quote'); if (box) { box.addEventListener('input', onInput); box.addEventListener('keydown', onKey); box.addEventListener('click', onClick); } },
    show(c) { ctx = c; editing = null; },
  };
}

