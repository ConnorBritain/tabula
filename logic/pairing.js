// Round import by paste: the judge copies their round from the tournament site (their judge page or the posted
// pairings) and pastes the text into Round setup. This part reads that text into round fields. It never fetches
// anything: the text comes only from the judge's own paste, and it stays in this browser (docs/research/TABROOM.md,
// Option D).
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';

  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');

  // A paste longer than this is not one round (a whole results page, a doc). Read only the start.
  const PASTE_MAX = 20000;
  // The words a site uses for each side. All the side patterns below are built from these two lists.
  const AFF_WORDS = ['aff', 'affirmative', 'gov', 'government', 'prop', 'proposition', 'pro'];
  const NEG_WORDS = ['neg', 'negative', 'opp', 'opposition', 'con'];
  const AFF_WORD = new RegExp('^(' + AFF_WORDS.join('|') + ')$', 'i');
  const NEG_WORD = new RegExp('^(' + NEG_WORDS.join('|') + ')$', 'i');
  const SIDE_WORDS = AFF_WORDS.concat(NEG_WORDS).join('|');
  // "Aff: Lexington AB", "AFF - Lexington AB", "Aff Lexington AB" or a bare "Aff" with the entry on the next lines.
  const SIDE_LINE = new RegExp('^(' + SIDE_WORDS + ')\\b\\s*(?:[:\\-–—|]\\s*)?(.*)$', 'i');
  // "Lexington AB (Aff)" or "Lexington AB - NEG".
  const SIDE_AFTER = new RegExp('^(.+?)\\s*(?:\\((' + SIDE_WORDS + ')\\)|[-–—|]\\s*(' + SIDE_WORDS + '))$', 'i');
  const FLIP_WORDS = /\s*[-–—(|]?\s*\b(?:flip(?:\s+for\s+sides)?|coin\s+(?:toss|flip))\b\s*\)?/gi;
  const VS_LINE = /^(.+?)\s+(?:vs\.?|v\.)\s+(.+)$/i;
  const LABEL_LINE = /^(tournament|round|judge|room|event|division|start|time|flight)\s*[:\-–—]\s*(.*)$/i;
  const ROUND_WORDS = /\b(round\s*\d+|r\d{1,2}|(?:double|triple)[- ]?octa?finals?|(?:double|triple)[- ]?octos|doubles|triples|octa?finals?|octos|quarter[- ]?finals?|quarters|semi[- ]?finals?|semis|finals?|partials)\b/i;
  const TOURNAMENT_WORDS = /\b(invitational|tournament|classic|championships?|swing|open|toc|nationals?|round robin)\b/i;
  // Pronouns stay on the tournament site: "(she/her)", "[they/them]". The import never copies them.
  // Spaces and commas inside the brackets count too: "(he / him)", "(She, Her)".
  const PRONOUN_WORD = '(?:she|her|hers|he|him|his|they|them|theirs|ze|zir|xe|xem|ey|em|it|its|any|all)';
  const PRONOUNS = new RegExp('\\s*[([]\\s*' + PRONOUN_WORD + '(?:\\s*[/,]\\s*' + PRONOUN_WORD + ')+\\s*[)\\]]', 'gi');
  // A line that is only pronouns ("She Her", "they/them") is not a name.
  const PRONOUN_LINE = new RegExp('^\\s*[([]?\\s*' + PRONOUN_WORD + '(?:\\s*[/,\\s]\\s*' + PRONOUN_WORD + ')+\\s*[)\\]]?\\s*$', 'i');
  // Words in notes about a student (accommodations, requests). A line with one of them is never read as a name
  // (TABROOM.md §2.2). This list is best effort: no list catches every note. The real guard is the page, which shows
  // each found field with a tick box, so the judge unticks anything that is not a name before filling the round.
  const NOTE_WORDS = /\b(accommodations?|extra|time|needs?|needed|notes?|interpreter|quiet|access(?:ible|ibility)?|wheelchair|seating|seat|allerg\w*|medical|breaks?|ada|iep|504|requests?|requested|please|only|required?|hearing|vision|large print|mobility|service|dog|animal|autism|autistic|spectrum|adhd|deaf|blind|sees|speaks|slowly|poorly|stutter\w*|anxiety|disabilit\w*|support|aide|device|light|sound|noise)\b/i;
  // A person's name: two to four words that each start with a capital letter, with no digits.
  const NAME = /^\p{Lu}[\p{L}'’.-]*(?:\s+\p{Lu}[\p{L}'’.-]*){1,3}$/u;
  const NAME_SPLIT = /\s*(?:&|\+|\/|;|,|\band\b)\s*/i;

  const clean = (s) => String(s || '').replace(PRONOUNS, '').replace(/\s+/g, ' ').trim();
  const looksLikeName = (s) => NAME.test(s) && !PRONOUN_LINE.test(s) && !NOTE_WORDS.test(s) && !SIDE_LINE.test(s) && !LABEL_LINE.test(s) && !ROUND_WORDS.test(s);
  const emptySide = () => ({ team: '', d1: '', d2: '' });

  // One entry: "Lexington AB: Alex Smith & Bo Jones", "Lexington AB (Alex Smith, Bo Jones)",
  // "Lexington AB<tab>Alex Smith and Bo Jones", or just "Lexington AB". The names may also be on the next lines.
  function readEntry(text, nextLines, slots) {
    const raw = String(text || '');
    const nameList = (x) => x.split(NAME_SPLIT).map(clean).filter(Boolean);
    let team = '', names = [];
    const paren = /^(.+?)\s*\(([^()]+)\)$/.exec(clean(raw));
    if (paren && nameList(paren[2]).length && nameList(paren[2]).every(looksLikeName)) { team = clean(paren[1]); names = nameList(paren[2]); }
    else {
      // Any other bracket is a note (pronouns, an accommodation) and is dropped. It becomes a ";" break, so
      // "Alex Smith (she/her) Bo Jones" stays two names. Bracket text never reaches the team code or a name.
      const t = raw.replace(PRONOUNS, ' ; ').replace(/\s*[([][^()[\]]*[)\]]/g, ' ; ').trim();
      const split = /^(.+?)\s*(?:\t|[:–—|]|\s-\s|\s{2,})\s*(.+)$/.exec(t);
      const bare = (x) => clean(x.replace(/;/g, ' '));
      if (split) {
        team = bare(split[1]);
        // The names after the code. Text after a dash in a name ("Alex Smith - Extra Time") is a note and is cut off;
        // reading stops at the first part that is not a name, so a note never becomes a debater.
        for (const p of split[2].split(NAME_SPLIT)) {
          const n = clean(p.split(/\s[-–—]\s/)[0]);
          if (!n) continue;
          if (!looksLikeName(n)) break;
          names.push(n);
        }
        if (!names.length) team = bare(t);
      } else team = bare(t);
    }
    let used = 0;
    if (!names.length) {
      // The names on the lines under the entry, one per line or joined on one line.
      for (const line of nextLines) {
        if (names.length >= slots.length) break;
        if (PRONOUN_LINE.test(line)) { used++; continue; } // a pronoun line under a name: skip it, keep reading
        const parts = String(line).replace(PRONOUNS, ' ; ').split(NAME_SPLIT).map(clean).filter(Boolean);
        if (!parts.length || !parts.every(looksLikeName)) break;
        names.push(...parts); used++;
      }
    }
    const side = emptySide();
    side.team = team;
    names.map(clean).filter(Boolean).slice(0, slots.length).forEach((n, i) => { side[slots[i]] = n; });
    return { side, used };
  }

  // A table copied from the pairings: a header row with Aff and Neg columns (and maybe Round, Room, Judge), then the
  // judge's row. Returns null when there is no such header.
  function readTable(lines) {
    const cells = (line) => line.split(/\t|\s{2,}|\s\|\s/).map((c) => c.trim());
    for (let i = 0; i < lines.length - 1; i++) {
      const head = cells(lines[i]);
      const a = head.findIndex((c) => AFF_WORD.test(c)), n = head.findIndex((c) => NEG_WORD.test(c));
      if (a < 0 || n < 0) continue;
      const row = cells(lines[i + 1]);
      if (row.length <= Math.max(a, n)) continue;
      const col = (re) => { const k = head.findIndex((c) => re.test(c)); return k >= 0 && row[k] ? row[k] : ''; };
      return { aff: row[a], neg: row[n], round: col(/^round$/i), judge: col(/^judges?$/i), room: col(/^room$/i), flight: col(/^flight$/i), rows: [i, i + 1] };
    }
    return null;
  }

  // text: what the judge pasted. fmt: the round's format (how many names a side has).
  // Returns { tournament, roundName, judge, room, start, flight, aff: { team, d1, d2 }, neg: { team, d1, d2 }, sidesKnown,
  // flip } with ''
  // for what the text does not say. sidesKnown is false when the text names two entries but not which side is which
  // (a "Team A vs Team B" line): the first one is read as Aff, and the judge should check.
  function parseRoundPaste(text, fmt) {
    const f = fmt || F.getFormat(F.DEFAULT_FORMAT_ID);
    const slotsOf = (side) => F.speakersOn(f, side).map((s) => s.slot);
    const raw = String(text || '').slice(0, PASTE_MAX).replace(/\r\n?/g, '\n').replace(/ /g, ' ');
    const lines = raw.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim());
    const out = { tournament: '', roundName: '', judge: '', room: '', start: '', flight: '', aff: emptySide(), neg: emptySide(), sidesKnown: false, flip: /\b(flip|coin (?:toss|flip))\b/i.test(raw) };
    const done = new Set();
    const setSide = (key, entry) => { if (!out[key].team && !out[key].d1) out[key] = entry; };

    const table = readTable(lines);
    if (table) {
      setSide('aff', readEntry(table.aff, [], slotsOf('aff')).side);
      setSide('neg', readEntry(table.neg, [], slotsOf('neg')).side);
      out.sidesKnown = true;
      if (table.round) out.roundName = clean(table.round);
      if (table.judge) out.judge = clean(table.judge);
      if (table.room) out.room = clean(table.room);
      if (table.flight) out.flight = clean(table.flight);
      table.rows.forEach((r) => done.add(r));
    }

    lines.forEach((line, i) => {
      if (done.has(i)) return;
      const l = line.trim();
      const label = LABEL_LINE.exec(l);
      if (label) {
        const key = label[1].toLowerCase(), val = clean(label[2]);
        if (key === 'tournament' && val) out.tournament ||= val;
        else if (key === 'round' && val) out.roundName ||= val;
        else if (key === 'judge' && val) out.judge ||= val;
        else if (key === 'room' && val) out.room ||= val;
        else if ((key === 'start' || key === 'time') && val) out.start ||= val;
        else if (key === 'flight' && val) out.flight ||= val;
        done.add(i);
        return;
      }
      const after = SIDE_AFTER.exec(l);
      const side = SIDE_LINE.exec(l);
      if (side || after) {
        const word = side ? side[1] : (after[2] || after[3]);
        const key = AFF_WORD.test(word) ? 'aff' : 'neg';
        const rest = side ? side[2] : after[1];
        // Room for each name plus a pronoun line under it.
        const next = lines.slice(i + 1, i + 6).filter((_, k) => !done.has(i + 1 + k));
        // A bare "Aff" line: the entry code is on the next line (unless that line is the other side), and the names may follow it.
        const codeBelow = next[0] && !SIDE_LINE.test(next[0].trim()) ? next[0] : '';
        const { side: entry, used } = rest.trim() ? readEntry(rest, next, slotsOf(key)) : readEntry(codeBelow, lines.slice(i + 2, i + 7), slotsOf(key));
        if (entry.team || entry.d1) {
          setSide(key, entry);
          out.sidesKnown = true;
          done.add(i);
          for (let k = 1; k <= used + (rest.trim() ? 0 : 1); k++) done.add(i + k);
        }
        return;
      }
      const vs = VS_LINE.exec(l);
      if (vs && !out.aff.team && !out.neg.team) {
        setSide('aff', readEntry(vs[1], [], slotsOf('aff')).side);
        setSide('neg', readEntry(vs[2], [], slotsOf('neg')).side);
        done.add(i);
      }
    });

    // The round and the tournament from unlabelled lines: the first short line that names a round, and the first line
    // that names a tournament.
    lines.forEach((line, i) => {
      if (done.has(i)) return;
      const l = clean(line);
      if (!out.roundName && ROUND_WORDS.test(l)) { out.roundName = l.length <= 40 ? l : l.match(ROUND_WORDS)[0]; done.add(i); return; }
      if (!out.tournament && TOURNAMENT_WORDS.test(l) && l.length <= 80) { out.tournament = l; done.add(i); }
    });
    // "Round 4 - Flip for sides": the flip is a note for the judge, not part of the round's name.
    out.roundName = out.roundName.replace(FLIP_WORDS, ' ').replace(/[\s\-–—:|]+$/, '').trim();
    return out;
  }

  // The round fields the paste would fill, as [{ path, label, value, old }]. Only fields the paste found; old is the
  // value in the round now ('' when empty), so the page can say what gets replaced. opts.details: also room, start
  // time and flight (the page passes its roundDetails flag; with the flag off the round card has no boxes for them).
  function roundPasteChanges(round, parsed, fmt, opts) {
    const f = fmt || F.formatOf(round || {});
    const r = round || {};
    const rows = [
      ['tournament', 'Tournament', parsed.tournament, r.tournament],
      ['roundName', 'Round', parsed.roundName, r.roundName],
      ['judge', 'Judge', parsed.judge, r.judge],
    ];
    if (opts && opts.details) rows.push(['room', 'Room', parsed.room, r.room], ['start', 'Start time', parsed.start, r.start], ['flight', 'Flight', parsed.flight, r.flight]);
    for (const side of ['aff', 'neg']) {
      const word = f.sides[side].label;
      rows.push([side + '.team', word + ' team code', parsed[side].team, (r[side] || {}).team]);
      const on = F.speakersOn(f, side);
      for (const sp of on) rows.push([side + '.' + sp.slot, on.length > 1 ? sp.label : word + ' debater', parsed[side][sp.slot], (r[side] || {})[sp.slot]]);
    }
    return rows.filter((x) => x[2]).map(([path, label, value, old]) => ({ path, label, value, old: String(old || '') }));
  }

  // The round with Aff and Neg swapped (team codes and names), for a coin flip or a paste that had the sides backwards.
  function swapSides(round) {
    return { ...round, aff: { ...emptySide(), ...(round.neg || {}) }, neg: { ...emptySide(), ...(round.aff || {}) } };
  }

  const api = { parseRoundPaste, roundPasteChanges, swapSides };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).pairing = api;
})(typeof window !== 'undefined' ? window : globalThis);
