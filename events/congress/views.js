// Speech Events step S6 (docs/events/CONGRESS.md §4.2 to §4.4): the HTML for the session stages (Log, Rank, Review)
// and the round bar. Pure: each builder takes records and returns HTML text, so Node tests can check it.
// session-screen.js draws them and wires the buttons. House design: black, white and gray; no stripes; plain words.
import { escapeHtml as esc } from '../../core/sheets.js';
import { legislatorOf, codeOf, itemOf, houseWord } from './chamber.js';
import { TYPES, TYPE_WORDS, SIDES, SIDE_WORDS, PENALTY_WORDS, legislatorLines, precedenceOrder, timerView, clockText, minSec, needsReason, countedPoints } from './speech.js';
import { hoursDue, openTerm, ordinal, fullHours, poLockLine } from './po.js';
import { rankModel } from './rank.js';
import { reviewBlocks, rankProblems } from './review.js';
import { scaleText, ranksOnly } from './profiles.js';

const STAGE_WORDS = Object.freeze({ log: 'Log', rank: 'Rank', review: 'Review' });
// The PO card's line when the scorer gives the PO no points.
const PO_NOTE = Object.freeze({ parliScores: 'the parliamentarian scores the PO.', none: 'the PO gets no points.' });
const range = (s) => { const out = []; for (let i = s.min; i <= s.max; i++) out.push(i); return out; };

// The session clock: time since the session started ("1:24:10").
export function sessionClock(session, now) {
  const t = Math.floor(Math.max(0, now - session.startedAt) / 1000);
  return Math.floor(t / 3600) + ':' + String(Math.floor((t % 3600) / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

// The round bar: back to the chamber, the house pill, the session, the room, the stepper and the session clock.
export function barHtml(chamber, session, stage, now) {
  const steps = [`<li><a href="#/chamber/${esc(chamber.id)}">Setup</a></li>`]
    .concat(['log', 'rank', 'review'].map((s) => `<li${s === stage ? ' class="on" aria-current="step"' : ''}><a href="#/round/${esc(session.id)}/${s}">${STAGE_WORDS[s]}</a></li>`));
  return `<div class="cg-bar">
    <a class="b quiet" href="#/chamber/${esc(chamber.id)}">‹ Chamber</a>
    <span class="pill solid">${houseWord(chamber)}</span>
    <span class="cg-bar-title">Session ${esc(session.number)}${chamber.roomLabel ? ' · ' + esc(chamber.roomLabel) : ''}${chamber.tournament ? ' · ' + esc(chamber.tournament) : ''}</span>
    <ol class="phase-bar cg-steps" aria-label="Steps">${steps.join('')}</ol>
    <span class="cg-clock" title="Time since the session started"><span class="sr-only">Session time </span><span id="cg-session-clock">${sessionClock(session, now)}</span></span>
  </div>`;
}

// The legislator picker for "Next speech": a search box and one button for each present legislator, in precedence
// order (fewest speeches, then least recent). query filters by code or name.
export function pickerHtml(chamber, session, query) {
  const q = String(query || '').trim().toLowerCase();
  const count = new Map();
  for (const s of session.speeches) count.set(s.legislatorId, (count.get(s.legislatorId) || 0) + 1);
  const list = precedenceOrder(chamber, session).filter((l) => !q || l.code.toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q));
  return `<div class="cg-picker" id="cg-picker">
    <label class="field"><span>Who has the floor?</span><input id="cg-search" type="search" autocomplete="off" spellcheck="false" placeholder="Type a code" value="${esc(query || '')}"></label>
    <div class="cg-pick-list" role="list">${list.map((l) => `<button class="chip cg-pick" type="button" role="listitem" data-cact="pick" data-id="${esc(l.id)}" data-key="pick-${esc(l.id)}"><span class="code">${esc(l.code)}</span>${l.name ? ' <span class="muted">' + esc(l.name) + '</span>' : ''} <span class="muted">· ${count.get(l.id) || 0}</span></button>`).join('') || '<p class="muted">No present legislator matches.</p>'}</div>
    <div class="cg-row"><button class="b quiet" type="button" data-cact="cancel-pick" data-key="cancel-pick">Cancel</button></div>
  </div>`;
}

// The timer face for the live speech (or nothing).
export function timerHtml(session, now, blockMs) {
  const t = timerView(session, now, blockMs);
  if (!t) return '';
  const stageCls = t.leftMs < 0 ? 'stage-over' : t.leftMs <= 30000 ? 'stage-last' : 'stage-speaking';
  const sub = t.phase === 'questions' ? `Question block ${Math.min(t.block, t.blocks)} of ${t.blocks} · ${clockText(t.blockLeftMs)} left in this block` : 'Speech · 3:00';
  return `<div class="timer-card cg-timer ${stageCls}" id="cg-timer">
    <p class="timer-word">${t.phase === 'questions' ? 'Questions' : 'Speaking'}</p>
    <p class="timer-digits" id="cg-digits">${clockText(t.leftMs)}</p>
    <p class="timer-sub" id="cg-timer-sub">${esc(sub)}</p>
    <div class="timer-btns">${t.phase === 'speech'
      ? '<button class="b primary timer-go" type="button" data-cact="questions" data-key="questions">Start questions</button>'
      : ''}<button class="b timer-go" type="button" data-cact="end" data-key="end">End speech</button></div>
  </div>`;
}

const seg = (name, value, opts, words) => `<div class="cg-seg" role="group" aria-label="${esc(name)}">${opts.map((o) => `<button class="chip${o === value ? ' on' : ''}" type="button" aria-pressed="${o === value}" data-cact="set" data-field="${esc(name.toLowerCase())}" data-value="${esc(o)}" data-key="${esc(name.toLowerCase())}-${esc(o)}">${esc(words[o])}</button>`).join('')}</div>`;

// The speech card: the selected speech's item, side, type, timer, points, penalties and comment.
export function speechCardHtml(chamber, session, speechId, now) {
  const sp = session.speeches.find((s) => s.id === speechId);
  if (!sp) return '';
  const p = chamber.profile;
  const noPts = ranksOnly(p);
  const l = legislatorOf(chamber, sp.legislatorId);
  const nth = session.speeches.filter((s) => s.legislatorId === sp.legislatorId).findIndex((s) => s.id === sp.id) + 1;
  const counted = countedPoints(sp, p, nth);
  const capped = p.scoredSpeechCap && nth > p.scoredSpeechCap;
  const items = chamber.docket.map((d) => `<option value="${esc(d.id)}"${d.id === sp.itemId ? ' selected' : ''}>${esc(d.title)}${d.debatedInSession && d.debatedInSession !== session.number ? ' (done in session ' + esc(d.debatedInSession) + ')' : ''}</option>`).join('');
  const live = session.live && session.live.speechId === sp.id;
  const pointsRow = noPts ? '' : range(p.scale).map((n) => `<button class="chip cg-pt${sp.points === n ? ' on' : ''}" type="button" aria-pressed="${sp.points === n}" data-cact="points" data-value="${n}" data-key="pt-${n}">${n}</button>`).join('');
  const note = [];
  if (sp.penalty === 'wrongSide') note.push(p.wrongSideMax != null ? `Wrong side: no more than ${p.wrongSideMax} points. It still counts for precedence.` : `Wrong side: ${p.wrongSideOff} points off (at least). It still counts for precedence.`);
  if (sp.penalty === 'offFloor') note.push('Not on the floor: 0 points. It still counts for precedence.');
  if (capped) note.push(`Only the first ${p.scoredSpeechCap} speeches of each legislator get points under ${p.name}.`);
  return `<section class="stage cg-card" aria-labelledby="cg-card-title">
    <div class="stage-head"><h2 class="stage-code" id="cg-card-title">${esc(l ? l.code : '?')}</h2><span class="muted">${esc(l && l.name ? l.name : '')} · speech ${nth}</span>
      ${!live && sp.speakMs ? `<span class="pill outline">${esc(minSec(sp.speakMs))}</span>` : ''}</div>
    ${live ? timerHtml(session, now, p.questionBlockMs) : ''}
    <div class="cg-fields">
      <label class="field"><span>Item</span><select id="cg-item" data-cfield="itemId" data-key="item">${items || '<option value="">No docket items</option>'}</select></label>
      <div class="field"><span>Side</span>${seg('Side', sp.side, SIDES, SIDE_WORDS)}</div>
      <label class="field"><span>Type</span><select id="cg-type" data-cfield="type" data-key="type">${TYPES.map((t) => `<option value="${t}"${t === sp.type ? ' selected' : ''}>${esc(TYPE_WORDS[t])}</option>`).join('')}</select></label>
    </div>
    ${noPts ? `<p class="field-help">${esc(p.name)} gives no points. Write the comment, then rank at the end.</p>` : `<div class="field"><span>Points <span class="muted">(${esc(scaleText(p.scale))})</span></span>
      <div class="cg-points" role="group" aria-label="Points">${pointsRow}<button class="chip quiet" type="button" data-cact="points" data-value="" data-key="pt-none">Clear</button></div>
      ${counted != null && counted !== sp.points ? `<p class="field-help">Counts as ${esc(counted)}.</p>` : ''}</div>
    <div class="chks" role="group" aria-label="Penalties">${Object.keys(PENALTY_WORDS).map((k) => `<button class="chk${sp.penalty === k ? ' flag' : ''}" type="button" aria-pressed="${sp.penalty === k}" data-cact="penalty" data-value="${k}" data-key="pen-${k}">${sp.penalty === k ? '✓ ' : ''}${esc(PENALTY_WORDS[k])}</button>`).join('')}</div>`}
    ${note.length ? `<p class="field-help">${note.map(esc).join(' ')}</p>` : ''}
    <label class="field cg-comment"><span>Comment</span><textarea id="cg-comment" data-cfield="comment" data-key="comment" rows="5" placeholder="What worked, what to fix. Name a moment.">${esc(sp.comment)}</textarea></label>
    <p class="cg-reason" id="cg-reason" role="status">${needsReason(sp, p) ? esc(`Below ${p.reasonBelow}: write a specific reason. You can still save.`) : ''}</p>
    <div class="stage-foot"><button class="b quiet small" type="button" data-cact="remove" data-key="remove">Remove this speech</button>
      <button class="b small" type="button" data-cact="close" data-key="close">Done</button></div>
  </section>`;
}

// The PO card: the open term, its hours due (each with the PO scale), and the term buttons.
export function poCardHtml(chamber, session, now, choosing) {
  const p = chamber.profile;
  const term = openTerm(session);
  const scale = p.poScale || p.scale;
  const due = [];
  if (scale) session.poTerms.forEach((t, i) => { for (const h of hoursDue(t, now, p)) due.push({ i, t, h }); });
  const dueHtml = due.map(({ i, t, h }) => `<div class="cg-due"><p>Score ${esc(codeOf(chamber, t.legislatorId))}’s ${ordinal(h)} hour as PO <span class="muted">(${esc(scaleText(scale))})</span></p>
      <div class="cg-points" role="group" aria-label="PO points, hour ${h}">${range(scale).map((n) => `<button class="chip cg-pt" type="button" data-cact="po-score" data-term="${i}" data-hour="${h}" data-value="${n}" data-key="po-${i}-${h}-${n}">${n}</button>`).join('')}</div></div>`).join('');
  const scored = session.poTerms.flatMap((t, i) => t.hourScores.map((h) => `<li><span class="code">${esc(codeOf(chamber, t.legislatorId))}</span> hour ${h.hour}: ${esc(h.points)} <button class="b quiet small" type="button" data-cact="po-clear" data-term="${i}" data-hour="${h.hour}" data-key="po-clear-${i}-${h.hour}">Change</button></li>`)
    .concat(t.partHour ? [`<li class="muted"><span class="code">${esc(codeOf(chamber, t.legislatorId))}</span> part hour: no score</li>`] : [])).join('');
  const pick = choosing ? `<div class="cg-pick-list" role="list">${chamber.legislators.filter((l) => l.status === 'present').map((l) => `<button class="chip" type="button" role="listitem" data-cact="po-start" data-id="${esc(l.id)}" data-key="po-start-${esc(l.id)}"><span class="code">${esc(l.code)}</span></button>`).join('')}</div>` : '';
  const head = term
    ? `<p><span class="code">${esc(codeOf(chamber, term.legislatorId))}</span> presides · ${fullHours(term, now)} full ${fullHours(term, now) === 1 ? 'hour' : 'hours'} so far</p>
       <div class="cg-row"><button class="b small" type="button" data-cact="po-end" data-key="po-end">End term</button><button class="b small quiet" type="button" data-cact="po-choose" data-key="po-choose">New PO</button></div>`
    : `<p class="muted">No PO term is open.</p><button class="b small" type="button" data-cact="po-choose" data-key="po-choose">Start a PO term</button>`;
  return `<section class="stage cg-po" aria-labelledby="cg-po-title"><h2 id="cg-po-title" class="cg-h">Presiding officer</h2>
    ${PO_NOTE[p.poRule] ? `<p class="muted">Under ${esc(p.name)} ${PO_NOTE[p.poRule]} Log the term so the speech counts stay right.</p>` : ''}
    ${head}${pick}${dueHtml}${scored ? `<ul class="cg-scored">${scored}</ul>` : ''}</section>`;
}

// The running view: one row for each legislator, a cell for each speech (its counted points), then count, total and
// average. On a phone the cells wrap under the code (blocks); on a wide screen it reads as a grid.
export function gridHtml(chamber, session, selectedId) {
  const noPts = ranksOnly(chamber.profile);
  const rows = legislatorLines(chamber, session).map((line) => {
    const l = line.legislator;
    const cells = line.speeches.map((x) => `<button class="cg-cell${x.speech.id === selectedId ? ' on' : ''}${!noPts && x.speech.points == null && x.speech.penalty !== 'offFloor' ? ' empty' : ''}" type="button" data-cact="select" data-id="${esc(x.speech.id)}" data-key="cell-${esc(x.speech.id)}" aria-label="${esc(l.code)} speech ${x.nth}${noPts ? '' : ': ' + (x.counted == null ? 'no points' : esc(x.counted) + ' points')}">${noPts ? x.nth : x.counted == null ? '–' : esc(x.counted)}</button>`).join('');
    return `<li class="cg-line${l.status !== 'present' ? ' is-out' : ''}"><span class="code">${esc(l.code)}</span>
      <span class="cg-cells">${cells || '<span class="muted">No speeches</span>'}</span>
      <span class="cg-stats">${line.count}${noPts ? '' : ' · ' + line.total + (line.average != null ? ' · avg ' + esc(line.average) : '')}${l.status !== 'present' ? ' · ' + esc(l.status) : ''}</span></li>`;
  }).join('');
  return `<section class="cg-grid-wrap" aria-labelledby="cg-grid-title"><h2 id="cg-grid-title" class="cg-h">Chamber <span class="muted">(${noPts ? 'speeches' : 'speeches · total · average'})</span></h2><ol class="cg-grid">${rows}</ol></section>`;
}

// The docket line above the log: the item under debate and "Next item".
export function docketHtml(chamber, session) {
  const item = itemOf(chamber, session.itemId);
  return `<div class="cg-docket"><span class="muted">Under debate:</span> <strong>${esc(item ? item.title : 'No item')}</strong>
    ${chamber.docket.length ? '<button class="b small" type="button" data-cact="next-item" data-key="next-item">Next item</button>' : ''}</div>`;
}

// The Log stage body. view: { selectedId, picking, query, choosingPO }.
export function logHtml(chamber, session, view, now) {
  const top = view.picking ? pickerHtml(chamber, session, view.query)
    : view.selectedId ? speechCardHtml(chamber, session, view.selectedId, now)
    : `<div class="cg-next"><button class="b primary cg-next-btn" type="button" data-cact="next" data-key="next">Next speech</button></div>`;
  return `${docketHtml(chamber, session)}<div class="cg-log"><div class="cg-main">${top}</div>${poCardHtml(chamber, session, now, view.choosingPO)}</div>${gridHtml(chamber, session, view.selectedId)}`;
}

// The Rank stage body.
export function rankHtml(chamber, session, now) {
  const noPts = ranksOnly(chamber.profile);
  const lock = poLockLine(session, now, chamber.profile, (id) => codeOf(chamber, id));
  const m = rankModel(chamber, session);
  const slots = m.slots.map((id, i) => `<li><button class="cg-slot${id ? ' on' : ''}" type="button" data-cact="unrank" data-id="${esc(id || '')}" data-key="slot-${i + 1}" ${id ? '' : 'disabled'}><span class="row-num">${i + 1}</span> ${id ? `<span class="code">${esc(codeOf(chamber, id))}</span>` : '<span class="muted">Empty</span>'}</button></li>`).join('');
  const ranked = new Set(m.slots.filter(Boolean));
  const pool = m.pool.map((x) => `<li><button class="cg-poolrow${ranked.has(x.legislator.id) ? ' on' : ''}" type="button" data-cact="rank" data-id="${esc(x.legislator.id)}" data-key="pool-${esc(x.legislator.id)}" aria-pressed="${ranked.has(x.legislator.id)}" ${lock ? 'disabled' : ''}>
      <span class="code">${esc(x.legislator.code)}</span><span class="muted">${esc(x.legislator.name || '')}</span>
      <span class="cg-stats">${x.count} ${x.count === 1 ? 'speech' : 'speeches'}${noPts ? '' : ' · ' + x.total + ' points'}${x.poHours.length ? ' · PO ' + x.poHours.join(', ') : ''}</span></button></li>`).join('');
  const warn = m.ties.map(([a, b]) => `<li>${esc(codeOf(chamber, a))} and ${esc(codeOf(chamber, b))} have the same points. That is fine if you meant it.</li>`)
    .concat(m.gone.map((id) => `<li>${esc(codeOf(chamber, id))} is ranked but not present now. Their slot is empty.</li>`)).join('');
  return `<section class="cg-rank" aria-labelledby="cg-rank-title"><h2 id="cg-rank-title" class="cg-h">Top ${m.topN}</h2>
    ${lock ? `<p class="problems" role="status">${esc(lock)} <a class="b small" href="#/round/${esc(session.id)}/log">Back to Log</a></p>` : '<p class="muted">Tap a legislator to fill the next slot. Tap a slot to clear it.' + (noPts ? '' : ' Points do not limit the order.') + '</p>'}
    <ol class="cg-slots">${slots}</ol>
    ${warn ? `<ul class="check-list">${warn.replace(/<li>/g, '<li class="check-row">')}</ul>` : ''}
    <h3 class="cg-h">${chamber.profile.rankPool === 'spokeOrPresided' ? 'Legislators who spoke or presided' : 'Present legislators'}${noPts ? ', by speeches' : ', by points'}</h3>
    <ol class="cg-pool">${pool}</ol>
    <div class="stage-foot"><a class="b primary" href="#/round/${esc(session.id)}/review">Go to Review</a></div></section>`;
}

// The Review stage body.
export function reviewHtml(chamber, session, now) {
  const blocks = reviewBlocks(chamber, session);
  const problems = rankProblems(chamber, session, now);
  const ranks = blocks.find((b) => b.kind === 'ranks');
  const item = (b) => `<li class="card cg-block" data-block="${esc(b.id)}"><div class="card-head"><span>${esc(b.title)}</span></div>
      ${b.text && b.kind === 'speech' ? `<pre class="cg-pre">${esc(b.text)}</pre>` : ''}
      ${b.text ? `<button class="b${b.copied ? '' : ' primary'} small" type="button" data-cact="copy" data-id="${esc(b.id)}" data-key="copy-${esc(b.id)}">${b.copied ? '✓ Copied' : 'Copy'}</button>` : ''}</li>`;
  const speeches = blocks.filter((b) => b.kind === 'speech');
  const po = blocks.filter((b) => b.kind === 'po');
  return `<section class="review-stage" aria-labelledby="cg-rv1"><h2 id="cg-rv1">1. Speeches <span class="muted">(${speeches.length})</span></h2>
      <p class="muted">Tabroom asks for the speeches first. Copy each one into its row.</p>
      <ol class="cards">${speeches.map(item).join('') || '<li class="muted">No speeches yet.</li>'}</ol></section>
    ${po.length ? `<section class="review-stage" aria-labelledby="cg-rv2"><h2 id="cg-rv2">2. PO hours</h2><ol class="cards">${po.map(item).join('')}</ol></section>` : ''}
    <section class="review-stage" aria-labelledby="cg-rv3"><h2 id="cg-rv3">${po.length ? 3 : 2}. Ranks</h2>
      ${problems.length ? `<div class="problems"><h3>Fix these before you copy the ranks</h3><ul>${problems.map((x) => `<li>${esc(x)}</li>`).join('')}</ul><a class="b" href="#/round/${esc(session.id)}/rank">Back to Rank</a></div>`
        : `<pre class="cg-pre">${esc(ranks.text)}</pre><button class="b${session.copiedAt ? '' : ' primary'}" type="button" data-cact="copy" data-id="ranks" data-key="copy-ranks">${session.copiedAt ? '✓ Ranks copied. Copy again' : 'Copy ranks'}</button>`}
      <div class="stage-foot"><button class="b${session.submittedAt ? '' : ' primary'}" type="button" data-cact="submitted" data-key="submitted" aria-pressed="${Boolean(session.submittedAt)}">${session.submittedAt ? '✓ Submitted in Tabroom' : 'I submitted in Tabroom'}</button></div></section>`;
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).congressViews = Object.freeze({ sessionClock, barHtml, pickerHtml, timerHtml, speechCardHtml, poCardHtml, gridHtml, docketHtml, logHtml, rankHtml, reviewHtml });
