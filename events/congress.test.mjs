// Tests for step S6, the Congress scorer (docs/events/CONGRESS.md §4 to §8, EXPERIENCE.md §4, §8.1, §8.4): the
// tabulaEvents.congress.v1 store, chamber setup and sessions, the speech log and timer, the PO card, the top-8 rank,
// Review, the #/chamber routes, the router path, the offline list, and a 30-row, 3-hour memory test.
// Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { createStore } from '../core/store.js';
import { parseRoom } from './js/parse.js';
import { ROOMS_KEY, PREFIX } from './js/store.js';
import { migrateRooms } from './js/migrate.js';
import { readBackup, makeBackup } from './js/settings.js';
import { parseRoute, routeHash, roundTarget } from './js/routes.js';
import { paletteRows } from './js/palette.js';
import { loadWorkspace } from './js/workspaces.js';
import { CONGRESS_KEY, migrateCongress, congressIO, withChamber, withSession, findSession, chamberSessions } from './congress/store.js';
import { CONGRESS_PROFILES, congressProfile, SCALE_CHOICES, ranksOnly } from './congress/profiles.js';
import { setupChecks, createChamber, newSession, markDebated, setStatus, docketLines } from './congress/chamber.js';
import { nextDefaults, startSpeech, updateSpeech, startQuestions, endSpeech, timerView, questionMsFor, countedPoints, needsReason, legislatorLines, removeSpeech } from './congress/speech.js';
import { startTerm, endTerm, hoursDue, setHourScore, poLockLine, HOUR_MS } from './congress/po.js';
import { rankPool, toggleRank, placeRank, rankModel } from './congress/rank.js';
import { reviewBlocks, rankProblems } from './congress/review.js';
import { speechCardHtml, poCardHtml, rankHtml, gridHtml } from './congress/views.js';
import { findRound } from './congress/workspace.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
function memStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
let n = 0;
const makeId = (p) => p + (++n);
const DIST = congressProfile('nsda-district');
const codes = (k) => Array.from({ length: k }, (_, i) => String(1001 + i));
function chamberOf(k, profile = DIST, opts = {}) {
  const parsed = parseRoom(codes(k).join('\n'));
  return createChamber({ entries: parsed.entries, docket: opts.docket || ['A Bill to Fund Rail', 'A Resolution on Water'], house: 'house', profile, scale: opts.scale, now: 0, makeId });
}
const sessionOf = (c) => newSession(c, [], { now: 0, makeId });
const speak = (s, c, i, at, patch) => {
  let x = startSpeech(s, c.legislators[i].id, { now: at, makeId });
  const id = x.live.speechId;
  x = endSpeech(startQuestions(x, at + 170000), at + 230000);
  return patch ? updateSpeech(x, id, patch) : x;
};

// ---------- store and keys ----------

// Why: if a Congress record landed in rooms.v1, every rooms.v1 reader (the Rooms list, History, backup) would break
// on a record with no entries[] (EXPERIENCE.md §8.1 [crit]).
test('chambers and sessions save under tabulaEvents.congress.v1 only, and rooms.v1 readers never see them', () => {
  assert.equal(CONGRESS_KEY, 'tabulaEvents.congress.v1');
  const storage = memStorage();
  const store = createStore({ prefixes: [PREFIX], storage });
  const io = congressIO(store);
  const made = sessionOf(chamberOf(10));
  io.write(withSession(withChamber(io.read(), made.chamber), made.session));
  assert.deepEqual([...storage.m.keys()], [CONGRESS_KEY]);
  assert.deepEqual(migrateRooms(store.get(ROOMS_KEY, [])), [], 'the rooms list stays empty');
  assert.equal(findRound(store, made.session.id).id, made.session.id, 'the router finds the session in the Congress key');
  assert.equal(findRound(store, 'nope'), null);
  for (const f of readdirSync(new URL('./congress/', import.meta.url)).filter((x) => x.endsWith('.js'))) {
    assert.doesNotMatch(read('congress/' + f), /import[^;]*ROOMS_KEY|tabulaEvents\.rooms/, f + ' never touches rooms.v1');
  }
});

// Why: a reload in the middle of a 3-hour session must give back exactly what was saved; a migration that changed
// or dropped a field would lose a judge's points or comments.
test('records round-trip through the read-time migration, which only fills missing fields and is idempotent', () => {
  const made = sessionOf(chamberOf(12));
  let s = speak(made.session, made.chamber, 0, 1000, { points: 6, comment: 'Clear warrant.' });
  const state = withSession(withChamber(migrateCongress(null), made.chamber), s);
  const back = migrateCongress(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back, JSON.parse(JSON.stringify(state)));
  assert.deepEqual(migrateCongress(back), back, 'twice is the same as once');
  const old = migrateCongress({ chambers: [{ id: 'c', legislators: [{ id: 'l', code: '1' }], extra: 'kept' }], sessions: [{ id: 's', chamberId: 'c', number: 1, speeches: [{ id: 'p', legislatorId: 'l' }] }] });
  assert.equal(old.chambers[0].extra, 'kept', 'an unknown field is kept');
  assert.equal(old.chambers[0].legislators[0].status, 'present');
  assert.equal(old.sessions[0].speeches[0].comment, '');
  assert.notEqual(migrateCongress({ sessions: [{ id: 'a' }, { id: 'b' }] }).sessions[0].speeches, migrateCongress({ sessions: [{ id: 'a' }, { id: 'b' }] }).sessions[1].speeches);
  assert.deepEqual(migrateCongress('garbage'), { v: 1, chambers: [], sessions: [], prefs: {} });
});

// Why: judges restore old backups on a new device; a backup made before S6 must load with no change, and a new one
// must carry the chamber with it.
test('an old backup restores unchanged, and a new backup carries the Congress key', () => {
  const oldFile = read('fixtures/old/backup.json');
  const r = readBackup(oldFile);
  assert.equal(Object.keys(r.storage).includes(CONGRESS_KEY), false);
  assert.deepEqual(migrateCongress(undefined).chambers, []);
  const file = makeBackup({ [CONGRESS_KEY]: JSON.stringify({ v: 1, chambers: [], sessions: [] }) }, { now: '2026-11-23T00:00:00Z' });
  assert.ok(Object.keys(readBackup(JSON.stringify(file)).storage).includes(CONGRESS_KEY));
});

// ---------- setup ----------

// Why: each "Check these" line stops a bad chamber (a repeated code, too many rows) before a 3-hour session starts on it.
test('setup gives a "Check these" line for each problem in CONGRESS.md §4.1', () => {
  const kinds = (text, docket = ['Bill'], profile = DIST) => setupChecks(parseRoom(text), docket, profile).map((c) => c.kind);
  assert.deepEqual(kinds(codes(10).join('\n')), []);
  assert.ok(kinds(codes(9).concat('1001').join('\n')).includes('line'), 'a repeated code');
  assert.ok(kinds(codes(30).join('\n')).includes('tooMany'), '30 rows under the district limit of 29');
  assert.deepEqual(kinds(codes(30).join('\n'), ['B'], congressProfile('nsda-last-chance')), [], '30 rows is fine at the limit of 30');
  assert.ok(kinds(codes(5).join('\n')).includes('tooFew'));
  assert.ok(kinds('').includes('none'));
  assert.ok(kinds(codes(10).join('\n'), []).includes('noDocket'));
  const block = setupChecks(parseRoom(codes(30).join('\n')), ['B'], DIST).filter((c) => c.block).map((c) => c.kind);
  assert.deepEqual(block, ['tooMany'], 'only too many or none stop the start; the rest are warnings');
  assert.deepEqual(docketLines(' A \n\n B\r\n'), ['A', 'B']);
});

// Why: sessions are fresh starts (CONGRESS.md §1); a carried-over speech or PO term would give a student points
// from the last session, and a lost legislator list would make the judge paste 30 codes again.
test('session 2 carries the chamber over and starts fresh, with debated items marked', () => {
  const made = sessionOf(chamberOf(12));
  let s1 = speak(made.session, made.chamber, 0, 1000, { points: 5 });
  s1 = startTerm(s1, made.chamber.legislators[1].id, 0);
  const ch = markDebated(made.chamber, s1.itemId, 1);
  const two = newSession(ch, [s1], { now: 5, makeId });
  assert.equal(two.session.number, 2);
  assert.deepEqual([two.session.speeches, two.session.poTerms, two.session.ranks], [[], [], []]);
  assert.equal(two.chamber.legislators.length, 12);
  assert.equal(two.chamber.docket[0].debatedInSession, 1);
  assert.equal(two.session.itemId, two.chamber.docket[1].id, 'the next session opens on the first item not yet debated');
  assert.deepEqual(two.chamber.sessionIds, [made.session.id, two.session.id]);
});

// ---------- the log ----------

// Why: the judge has seconds while a student walks up; a wrong side or type would put the speech in the wrong
// Tabroom row and give the wrong question time.
test('item, side and type fill in: authorship, then first negative, then the side alternates', () => {
  const c = chamberOf(12);
  let s = sessionOf(c).session;
  assert.deepEqual(nextDefaults(s), { itemId: s.itemId, side: 'aff', type: 'authorship' });
  s = speak(s, c, 0, 0);
  assert.deepEqual([nextDefaults(s).side, nextDefaults(s).type], ['neg', 'firstNeg']);
  s = speak(s, c, 1, 300000);
  assert.deepEqual([nextDefaults(s).side, nextDefaults(s).type], ['aff', 'rebuttal']);
  s = speak(s, c, 2, 600000, { side: 'neg' });
  assert.equal(nextDefaults(s).side, 'aff', 'it alternates from the last speech, even after the judge changed it');
  s = Object.assign({}, s, { itemId: c.docket[1].id });
  assert.equal(nextDefaults(s).type, 'authorship', 'a new item starts with its authorship');
});

// Why: question time differs by speech type (2:00 or 1:00); the wrong length would cut off or overrun a student.
test('the timer runs 3:00, then questions by type in 30-second blocks, and keeps the times', () => {
  assert.equal(questionMsFor('authorship'), 120000);
  assert.equal(questionMsFor('sponsorship'), 120000);
  assert.equal(questionMsFor('firstNeg'), 120000);
  for (const t of ['rebuttal', 'extension', 'crystal', 'amendment']) assert.equal(questionMsFor(t), 60000, t);
  const c = chamberOf(10);
  let s = startSpeech(sessionOf(c).session, c.legislators[0].id, { now: 0, makeId });
  assert.deepEqual([timerView(s, 60000).phase, timerView(s, 60000).leftMs], ['speech', 120000]);
  assert.equal(timerView(s, 190000).leftMs, -10000, 'over time shows as negative');
  s = startQuestions(s, 171000);
  const t = timerView(s, 171000 + 45000);
  assert.deepEqual([t.phase, t.limitMs, t.block, t.blocks, t.blockLeftMs], ['questions', 120000, 2, 4, 15000]);
  s = endSpeech(s, 171000 + 110000);
  assert.deepEqual([s.speeches[0].speakMs, s.speeches[0].questionMs, s.live], [171000, 110000, null]);
  const two = startSpeech(startSpeech(sessionOf(c).session, c.legislators[0].id, { now: 0, makeId }), c.legislators[1].id, { now: 50000, makeId });
  assert.equal(two.speeches[0].speakMs, 50000, 'starting the next speech ends the live one and keeps its time');
});

// Why: the fixed penalties are league rules (CONGRESS.md §5.3); a wrong count would change a student's total.
test('penalties and the scored-speech cap give the counted points each league sets', () => {
  const sp = (points, penalty) => ({ points, penalty });
  assert.equal(countedPoints(sp(7, 'wrongSide'), DIST, 1), 4, 'NSDA: at least 3 off');
  assert.equal(countedPoints(sp(2, 'wrongSide'), DIST, 1), 1, 'never below the low end');
  assert.equal(countedPoints(sp(6, 'wrongSide'), congressProfile('tfa'), 1), 3, 'TFA: no more than 3');
  assert.equal(countedPoints(sp(8, 'offFloor'), DIST, 1), 0, 'not on the floor: 0');
  assert.equal(countedPoints(sp(null, 'offFloor'), DIST, 1), 0);
  assert.equal(countedPoints(sp(5, null), congressProfile('uil'), 5), 5);
  assert.equal(countedPoints(sp(5, null), congressProfile('uil'), 6), null, 'UIL: only the first 5 speeches get points');
  assert.equal(countedPoints(sp(null, null), DIST, 1), null);
});

// Why: Last Chance asks for a written reason below 5; the app must ask, but never block the save mid-session.
test('a score below reasonBelow asks for a reason only when the profile has a number', () => {
  const lc = congressProfile('nsda-last-chance');
  assert.equal(needsReason({ points: 4, comment: '' }, lc), true);
  assert.equal(needsReason({ points: 4, comment: 'Read from notes the whole time.' }, lc), false);
  assert.equal(needsReason({ points: 5, comment: '' }, lc), false);
  assert.equal(needsReason({ points: 1, comment: '' }, DIST), false, 'NSDA district has no number, so the app never asks');
});

// Why: invitationals score on 1 to 6 or 1 to 8; a grid with the wrong buttons would let a judge give a score the
// ballot cannot take.
test('the points scale is a setting: the grid shows one button for each point on 1 to 6 or 1 to 8', () => {
  for (const [id, count] of [['1-6', 6], ['1-8', 8]]) {
    const c = chamberOf(10, DIST, { scale: SCALE_CHOICES.find((x) => x.id === id) });
    assert.equal(c.profile.scale.max, count);
    assert.equal(DIST.scale.max, 8, 'the shared profile is never changed');
    const s = startSpeech(sessionOf(c).session, c.legislators[0].id, { now: 0, makeId });
    const html = speechCardHtml(c, s, s.live.speechId, 1000);
    assert.equal((html.match(/data-cact="points" data-value="\d+"/g) || []).length, count, id);
  }
  assert.equal(chamberOf(10, DIST, { scale: { min: 5, max: 2 } }).profile.scale.max, 8, 'a bad scale keeps the rules\' scale');
});

// ---------- PO ----------

// Why: Tabroom will not take ranks until each full PO hour is scored; a wrong hour count would lock the judge out or
// let them skip a required score.
test('the PO card counts full hours, flags a part hour with no score, and locks Rank until each hour is scored', () => {
  const c = chamberOf(10);
  let s = startTerm(sessionOf(c).session, c.legislators[3].id, 0);
  assert.deepEqual(hoursDue(s.poTerms[0], HOUR_MS - 1, DIST), []);
  assert.deepEqual(hoursDue(s.poTerms[0], 2 * HOUR_MS + 5, DIST), [1, 2]);
  assert.match(poLockLine(s, 2 * HOUR_MS, DIST, () => '1004'), /1st hour first \(1004\)/);
  assert.equal(setHourScore(s, 0, 3, 7, 2 * HOUR_MS), s, 'an hour not yet finished is refused');
  s = setHourScore(s, 0, 1, 7, 2 * HOUR_MS);
  assert.match(poLockLine(s, 2 * HOUR_MS, DIST, () => '1004'), /2nd hour/);
  s = setHourScore(s, 0, 2, 6, 2 * HOUR_MS);
  s = endTerm(s, 2.5 * HOUR_MS);
  assert.deepEqual([s.poTerms[0].partHour, poLockLine(s, 3 * HOUR_MS, DIST, () => 'x')], [true, ''], 'the half hour is flagged and needs no score');
  assert.equal(endTerm(startTerm(sessionOf(c).session, 'x', 0), HOUR_MS).poTerms[0].partHour, false);
  const t = startTerm(sessionOf(c).session, 'x', 0);
  assert.deepEqual(hoursDue(t.poTerms[0], 3 * HOUR_MS, congressProfile('tfa')), [], 'TFA: the parliamentarian scores the PO');
  const two = startTerm(startTerm(sessionOf(c).session, 'a', 0), 'b', HOUR_MS / 2);
  assert.deepEqual(two.poTerms.map((x) => x.endedAt), [HOUR_MS / 2, null], 'a new PO closes the open term');
  assert.match(poCardHtml(c, s, 3 * HOUR_MS, false), /part hour: no score/);
});

// ---------- rank ----------

// Why: a scorer ranks a top 8 from the right pool; the wrong pool would let a judge rank an absent student or hide
// a PO who never spoke (NSDA allows POs; Last Chance limits to spoke-or-presided).
test('the rank pool follows each profile, sorted by points, with absent legislators left out', () => {
  let c = chamberOf(10);
  let s = sessionOf(c).session;
  s = speak(s, c, 2, 0, { points: 8 });
  s = speak(s, c, 5, 300000, { points: 6 });
  s = startTerm(s, c.legislators[7].id, 0);
  c = setStatus(c, c.legislators[9].id, 'absent', 1);
  const pool = rankPool(c, s);
  assert.equal(pool.length, 9, 'NSDA: every present legislator');
  assert.deepEqual(pool.slice(0, 2).map((x) => x.legislator.code), ['1003', '1006']);
  const lc = Object.assign({}, c, { profile: congressProfile('nsda-last-chance') });
  assert.deepEqual(rankPool(lc, s).map((x) => x.legislator.code).sort(), ['1003', '1006', '1008'], 'Last Chance: spoke or presided');
});

// Why: CONGRESS.md §4.3: no rank-rating rule. Blocking a lower-points student from a higher rank would force a judge
// to rank by quantity, which the NSDA manual rejects.
test('the top 8 fills by tap, clears by tap, caps at 8, warns on a points tie, and ignores points order', () => {
  const c = chamberOf(12);
  let s = sessionOf(c).session;
  s = speak(s, c, 0, 0, { points: 8 });
  s = speak(s, c, 1, 300000, { points: 3 });
  s = speak(s, c, 2, 600000, { points: 3 });
  s = toggleRank(c, s, c.legislators[1].id);
  s = toggleRank(c, s, c.legislators[0].id);
  assert.deepEqual(s.ranks, [c.legislators[1].id, c.legislators[0].id], 'a 3-point student ranks above an 8-point one');
  s = toggleRank(c, s, c.legislators[2].id);
  assert.deepEqual(rankModel(c, s).ties.length, 1, 'two ranked students with the same points: a warning');
  s = toggleRank(c, s, c.legislators[1].id);
  assert.equal(s.ranks[0], null, 'a tap on a ranked student clears the slot');
  for (let i = 3; i < 12; i++) s = toggleRank(c, s, c.legislators[i].id);
  const m = rankModel(c, s);
  assert.equal(m.topN, 8);
  assert.equal(m.slots.filter(Boolean).length, 8);
  assert.equal(m.complete, true);
  assert.equal(s.ranks.length, 8, 'never more than 8');
  const moved = placeRank(c, s, c.legislators[11].id, 1);
  assert.equal(moved.ranks.filter((x) => x === c.legislators[11].id).length, 1, 'no ties: a slot holds one');
  assert.equal(placeRank(c, s, c.legislators[0].id, 9), s, 'slot 9 is out of range');
});

// Why: the rank screen must stay locked while a PO hour is unscored, so the judge does not hit Tabroom's refusal.
test('Rank and Review show the PO lock and the problems that stop copying the ranks', () => {
  const c = chamberOf(10);
  let s = startTerm(sessionOf(c).session, c.legislators[0].id, 0);
  const html = rankHtml(c, s, HOUR_MS + 1);
  assert.match(html, /Score the PO’s 1st hour first/);
  assert.match(html, /data-cact="rank"[^>]*disabled/);
  assert.deepEqual(rankProblems(c, s, HOUR_MS + 1).length, 2);
  s = setHourScore(s, 0, 1, 6, HOUR_MS + 1);
  for (let i = 0; i < 8; i++) s = toggleRank(c, s, c.legislators[i].id);
  assert.deepEqual(rankProblems(c, s, HOUR_MS + 1), []);
});

// Why: Tabroom takes the speeches first and the ranks last; copying out of order makes a judge hunt across tabs.
test('Review lists the speeches, then the PO hours, then the ranks, with counted points', () => {
  const c = chamberOf(10);
  let s = sessionOf(c).session;
  s = speak(s, c, 0, 0, { points: 7, comment: 'Strong refutation.', penalty: 'wrongSide' });
  s = startTerm(s, c.legislators[1].id, 0);
  s = setHourScore(s, 0, 1, 6, HOUR_MS);
  const kinds = reviewBlocks(c, s).map((b) => b.kind);
  assert.deepEqual(kinds, ['speech', 'po', 'ranks']);
  const first = reviewBlocks(c, s)[0];
  assert.match(first.text, /^1001 · A Bill to Fund Rail · Aff · Authorship · 4 points\nWrong side/);
  assert.match(first.text, /Strong refutation\.$/);
});

// ---------- routes, router, offline, palette ----------

// Why: a reload must reopen the same chamber; a route that fell through to Rooms would strand the judge mid-session.
test('the #/chamber routes parse and round-trip, and a session opens through #/round/<id>/<stage>', () => {
  assert.deepEqual(parseRoute('#/chamber'), { screen: 'chamber', id: null });
  assert.deepEqual(parseRoute('#/chamber/new'), { screen: 'chamber', id: 'new' });
  assert.deepEqual(parseRoute('#/chamber/ch12'), { screen: 'chamber', id: 'ch12' });
  assert.equal(roundTarget(parseRoute('#/chamber/ch12')), null, 'a chamber is not a round');
  for (const bad of ['#/chamber/bad id', '#/chamber/a/b']) assert.deepEqual(parseRoute(bad), { screen: 'rooms', id: null }, bad);
  assert.equal(routeHash('chamber', 'ch12'), '#/chamber/ch12');
  assert.equal(routeHash('chamber'), '#/chamber');
  assert.deepEqual(roundTarget(parseRoute('#/round/cs4/log')), { id: 'cs4', stage: 'log' });
  const rows = paletteRows({ choices: [], rooms: [] });
  assert.ok(rows.some((r) => r.hash === '#/chamber/new'));
});

// Why: the router opens a session in the Congress workspace; a missing contract member or stage would fail at the
// tournament, and a module missing from the offline list fails cold with no wifi (EXPERIENCE.md §9).
test('the congress workspace has the contract, the stages log, rank, review, and every module is cached offline', async () => {
  const ws = await loadWorkspace('congress');
  for (const m of ['newRound', 'stages', 'mount', 'keys', 'validate', 'summary', 'rankModel', 'reviewModel']) assert.equal(typeof ws[m], 'function', m);
  assert.deepEqual(ws.stages(), ['log', 'rank', 'review']);
  const c = chamberOf(10);
  const made = ws.newRound(c, null, { sessions: [], now: 0, makeId });
  assert.equal(made.session.number, 1);
  assert.deepEqual(ws.summary(made.session, c), { status: 'Not started', done: 0, total: 10, next: '1001' });
  const ctx = vm.createContext({ self: {} });
  vm.runInContext(read('sw-files.js'), ctx);
  const files = ctx.self.TABULA_EVENTS_FILES;
  for (const f of readdirSync(new URL('./congress/', import.meta.url)).filter((x) => /\.(js|css)$/.test(x))) {
    assert.ok(files.includes('congress/' + f), 'congress/' + f + ' is cached for offline; run node events/build-sw.mjs');
  }
});

// Why: every profile needs a valid scale and PO rule; a broken profile would crash setup at the tournament.
test('each Congress profile has whole-number scales, a known PO rule and rank pool, and a source', () => {
  for (const p of CONGRESS_PROFILES) {
    // Ranks-only profiles (NCFL, CHSSA) have no scale and no PO rule; every other profile keeps the full check.
    if (p.scoring === 'ranksOnly') assert.deepEqual([p.scale, p.poScale, p.poRule], [null, null, 'none'], p.id);
    else assert.ok(Number.isInteger(p.scale.min) && p.scale.min < p.scale.max, p.id);
    if (p.scoring !== 'ranksOnly') assert.ok(['fullHourOnly', 'parliScores'].includes(p.poRule), p.id);
    assert.ok(['present', 'spokeOrPresided'].includes(p.rankPool), p.id);
    assert.ok(p.source && p.version >= 1, p.id);
    for (const f of p.unverified) assert.ok(f in p, p.id + ' marks a field it has: ' + f);
  }
});

// ---------- memory: a 30-row chamber over 3 hours ----------

// Why: EXPERIENCE.md §11.2 risk 6. A 3-hour session with 30 legislators saves after every speech; if the saved value
// grew too large or a save failed, the judge would lose the session on a reload or a full phone.
test('a 30-row chamber over 3 hours saves after every speech and stays small', () => {
  const storage = memStorage();
  let writes = 0;
  const store = createStore({ prefixes: [PREFIX], storage, onSaved: () => { writes++; } });
  const io = congressIO(store);
  const profile = congressProfile('nsda-last-chance');
  const c = chamberOf(30, profile, { docket: Array.from({ length: 12 }, (_, i) => 'A Bill Number ' + (i + 1)) });
  let { chamber, session } = newSession(c, [], { now: 0, makeId });
  io.write(withSession(withChamber(io.read(), chamber), session));
  session = startTerm(session, chamber.legislators[0].id, 0);
  const comment = 'Clear claim and warrant with two sources. Answers in questions were direct. Next time, weigh the impact against the last speaker. '.repeat(4);
  const SPEECHES = 60; // 3 hours at 3:00 a speech plus questions is about 45; 60 leaves room
  let biggest = 0;
  for (let i = 0; i < SPEECHES; i++) {
    const at = i * 180000;
    session = startSpeech(session, chamber.legislators[1 + (i % 29)].id, { now: at, makeId });
    const id = session.live.speechId;
    session = endSpeech(startQuestions(session, at + 170000), at + 230000);
    session = updateSpeech(session, id, { points: 1 + (i % 8), comment });
    if (i % 4 === 3) { chamber = markDebated(chamber, session.itemId, 1); session = Object.assign({}, session, { itemId: chamber.docket[Math.min(11, (i + 1) / 4)].id }); }
    assert.equal(io.write(withSession(withChamber(io.read(), chamber), session)), true, 'save after speech ' + (i + 1));
    biggest = Math.max(biggest, storage.getItem(CONGRESS_KEY).length);
  }
  for (let h = 1; h <= 3; h++) session = setHourScore(session, 0, h, 7, 3 * HOUR_MS);
  session = endTerm(session, 3 * HOUR_MS);
  io.write(withSession(io.read(), session));
  assert.ok(writes >= SPEECHES + 2);
  const back = findSession(io.read(), session.id);
  assert.equal(back.speeches.length, SPEECHES, 'a reload gives back every speech');
  assert.equal(back.speeches[SPEECHES - 1].comment, comment);
  assert.ok(biggest < 250 * 1024, 'the whole value stays under 250 KB (got ' + biggest + ' bytes); localStorage allows about 5 MB');
  assert.equal(legislatorLines(chamber, back).reduce((a, l) => a + l.count, 0), SPEECHES);
  const grid = gridHtml(chamber, back, null);
  assert.equal((grid.match(/class="cg-cell[ "]/g) || []).length, SPEECHES, 'the grid draws one cell for each speech, not rows x speeches');
  for (let i = 0; i < 8; i++) back.ranks = toggleRank(chamber, back, chamber.legislators[i + 1].id).ranks;
  assert.deepEqual(rankProblems(chamber, back, 3 * HOUR_MS), []);
  assert.equal(chamberSessions(io.read(), chamber.id).length, 1);
  assert.equal(removeSpeech(back, back.speeches[0].id).speeches.length, SPEECHES - 1);
});

// Why: TFA State is a different ballot from TFA IQTs (1 to 6, not 0 to 6; chambers of 20); scoring a State chamber on
// the IQT rules would let a judge give a 0 the State ballot cannot take, or accept a 30-row chamber.
test('the TFA State profile scores 1 to 6, leaves the PO to the parliamentarian, caps prelim chambers at 20, and marks its open values', () => {
  const st = congressProfile('tfa-state');
  assert.deepEqual([st.scale.min, st.scale.max, st.poScale.min, st.poScale.max], [1, 6, 1, 6]);
  assert.equal(st.poRule, 'parliScores');
  assert.equal(st.topN, 8);
  assert.equal(countedPoints({ points: 6, penalty: 'wrongSide' }, st, 1), 3, 'wrong side: no more than 3');
  assert.deepEqual(setupChecks(parseRoom(codes(21).join('\n')), ['B'], st).filter((c) => c.block).map((c) => c.kind), ['tooMany']);
  assert.deepEqual(setupChecks(parseRoom(codes(20).join('\n')), ['B'], st), []);
  assert.deepEqual([...st.unverified].sort(), ['rankPool', 'reasonBelow', 'wrongSideMax']);
  assert.equal(congressProfile('tfa').scale.min, 0, 'the IQT profile is unchanged');
});

// Why: NCFL and CHSSA ballots have no points at all. A points grid there would make a judge invent scores the tab room
// cannot take, and a PO prompt would lock the rank for a score no one gives.
test('the NCFL and CHSSA profiles are ranks only: no points, no PO prompt, and the rank length each league sets', () => {
  const ncfl = congressProfile('ncfl'), ch = congressProfile('chssa'), chE = congressProfile('chssa-elim');
  for (const p of [ncfl, ch, chE]) assert.equal(ranksOnly(p), true, p.id);
  assert.equal(ranksOnly(DIST), false);
  assert.deepEqual([ncfl.topN, ch.topN, chE.topN], [8, 9, 15]);
  assert.ok(ncfl.unverified.includes('topN') && chE.unverified.includes('topN') && !ch.unverified.includes('topN'), 'only CHSSA prelims (1 to 9) is confirmed');
  // A picked scale is ignored, so no points can be given.
  const c = chamberOf(12, ch, { scale: SCALE_CHOICES[1] });
  assert.equal(c.profile.scale, null);
  let s = sessionOf(c).session;
  s = startSpeech(s, c.legislators[0].id, { now: 0, makeId });
  const card = speechCardHtml(c, s, s.live.speechId, 1000);
  assert.doesNotMatch(card, /data-cact="points"/, 'no points buttons');
  assert.doesNotMatch(card, /data-cact="penalty"/, 'no point penalties');
  assert.equal(countedPoints({ points: 6, penalty: null }, c.profile, 1), null);
  // The PO term is logged, but no hour ever needs a score, so Rank never locks on it.
  s = startTerm(endSpeech(s, 200000), c.legislators[1].id, 0);
  assert.deepEqual(hoursDue(s.poTerms[0], 3 * HOUR_MS, c.profile), []);
  assert.equal(poLockLine(s, 3 * HOUR_MS, c.profile, () => 'x'), '');
  // The top 9 fills; Review copies speeches with no points words.
  for (let i = 0; i < 12; i++) s = toggleRank(c, s, c.legislators[i].id);
  assert.equal(rankModel(c, s).slots.filter(Boolean).length, 9);
  assert.deepEqual(rankProblems(c, s, 3 * HOUR_MS), []);
  assert.doesNotMatch(reviewBlocks(c, s)[0].text, /point/);
  assert.doesNotMatch(rankHtml(c, s, 3 * HOUR_MS), /points/);
});
