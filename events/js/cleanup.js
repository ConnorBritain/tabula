// "Clean up my comments" for Tabula Speech Events (docs/events/LANDING.md §4.1 step E13; PLAN.md v1 item 9, risks R6
// and R7, Q7; ARCHITECTURE.md §6.4 and §7). The pure half: when the button shows, the scrub of codes and names before
// any text leaves the device, the request and reply, and the review the judge must accept. No DOM, no fetch: the
// Review screen calls these and does the network call itself.
//
// Flow: cleanupPath(...) says if the button shows -> cleanupMessages(room, event, ids) scrubs and builds the prompt ->
// the app sends it (cleanupRequest for OpenAI, Google, xAI, OpenRouter; the app's own SDK call for Anthropic) ->
// readCleanupReply / draftsFromText put codes and names back -> cleanupReview(entries, drafts) makes one card per
// performer -> the judge flips a card to 'insert' (setChoice) -> applyCleanup writes only those cards.
//
// The policy gate is a head file (core/policy.js), so it is read from globalThis.TabulaCore.policy at call time.

import { reviewCard, staleCards, applyReview } from '../../core/review.js';
import { buildAIRequest, parseAIResponse, extractJson } from '../../core/ai.js';
import { CLEANUP_PROMPT, CLEANUP_SCHEMA } from '../prompts/cleanup.v1.js';
import { ballotComment } from './comments.js';

// The AI policy key for this button (ARCHITECTURE.md §7: `ballotDraft`, reused; AI-POLICY.md §2a), and the hosted
// task name the Worker meters (PLAN.md P2; used by E14). A task name is not a feature key: the gate only knows keys.
export const FEATURE = 'ballotDraft';
export const TASK = CLEANUP_PROMPT.task;

function policy() {
  const p = globalThis.TabulaCore && globalThis.TabulaCore.policy;
  if (!p) throw new Error('cleanup needs core/policy.js loaded first');
  return p;
}

// ---------- when the button shows ----------

// Level: 'middle' for a middle school room, anything else is high school. v1 event files have no level field
// (PLAN.md Q11: v1 is high school only), so this reads a later event field or the room's rules profile.
export function levelOf(room, event) {
  return (event && event.level) || (room && room.profile && room.profile.level) || 'high';
}

// Hosted clean-up is off by default for middle school events (PLAN.md R6, Q7: some students are under 13). The judge
// may turn it on for that room on purpose (hostedOptIn). The own-key path is not covered by this rule.
export function hostedAllowed({ level, hostedOptIn } = {}) {
  return level === 'middle' ? hostedOptIn === true : true;
}

// Which path the Review screen offers. 'none' means the button is gone: not greyed, no hole (ARCHITECTURE.md §7 rule 4,
// AI-POLICY.md §0). o: { gate (from policy.gateFor), hasKey (an own key or helper is connected), hosted (true when the
// app knows this person has a hosted plan or a school that pays; E14 sets it), level, hostedOptIn }.
//   'hosted'  : the Worker path (E14), allowed by plan and by the middle school rule.
//   'own'     : the judge's own key.
//   'connect' : AI is allowed but nothing is connected; the button opens the Connect AI invite.
//   'none'    : remove the button.
export function cleanupPath(o) {
  const P = policy();
  const s = o || {};
  const gate = s.gate;
  if (!gate || !P.canUse(gate, FEATURE)) return 'none';
  // One input from the caller decides "hosted plan" (E14 owns how it is found), so this rule cannot drift from the cloud.
  const hostedPlan = s.hosted === true;
  if (hostedPlan && hostedAllowed(s)) return 'hosted';
  if (s.hasKey && P.setupAllowed(gate)) return 'own';
  if (P.showSetupFor(gate, Boolean(s.hasKey) || hostedPlan)) return 'connect';
  return 'none';
}
export const showCleanupButton = (o) => cleanupPath(o) !== 'none';

// ---------- what text is cleaned ----------

// The judge's own words for one entry: the comment if there is one, else the notes. Rule-check flags and their notes
// are never sent (LANDING.md E6: a flag never reaches the student comment unless the judge writes it). Since E6 this
// is the one ballot-text rule in comments.js (same behavior as the first version here), under this file's name.
export const sourceText = ballotComment;
// The entries a clean-up may send: chosen ids (or all), not a no-show, with some text.
export function cleanableEntries(room, ids) {
  const want = ids ? new Set([].concat(ids)) : null;
  return ((room && room.entries) || []).filter((e) => (!want || want.has(e.id)) && e.status !== 'noShow' && sourceText(e).trim());
}

// ---------- scrub and restore (R6, Q7) ----------

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// A whole word or code only: no letter or digit just before or after.
const wordRe = (s, flags) => new RegExp('(^|[^\\p{L}\\p{N}])' + reEsc(s) + '(?=$|[^\\p{L}\\p{N}])', flags);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
// The parts of a typed name ("Ana Diaz & Ben Li" -> Ana, Diaz, Ben, Li), so a first name alone is scrubbed too.
const nameParts = (n) => String(n).split(/[\s,&/+]+|\band\b/i).map((x) => x.trim()).filter((x) => x.length >= 2);

// The swap list for a room: every entry's code, name (whole and each part), title and author, with its neutral tag.
// Numbers follow speaking order over all entries, so they are the same for every call in the room. Longest first, so
// a full name is swapped before its parts. Each swap: { tag, value, id }.
export function scrubMap(room) {
  const out = [];
  const seen = new Set();
  const add = (tag, value, id) => {
    const v = String(value || '').trim();
    if (!v || seen.has(v.toLowerCase())) return;
    seen.add(v.toLowerCase());
    out.push({ tag, value: v, id });
  };
  const entries = ((room && room.entries) || []).slice().sort(byOrder);
  entries.forEach((e, i) => {
    const n = i + 1;
    add('[Speaker ' + n + ']', e.code, e.id);
    add('[Name ' + n + ']', e.name, e.id);
    nameParts(e.name || '').forEach((p, k) => add('[Name ' + n + '.' + (k + 1) + ']', p, e.id));
    add('[Title ' + n + ']', e.title, e.id);
    add('[Author ' + n + ']', e.author, e.id);
    nameParts(e.author || '').forEach((p, k) => add('[Author ' + n + '.' + (k + 1) + ']', p, e.id));
  });
  return out.sort((a, b) => b.value.length - a.value.length);
}
// The speaker tag for an entry id: its place in speaking order. Every entry has one, even with no code or a code it
// shares with another entry, so no comment is dropped from a clean-up.
export function speakerTag(room, id) {
  const i = ((room && room.entries) || []).slice().sort(byOrder).findIndex((e) => e.id === id);
  return i < 0 ? null : '[Speaker ' + (i + 1) + ']';
}

// Swaps every code and name for its tag. Case does not matter ("a12", "maria" are caught). Each swap first puts in a
// private-use mark (not a letter or digit), so a short value such as code "1" can never match inside a tag already put
// in ("[Speaker 1]"); the marks become tags at the end.
const mark = (i) => String.fromCharCode(0xe000) + String.fromCharCode(0xe100 + i) + String.fromCharCode(0xe001);
export function scrub(text, swaps) {
  const t = swaps.reduce((u, s, i) => u.replace(wordRe(s.value, 'giu'), (m, pre) => pre + mark(i)), String(text == null ? '' : text));
  return swaps.reduce((u, s, i) => u.split(mark(i)).join(s.tag), t);
}
// The tags themselves, so a leak check does not count the digit in "[Speaker 1]" as code "1".
const TAG_RE = /\[(?:Speaker|Name|Title|Author) \d+(?:\.\d+)?\]/g;
// Puts the typed values back. Also takes a tag the AI wrote without its brackets ("Speaker 1"). The value goes in as
// typed in setup (a replacer function, so a "$" in a name is kept).
export function restore(text, swaps) {
  let t = String(text == null ? '' : text);
  const tags = swaps.slice().sort((a, b) => b.tag.length - a.tag.length);
  for (const s of tags) t = t.split(s.tag).join(s.value);
  for (const s of tags) {
    const bare = s.tag.slice(1, -1);
    t = t.replace(new RegExp('(^|[^\\p{L}\\p{N}.])' + reEsc(bare) + '(?=$|[^\\p{L}\\p{N}]|\\.(?!\\d))', 'gu'), (m, pre) => pre + s.value);
  }
  return t;
}
// Any typed value still in a text that is about to leave the device. Empty after scrub(); the app checks it before a
// send, as a last guard.
export function leaks(text, swaps) {
  const t = String(text || '').replace(TAG_RE, ' ');
  return swaps.filter((s) => wordRe(s.value, 'iu').test(t)).map((s) => s.value);
}

// ---------- request and reply ----------

// The scrubbed prompt for some entries of a room. Returns { system, prompt, schema, swaps, sent } where sent lists
// { id, speaker } in order. No code, name, title or author is in system or prompt. Throws if one is (a bug guard).
export function cleanupMessages(room, event, ids) {
  const swaps = scrubMap(room);
  const list = cleanableEntries(room, ids);
  const sent = list.map((e) => ({ id: e.id, speaker: speakerTag(room, e.id) }));
  const blocks = sent.map((x) => {
    const e = list.find((y) => y.id === x.id);
    return x.speaker + '\n' + scrub(sourceText(e), swaps).trim();
  });
  const eventName = scrub((event && event.name) || 'Speech', swaps);
  // The guard looks at the judge's text and the event name only: the fixed prompt words are ours, not personal.
  if (leaks(eventName + '\n' + blocks.join('\n'), swaps).length) throw new Error('a code or name was left in the clean-up text');
  const prompt = CLEANUP_PROMPT.intro.replace('{event}', () => eventName) + '\n\n' + blocks.join('\n\n');
  const system = CLEANUP_PROMPT.system;
  return { system, prompt, schema: CLEANUP_SCHEMA, swaps, sent };
}

// The fetch request for the judge's own key (OpenAI, Google, xAI, OpenRouter). Anthropic goes through the app's SDK
// call with msg.system, msg.prompt and msg.schema. o: { key, model, maxTokens }.
export function cleanupRequest(provider, msg, o) {
  return buildAIRequest(provider, { key: o.key, model: o.model, maxTokens: o.maxTokens, system: msg.system, prompt: msg.prompt, schema: msg.schema, docs: [] });
}

// The drafts from the reply text: { [entryId]: text }, with codes and names put back. Only entries that were sent get
// a draft; a speaker the reply invents is dropped. A missing speaker has no draft (its card has nothing to insert).
export function draftsFromText(text, msg) {
  const j = extractJson(text);
  const items = Array.isArray(j && j.comments) ? j.comments : [];
  const out = {};
  for (const x of msg.sent) {
    const hit = items.find((it) => it && typeof it.speaker === 'string' && normTag(it.speaker) === normTag(x.speaker));
    if (hit && typeof hit.text === 'string') out[x.id] = restore(hit.text, msg.swaps).trim();
  }
  return out;
}
const normTag = (t) => String(t).replace(/[[\]]/g, '').trim().toLowerCase();
// The same, from a provider's JSON reply (core/ai.js reads the text and says when it was cut off or refused).
export function readCleanupReply(provider, json, msg) {
  return draftsFromText(parseAIResponse(provider, json), msg);
}

// ---------- review (core/review.js) ----------

// One "comment" group per performer. Entry ids must not hold a dot (review fields are 'group.key', one level).
const fieldOf = (id) => {
  if (String(id).includes('.')) throw new Error('entry id has a dot: ' + id);
  return 'comment.' + id;
};
export const cleanupGroups = (entries) => entries.map((e) => ({ id: e.id, label: 'Comments for ' + (e.code || e.id), fields: [fieldOf(e.id)] }));
const isText = () => true;

// The review record: each entry's own words, all marked "yours" (the judge typed them). So every card starts on
// "Keep mine" with a word diff, and nothing goes in until the judge chooses "insert" on that card.
export function cleanupRecord(entries) {
  const r = { comment: {}, touched: {}, aiFilled: {} };
  for (const e of entries) { r.comment[e.id] = sourceText(e); r.touched[fieldOf(e.id)] = true; }
  return r;
}

// The review for the entries that were sent: { cards }, one card per performer.
export function cleanupReview(entries, drafts) {
  const record = cleanupRecord(entries);
  const d = drafts || {};
  const cards = cleanupGroups(entries).map((g) => reviewCard(record, g, { draftValue: (f) => d[f.slice('comment.'.length)], isText }));
  return { cards };
}
// The judge edited a comment while the review waits: that card shows "Changed since the draft" with a fresh diff.
export function refreshReview(review, entries) {
  return staleCards(review, cleanupRecord(entries), isText);
}
// The judge's choice on one card: 'insert' (use the clean text) or 'keep' (keep mine). A card with no draft stays 'keep'.
export function setChoice(review, id, choice) {
  if (choice !== 'insert' && choice !== 'keep') throw new Error('choice must be insert or keep');
  return Object.assign({}, review, { cards: review.cards.map((c) => (c.id === id && !(choice === 'insert' && c.empty) ? Object.assign({}, c, { choice }) : c)) });
}

// Writes the cards the judge set to 'insert' into each entry's comment, and marks it 'judgeEditedAi'. Never "accept
// all": only a card the judge chose. A comment that changed since the card was made is skipped. Returns
// { entries (new list; the old one is not changed), changed (entry ids) }.
export function applyCleanup(entries, review) {
  const { record, fields } = applyReview(cleanupRecord(entries), review, false);
  const changed = fields.map((f) => f.slice('comment.'.length));
  const next = entries.map((e) => (changed.includes(e.id) ? Object.assign({}, e, { comment: record.comment[e.id], commentSource: 'judgeEditedAi' }) : e));
  return { entries: next, changed };
}

(globalThis.TabulaEvents = globalThis.TabulaEvents || {}).cleanup = Object.freeze({ FEATURE, TASK, levelOf, hostedAllowed,
  cleanupPath, showCleanupButton, sourceText, cleanableEntries, scrubMap, speakerTag, scrub, restore, leaks,
  cleanupMessages, cleanupRequest, draftsFromText, readCleanupReply, cleanupGroups, cleanupRecord, cleanupReview,
  refreshReview, setChoice, applyCleanup });
