// Pure request/reply boundary for a read-only room review. No ballot writers or storage.
import { buildAIRequest, parseAIResponse, extractJson } from '../../core/ai.js';
import { resolvePreferences, cleanPreferenceText as roomPriorities } from '../../core/ai-preferences.js';
import { scrubMap, scrub, leaks, speakerTag, restore } from './cleanup.js';
import { ranksShown, rubricOf } from './profile-layer.js';
import { isOverGrace } from './board.js';
import { overtimeEffect } from './rank.js';
import { ROOM_SCHEMA, ROOM_SYSTEM } from '../prompts/room-comparison.v1.js';

export const ROOM_FEATURE = 'analysis';
export { roomPriorities };
// Prefer original notes. An AI rewrite must never become fresh performance evidence.
export const comparisonNotes = (entry) => String(entry.notes || '').trim() || (entry.commentSource === 'judgeEditedAi' || entry.commentHadAi === true ? '' : String(entry.comment || '').trim());
export const roomEntries = (room) => (room?.entries || []).filter((e) => e.status !== 'noShow').slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
export function comparisonCoverage(room) {
  const entries = roomEntries(room);
  const covered = entries.filter((e) => e.status === 'done' && comparisonNotes(e));
  return { entries, covered, missing: entries.filter((e) => !covered.includes(e)), canOrder: ranksShown(room?.profile) && entries.length >= 2 && entries.every((e) => covered.includes(e)) };
}
// An exact local snapshot, excluding ranks and private notes. Changed evidence invalidates an open review.
export function comparisonStamp(room, event, settings = {}) {
  return JSON.stringify({
    id: room?.id, entries: roomEntries(room).map((e) => ({ id: e.id, notes: comparisonNotes(e), status: e.status, order: e.order, code: e.code, name: e.name, title: e.title, author: e.author, overGrace: isOverGrace(e) })),
    event: { name: event?.name, prompts: event?.prompts }, rubric: rubricOf(room?.profile),
    ranks: ranksShown(room?.profile), overtime: overtimeEffect(room?.profile),
    priorities: roomPriorities(settings.roomJudging?.priorities), style: resolvePreferences(settings.aiPreferences, 'roomComparison').style,
  });
}
export function comparisonMessages(room, event, settings = {}, mode = 'compare') {
  if (!['compare', 'order'].includes(mode)) throw new Error('Choose a room review action.');
  const coverage = comparisonCoverage(room);
  if (coverage.covered.length < 2) throw new Error('Finish at least two speeches and add public notes before you compare the room.');
  if (mode === 'order' && !coverage.canOrder) throw new Error('Finish every speech and add public notes for each speaker before asking for an order.');
  if (coverage.entries.length > 32 || coverage.covered.reduce((n, e) => n + comparisonNotes(e).length, 0) > 24000) throw new Error('This room has too much text for one review. Shorten the public notes before trying again.');
  const swaps = scrubMap(room);
  const sent = coverage.entries.map((e) => ({ id: e.id, speaker: speakerTag(room, e.id), notes: e.status === 'done' ? scrub(comparisonNotes(e), swaps) : '', complete: e.status === 'done', firstPlaceEligible: !(overtimeEffect(room.profile) === 'noFirst' && isOverGrace(e)) }));
  const prefs = resolvePreferences(settings.aiPreferences, 'roomComparison');
  const clean = (text) => scrub(String(text), swaps);
  const payload = {
    mode, orderingAllowed: coverage.canOrder,
    event: clean(event?.name || 'Custom speech event'),
    criteria: [...(event?.prompts || []).filter((x) => typeof x === 'string'), ...rubricOf(room.profile).map((c) => c.label)].map(clean),
    priorities: clean(roomPriorities(settings.roomJudging?.priorities)), style: clean(prefs.style),
    speakers: sent.map(({ speaker, notes, complete, firstPlaceEligible }) => ({ speaker, notes, complete, firstPlaceEligible })),
  };
  // Scrub all dynamic metadata too, including custom criteria and saved priorities.
  const prompt = JSON.stringify(payload);
  if (leaks([payload.event, ...payload.criteria, payload.priorities, payload.style, ...sent.map((e) => e.notes)].join('\n'), swaps).length) throw new Error('A known name or code remains in the room review. Nothing was sent.');
  return { system: ROOM_SYSTEM, schema: ROOM_SCHEMA, prompt, sent, swaps, mode, orderingAllowed: coverage.canOrder };
}
export const comparisonRequest = (provider, msg, options) => buildAIRequest(provider, { ...options, system: msg.system, prompt: msg.prompt, schema: msg.schema, docs: [] });

const invalidReply = () => new Error('The AI review did not include valid note references. Try again. Your ranks are unchanged.');
const validText = (text) => typeof text === 'string' && text.trim() && text.length <= 1600;
export function comparisonFromText(text, msg) {
  const result = extractJson(text);
  if (!result || !Array.isArray(result.comparisons) || !Array.isArray(result.gaps) || !Array.isArray(result.order) || result.comparisons.length > 6 || result.gaps.length > 6) throw invalidReply();
  function point(item, comparative = false) {
    if (!item || !validText(item.text) || !Array.isArray(item.evidence) || !item.evidence.length || item.evidence.length > 8) throw invalidReply();
    const evidence = item.evidence.map((ref) => {
      const source = msg.sent.find((e) => e.speaker === ref?.speaker && e.complete);
      if (!source || typeof ref.quote !== 'string' || ref.quote.trim().length < 4 || ref.quote.length > 1600 || !source.notes.includes(ref.quote)) throw invalidReply();
      return { id: source.id, quote: restore(ref.quote, msg.swaps) };
    });
    if (comparative && new Set(evidence.map((e) => e.id)).size < 2) throw invalidReply();
    return { text: restore(item.text.trim(), msg.swaps), evidence };
  }
  const comparisons = result.comparisons.map((item) => point(item, true));
  const gaps = result.gaps.map((gap) => { if (!validText(gap)) throw invalidReply(); return restore(gap.trim(), msg.swaps); });
  if (result.order.length && (msg.mode !== 'order' || !msg.orderingAllowed)) throw invalidReply();
  let order = [];
  if (result.order.length) {
    if (result.order.length !== msg.sent.length || new Set(result.order.map((e) => e?.speaker)).size !== msg.sent.length) throw invalidReply();
    order = result.order.map((item) => {
      const entry = msg.sent.find((e) => e.speaker === item?.speaker);
      if (!entry) throw invalidReply();
      const reason = point(item);
      if (!reason.evidence.some((e) => e.id === entry.id)) throw invalidReply();
      return { id: entry.id, ...reason };
    });
    if (!msg.sent.find((e) => e.id === order[0].id)?.firstPlaceEligible) throw invalidReply();
  }
  if (!comparisons.length && !gaps.length && !order.length) throw invalidReply();
  return { comparisons, gaps, order };
}
export const readComparisonReply = (provider, json, msg) => comparisonFromText(parseAIResponse(provider, json), msg);
