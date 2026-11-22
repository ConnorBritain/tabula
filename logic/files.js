// Round material: SpeechDrop, names kept out of AI prompts, round files (.tab), backup and restore, and the
// round documents attached to AI requests.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');
  const { num } = part('round');

  // ---------- SpeechDrop (speechdrop.net) ----------
  // Debaters share speech docs in a SpeechDrop room. The judge types the room code; Tabula lists the files.
  // A room code, from what the judge types or pastes: "abc123", or a link like https://speechdrop.net/abc123.
  function parseSpeechDropCode(input) {
    const t = String(input || '').trim();
    const m = t.match(/^(?:https?:\/\/)?(?:www\.)?speechdrop\.net\/([A-Za-z0-9_-]{1,40})\/?(?:[?#].*)?$/i) || t.match(/^([A-Za-z0-9_-]{1,40})$/);
    return m ? m[1] : '';
  }
  // The room's file list: SpeechDrop keeps a slot per upload (null once deleted); the slot number finds the file.
  function speechDropFiles(index) {
    return (Array.isArray(index) ? index : [])
      .map((e, i) => (e && typeof e.name === 'string' ? { i, name: e.name, ctime: Number(e.ctime) || 0 } : null))
      .filter(Boolean);
  }
  // A guess at which flowed speech a file belongs to, from its name ("Lake AB 1NC v2.docx" -> 1NC), in the given
  // format (policy-hs when not given). A leading digit may have a space after it ("1 NC"). '' = context only.
  function guessSpeech(fileName, fmt) {
    const n = String(fileName || '').replace(/\.[a-z0-9]+$/i, '');
    const f = fmt || F.POLICY;
    const flowed = f.speeches.filter((s) => s.column != null);
    const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const s of flowed) {
      const pat = reEsc(s.id).replace(/^(\d)/, '$1\\s?');
      if (new RegExp('(?:^|[^A-Za-z0-9])' + pat + '(?=$|[^A-Za-z])', 'i').test(n)) return s.id;
    }
    for (const s of flowed) for (const a of s.aliases || []) if (new RegExp('\\b' + reEsc(a) + '\\b', 'i').test(n)) return s.id;
    return '';
  }
  // The side a speech belongs to (for the doc's Aff/Neg tag).
  const speechSide = (speechId, fmt) => ((F.speechOf(fmt || F.POLICY, speechId) || {}).side || 'other');

  // ---------- names out of AI prompts ----------
  // Debaters are minors. Their names and team codes are swapped for positions before any text goes to an AI,
  // and swapped back in the AI's reply, so the judge still reads names on screen.
  function nameSwaps(round) {
    const r = round || {};
    const fmt = F.formatOf(r);
    const out = [];
    const add = (name, tag) => {
      const n = String(name || '').trim();
      if (n.length < 2) return;
      out.push([n, tag]);
      const parts = n.split(/\s+/);
      if (parts.length > 1) for (const p of parts) if (p.length >= 3) out.push([p, tag]); // "Ann Lee" -> also "Ann", "Lee"
    };
    // Each debater's name becomes the format's tag for that seat (1A ... 2N in policy, "Aff debater" in LD).
    for (const sp of fmt.speakers) add(F.speakerName(r, sp), F.speakerTag(sp));
    add(r.aff && r.aff.team, 'the Aff team'); add(r.neg && r.neg.team, 'the Neg team');
    return out.sort((a, b) => b[0].length - a[0].length);
  }
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Names match only when written as a name: as typed, capitalized, or in capitals ("Will", "WILL"),
  // so a debater named Will or Grace does not turn every "will" or "grace" in a speech into "1A".
  function anonymize(text, round) {
    const forms = (n) => [...new Set([n, n.charAt(0).toUpperCase() + n.slice(1), n.toUpperCase()])];
    return nameSwaps(round).reduce((t, [name, tag]) => forms(name).reduce((u, f) => u.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + reEsc(f) + '(?=$|[^\\p{L}\\p{N}])', 'gu'), (m, pre) => pre + tag), t), String(text == null ? '' : text));
  }
  // Puts names back in a reply (any mix of objects, lists and text). Keys stay as they are ('1A' points keys).
  function deanonymize(value, round) {
    const r = round || {};
    const seats = F.formatOf(r).speakers.map((sp) => [F.speakerTag(sp), F.speakerName(r, sp)]);
    const back = [['the Aff team', r.aff && r.aff.team], ['the Neg team', r.neg && r.neg.team], ...seats]
      .filter(([, n]) => String(n || '').trim()).map(([tag, n]) => [tag, String(n).trim()]);
    // A replacer function, so a name with "$" in it is inserted as written.
    const fix = (t) => back.reduce((s, [tag, name]) => s.replace(new RegExp('(^|[^\\p{L}\\p{N}])' + reEsc(tag) + '(?=$|[^\\p{L}\\p{N}])', 'gu'), (m, pre) => pre + name), t);
    const walk = (v) => (typeof v === 'string' ? fix(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v);
    return back.length ? walk(value) : value;
  }

  // Docs from a file (a backup or a .tab round): only entries with an id, a name and their data.
  function cleanDocs(list) {
    return (Array.isArray(list) ? list : []).filter((d) => d && typeof d.id === 'string' && typeof d.name === 'string' && typeof d.data === 'string');
  }

  // ---------- round files (.tab) ----------
  // One round in one file: setup, timers, transcripts, flows, analysis, ballot, and its docs.
  // A .tab file is JSON; the name tells people (and their computer) it is a Tabula round.
  const ROUND_FILE_KIND = 'tabula-round';
  // A round with nothing in it yet: no names, no transcript, no flow notes, no clock used.
  function isRoundEmpty(r) {
    if (!r) return true;
    const people = [r.tournament, r.roundName, r.aff && r.aff.team, r.aff && r.aff.d1, r.aff && r.aff.d2, r.neg && r.neg.team, r.neg && r.neg.d1, r.neg && r.neg.d2];
    if (people.some((x) => String(x || '').trim())) return false;
    if (Object.values(r.transcripts || {}).some((t) => String(t || '').trim())) return false;
    if ((r.aiFlows || []).length) return false;
    if ((r.flows || []).some((f) => Object.values(f.cells || {}).some((c) => String(c || '').trim()))) return false;
    if (Object.keys(r.timeLeft || {}).length) return false;
    if (r.ballot && r.ballot.winner) return false;
    return true;
  }
  function buildRoundFile(round, docs, savedAt) {
    return { app: 'tabula', kind: ROUND_FILE_KIND, version: 1, savedAt: savedAt || new Date().toISOString(), round, docs: (docs || []).filter((d) => d && d.roundId === round.id) };
  }
  // Reads a .tab file. The round gets a new id (newId), and its docs move to that id,
  // so opening the same file twice never mixes two rounds' docs.
  function parseRoundFile(text, newId) {
    let f;
    try { f = JSON.parse(text); } catch { throw new Error('this is not a Tabula round file'); }
    if (!f || f.app !== 'tabula' || f.kind !== ROUND_FILE_KIND) throw new Error(f && f.kind === 'backup' ? 'this is a full backup. Open it under Library → Back up your work' : 'this is not a Tabula round file');
    if (!(f.version >= 1)) throw new Error('this round file has no version');
    if (f.version > 1) throw new Error('this round file is from a newer Tabula. Update the app first');
    const r = f.round;
    if (!r || typeof r !== 'object' || typeof r.transcripts !== 'object' || !Array.isArray(r.flows)) throw new Error('the round in this file is damaged');
    // Only well-formed parts come in; the app fills anything missing with its defaults.
    const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
    const str = (x) => (typeof x === 'string' ? x : '');
    const team = (t) => ({ team: str(obj(t).team), d1: str(obj(t).d1), d2: str(obj(t).d2) });
    const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
    // Unknown keys are kept (newer app versions add fields), except ones that could change object prototypes.
    const safe = Object.fromEntries(Object.entries(r).filter(([k]) => !['__proto__', 'constructor', 'prototype'].includes(k)));
    const round = Object.assign({}, safe, {
      id: newId,
      tournament: str(r.tournament), roundName: str(r.roundName), judge: str(r.judge), topic: str(r.topic),
      room: str(r.room), start: str(r.start), flight: str(r.flight),
      aff: team(r.aff), neg: team(r.neg),
      transcripts: Object.fromEntries(Object.entries(obj(r.transcripts)).filter(([, v]) => typeof v === 'string')),
      flows: r.flows.filter((s) => s && typeof s.name === 'string').map((s) => ({ name: s.name, cells: obj(s.cells) })),
      aiFlows: Array.isArray(r.aiFlows) ? r.aiFlows.filter((s) => s && typeof s.name === 'string') : [],
      timeLeft: Object.fromEntries(Object.entries(obj(r.timeLeft)).filter(([, v]) => num(v) != null)),
      ballot: Object.assign({ winner: '', pts: {}, ranks: {}, rfd: '' }, obj(r.ballot)),
    });
    for (const k of ['prepSeconds', 'cur', 'flowIdx']) if (num(r[k]) == null) delete round[k];
    // The round's format must be one this app has; a missing one is an old policy round.
    if (!F.formatKnown(r)) throw new Error('this round file uses a debate format this copy of Tabula does not have. Reload the app first');
    const clocks = F.prepClocks(F.formatOf(r)).map((c) => c.id);
    if (r.prepLeft != null && clocks.some((id) => num(obj(r.prepLeft)[id]) == null)) delete round.prepLeft;
    const docs = cleanDocs(f.docs).map((d) => Object.assign({}, d, { id: newId + ':' + d.id, roundId: newId }));
    return { round, docs, savedAt: f.savedAt || '' };
  }
  // A file name people can recognize in Downloads: tournament, round, and the two teams.
  function roundFileName(r, date) {
    const bits = [r.tournament, r.roundName, [r.aff && r.aff.team, r.neg && r.neg.team].filter(Boolean).join(' vs ')].map((x) => String(x || '').trim()).filter(Boolean);
    const base = (bits.join(' - ') || 'round ' + (date || '')).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    return (base || 'round') + '.tab';
  }

  // ---------- backup and restore ----------
  // One file holds everything the app keeps in the browser, so it can be saved or moved to another computer.
  const BACKUP_PREFIX = 'policyJudge.'; // the same prefix as STORE_PREFIX in js/core.js
  const KEYS_ENTRY = 'policyJudge.keys.v1';
  const OLD_KEY_ENTRIES = ['policyJudge.key', 'policyJudge.openaiKey'];

  // The shared backup file code is core/store.js (an ES module): the page runs it before this file; Node requires it.
  const CORE_STORE = typeof module !== 'undefined' && module.exports ? require('../core/store.js') : root.TabulaCore.store;

  // storage: { name: rawString } for every browser storage entry. docs: the round documents.
  function buildBackup(storage, docs, opts) {
    const o = opts || {};
    // API keys stay out unless the judge asks for them: a backup file is easy to share by mistake.
    return CORE_STORE.buildBackup(storage, { prefix: BACKUP_PREFIX, secretKeys: [KEYS_ENTRY, ...OLD_KEY_ENTRIES], includeSecrets: Boolean(o.includeKeys), now: o.now, extra: { docs: docs || [] } });
  }

  // Reads a backup file and says plainly what is wrong with it, if anything.
  function parseBackup(text) {
    const b = CORE_STORE.parseBackup(text, { prefix: BACKUP_PREFIX });
    return { storage: b.storage, docs: cleanDocs(b.file.docs), exportedAt: b.exportedAt, includesKeys: b.includesKeys };
  }

  // A short summary for the "are you sure" message.
  function backupSummary(b) {
    let round = {}, log = [];
    try { round = JSON.parse(b.storage['policyJudge.round.v1'] || '{}') || {}; } catch {}
    try { log = JSON.parse(b.storage['policyJudge.log.v1'] || '[]') || []; } catch {}
    const name = [round.tournament, round.roundName].filter(Boolean).join(' — ') || 'unnamed round';
    return { round: name, ballots: Array.isArray(log) ? log.length : 0, docs: (b.docs || []).length, keys: b.includesKeys };
  }

  // ---------- round documents (speech docs, case files) ----------
  const DOC_SIDES = { aff: 'AFF', neg: 'NEG', other: 'OTHER' };
  const DOC_NOTE = 'Speech documents from the debaters are attached above. Use them to read card tags, authors and evidence text. '
    + 'When a speech has no transcript, treat its speech doc as what was said: debaters usually read their doc. '
    + 'When a speech has a transcript, the transcript wins; a card in the doc that the transcript does not show may have been skipped, and it does not count unless the judge\'s own flow shows it. '
    + 'AI flow lines marked [doc] come from the speech doc; [doc?] (used only when a transcript exists) means it is in the doc but was not heard in the transcript, so do not score a [doc?] line unless the judge\'s own flow shows that argument.';

  // Which speech a doc belongs to. If the judge has not picked one: an Aff doc goes to the format's first Aff speech
  // (the 1AC, the AC), a Neg doc to its first Neg speech (the 1NC, the NC). fmt: policy-hs when not given.
  function docSpeech(doc, fmt) {
    if (doc && doc.speech !== undefined) return doc.speech;
    const first = (side) => ((fmt || F.POLICY).speeches.find((s) => s.side === side && s.column != null) || {}).id || '';
    return doc && (doc.side === 'aff' || doc.side === 'neg') ? first(doc.side) : '';
  }
  // The docs one speech needs (the live flow sends only these, to keep each 30-second pass cheap).
  function docsForSpeech(docs, speechId, fmt) {
    return (docs || []).filter((d) => docSpeech(d, fmt) === speechId);
  }

  const DOC_FLOW_NOTE = 'Speech documents from the debaters are attached above. Each is listed with the speech it belongs to. '
    + 'If the current speech has no transcript, the speech doc IS the speech: flow all of it and mark those lines [doc]. Use the docs also to get card tags and authors right.';

  function docTitle(doc, fmt) {
    const sp = docSpeech(doc, fmt);
    return (DOC_SIDES[doc.side] || 'OTHER') + ' doc' + (sp ? ' for ' + sp : '') + ': ' + doc.name;
  }

  // Turns stored docs into Claude content blocks. PDFs go as native document blocks;
  // Word and text files go as text. The last block gets a cache mark so repeat calls
  // during the round reuse the docs instead of paying for them again.
  function buildDocBlocks(docs, fmt) {
    const blocks = [];
    for (const d of docs || []) {
      if (!d || !d.data) continue;
      if (d.kind === 'pdf') {
        blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.data }, title: docTitle(d, fmt) });
      } else {
        blocks.push({ type: 'text', text: '=== ' + docTitle(d, fmt) + ' ===\n' + d.data });
      }
    }
    if (blocks.length) blocks[blocks.length - 1] = Object.assign({}, blocks[blocks.length - 1], { cache_control: { type: 'ephemeral' } });
    return blocks;
  }

  function buildUserContent(docs, promptText, note, fmt) {
    const blocks = buildDocBlocks(docs, fmt);
    if (!blocks.length) return promptText;
    return blocks.concat([{ type: 'text', text: (note || DOC_NOTE) + '\n\n' + promptText }]);
  }

  const api = { parseSpeechDropCode, speechDropFiles, guessSpeech, speechSide, anonymize, deanonymize, isRoundEmpty,
    buildRoundFile, parseRoundFile, roundFileName, KEYS_ENTRY, OLD_KEY_ENTRIES, buildBackup, parseBackup,
    backupSummary, DOC_SIDES, DOC_NOTE, docSpeech, docsForSpeech, DOC_FLOW_NOTE, docTitle, buildDocBlocks,
    buildUserContent };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).files = api;
})(typeof window !== 'undefined' ? window : globalThis);
