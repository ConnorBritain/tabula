// Decide and ballot (Slice 4): field groups and states, the draft panel and review, ranks and points, saved
// ballots, the decision text, printing, and the Decide summaries.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');
  const { formatClock, BALLOT_HEADER, LOG_SLOTS, ballotRow, num, ballotFields, speechesSoFar, ptsRange } = part('round');
  const { speechSide } = part('files');

  // ---------- Slice 4: Decide and ballot (docs/design/SPEC.md §3.4) ----------

  // 4.2 Field groups. Fields are the BALLOT_FIELDS paths. The picker in the draft panel has five groups; the tags on
  // the ballot have one per speaker row (points and rank together).
  // fmt: the round's format (policy-hs when not given). A format with no speaker ranks has points fields only.
  const ptsFields = (fmt) => { const f = fmt || F.POLICY; return f.speakerIds.flatMap((s) => (f.ballot.speakerRanks ? ['pts.' + s, 'ranks.' + s] : ['pts.' + s])); };
  const draftGroups = (fmt) => {
    const f = fmt || F.POLICY;
    return [
      { id: 'winner', label: 'Winner', fields: ['winner'] },
      { id: 'pts', label: f.ballot.speakerRanks ? 'Points and ranks' : 'Points', fields: ptsFields(f) },
      { id: 'rfd', label: 'Reason for decision', fields: ['rfd'] },
      { id: 'affFb', label: 'Aff comments', fields: ['affFb'] },
      { id: 'negFb', label: 'Neg comments', fields: ['negFb'] },
    ];
  };
  // Deprecated aliases (policy, old callers and tests): page code calls ptsFields(FMT()) and draftGroups(FMT()).
  const PTS_FIELDS = ptsFields(F.POLICY);
  const DRAFT_GROUPS = draftGroups(F.POLICY);
  const FIELD_LABELS = { winner: 'the winner', rfd: 'the reason for decision', affFb: 'the Aff comments', negFb: 'the Neg comments' };
  function fieldLabel(f, fmt) {
    if (FIELD_LABELS[f]) return FIELD_LABELS[f];
    const fm = fmt || F.POLICY;
    const [a, s] = String(f).split('.');
    const sp = F.speakerOf(fm, s);
    const name = sp ? sp.label : s;
    if (a === 'row') return name + (fm.ballot.speakerRanks ? ' points and rank' : ' points');
    return name + (a === 'pts' ? ' points' : ' rank');
  }
  function fieldValue(ballot, f) {
    const b = ballot || {};
    const [a, k] = String(f).split('.');
    return k ? (b[a] || {})[k] : b[a];
  }
  const isEmptyValue = (v) => v == null || String(v).trim() === '';
  // One state per field: 'yours' (the judge typed it; the AI will not change it), 'empty', or 'ai' (an AI draft, or
  // a value the AI may change). For a list of fields: yours if any is yours, else ai if any has a value, else empty.
  function fieldState(ballot, fields) {
    const b = ballot || {};
    const list = [].concat(fields);
    const one = (f) => ((b.touched || {})[f] ? 'yours' : isEmptyValue(fieldValue(b, f)) ? 'empty' : 'ai');
    const states = list.map(one);
    if (states.includes('yours')) return 'yours';
    return states.includes('ai') ? 'ai' : 'empty';
  }
  // Moves fields between the two sets. kind: 'yours' (an edit or an insert), 'ai' (an auto refill), 'free' (unlock).
  // Returns a new ballot; the old one is not changed.
  function markFields(ballot, fields, kind) {
    const b = ballotSnapshot(ballot);
    b.touched = Object.assign({}, b.touched); b.aiFilled = Object.assign({}, b.aiFilled);
    for (const f of [].concat(fields)) {
      if (kind === 'yours') { b.touched[f] = true; delete b.aiFilled[f]; }
      else if (kind === 'ai') { b.aiFilled[f] = true; delete b.touched[f]; }
      else delete b.touched[f];
    }
    return b;
  }
  // A deep copy of the ballot for Undo; later edits never reach the copy.
  function ballotSnapshot(ballot) { return JSON.parse(JSON.stringify(ballot || {})); }

  // 4.3 Is there anything to draft from? At least one speech, flow note or doc.
  function roundHasContent(round, docs) {
    const r = round || {};
    if ((docs || []).length) return true;
    if (Object.values(r.transcripts || {}).some((t) => String(t || '').trim())) return true;
    if ((r.flows || []).some((f) => Object.values(f.cells || {}).some((c) => String(c || '').trim()))) return true;
    return (r.aiFlows || []).some((sh) => Object.keys(sh.parts || {}).length > 0);
  }
  // Insights and Live Eval have something to read (CHANGED 2026-11-20, owner: "how can you drive updates when the round
  // hasn't been started or set up?"). The round is started, and a speech clock has run, or there is flow text, a
  // transcript, a mapped doc or an AI flow part. Before that, no Update button shows and no Live Eval runs.
  function insightsReady(round, docs) {
    const r = round || {};
    if (!r.started) return false;
    return Boolean(r.run) || speechesSoFar(r).length > 0 || roundHasContent(r, docs);
  }
  // Which state the draft panel shows (4.3 table). busy wins, then the reasons Draft cannot run.
  function draftPanelState(o) {
    const x = o || {};
    if (x.busy) return 'loading';
    if (!x.aiReady) return 'noAI';
    if (x.offline) return 'offline';
    if (!x.hasContent) return 'empty';
    if (!x.picked) return 'nothing';
    if (x.error) return 'error';
    if (x.stopped) return 'stopped';
    return 'ready';
  }
  // Feedback from the Live Eval, as prompt lines for the comments (4.3, 4.13).
  function feedbackLines(feedback) {
    return (feedback || []).filter((f) => f && f.speaker && !/^not yet/i.test(f.points || ''))
      .map((f) => f.speaker + ': ' + (f.so_far || '') + ' Did well: ' + (f.strength || '') + ' To work on: ' + (f.fix || ''));
  }
  // AI points outside the range: these are never inserted (4.4).
  function outOfRangePoints(draft, range, fmt) {
    const r = ptsRange(range);
    const pts = (draft && draft.points) || {};
    return (fmt || F.POLICY).speakerIds.filter((s) => typeof pts[s] === 'number' && (pts[s] < r.min || pts[s] > r.max)).map((s) => ({ speaker: s, value: Math.round(pts[s] * 10) / 10 }));
  }
  // The value the AI draft has for one field, in ballot form (points to one decimal, ranks as text).
  function draftValue(draft, f) {
    const d = draft || {};
    const [a, k] = String(f).split('.');
    if (a === 'pts') { const n = (d.points || {})[k]; return typeof n === 'number' && isFinite(n) ? Math.round(n * 10) / 10 : undefined; }
    if (a === 'ranks') { const n = (d.ranks || {})[k]; return n != null ? String(n) : undefined; }
    return { winner: d.winner, rfd: d.rfd, affFb: d.aff_comments, negFb: d.neg_comments }[a];
  }
  // 4.4 A word diff for a "Yours" card: same / del / ins runs. Whitespace stays with its word.
  function wordDiff(a, b) {
    const ta = String(a || '').match(/\S+\s*|\s+/g) || [], tb = String(b || '').match(/\S+\s*|\s+/g) || [];
    const n = ta.length, m = tb.length;
    const norm = (t) => t.trim();
    const out = [];
    const push = (op, text) => { const last = out[out.length - 1]; if (last && last.op === op) last.text += text; else out.push({ op, text }); };
    // Very long texts: no word-by-word diff (it would be slow); show the old text removed and the new one added.
    if (n * m > 4000000) { if (n) push('del', ta.join('')); if (m) push('ins', tb.join('')); return out; }
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = norm(ta[i]) === norm(tb[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (norm(ta[i]) === norm(tb[j])) { push('same', tb[j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', ta[i++]);
      else push('ins', tb[j++]);
    }
    while (i < n) push('del', ta[i++]);
    while (j < m) push('ins', tb[j++]);
    return out;
  }

  // 4.4 The review: one card per picked group. A "yours" card starts on "Keep mine"; others start on "Insert this".
  // Each card remembers the ballot values it was made against (base), so an edit during the review shows.
  function reviewCard(ballot, draft, group, range, fmt) {
    const state = fieldState(ballot, group.fields);
    const base = Object.fromEntries(group.fields.map((f) => [f, fieldValue(ballot, f) ?? '']));
    const after = Object.fromEntries(group.fields.map((f) => [f, draftValue(draft, f) ?? '']));
    // A card with no AI text has nothing to insert, so it does not start ticked ("empty": the panel shows no choice).
    const empty = group.fields.every((f) => isEmptyValue(after[f]));
    const card = { id: group.id, label: group.label, fields: group.fields.slice(), state, base, after, choice: state === 'yours' || empty ? 'keep' : 'insert', changed: false, empty };
    if (group.id === 'pts') card.outOfRange = outOfRangePoints(draft, range, fmt);
    if (['rfd', 'affFb', 'negFb'].includes(group.id) && state === 'yours') card.diff = wordDiff(base[group.id], after[group.id]);
    return card;
  }
  // opts.format: the round's format (policy-hs when not given).
  function reviewFromDraft(ballot, draft, opts) {
    const o = opts || {};
    const groups = draftGroups(o.format);
    const picks = o.picks || groups.map((g) => g.id);
    const range = ptsRange(o.range);
    const cards = groups.filter((g) => picks.includes(g.id)).map((g) => reviewCard(ballot, draft, g, range, o.format));
    return { at: o.at || 0, through: (o.through || []).slice(), range, picks: picks.slice(), draft, cards };
  }
  // A field the judge changed while the review waits: the card says "Changed since the draft", gets a fresh diff
  // against the new text, and goes back to "Keep mine" (the judge's newer text wins until they choose).
  function staleReviewCards(review, ballot) {
    if (!review) return review;
    const cards = review.cards.map((c) => {
      const now = Object.fromEntries(c.fields.map((f) => [f, fieldValue(ballot, f) ?? '']));
      const moved = c.fields.some((f) => String(now[f]) !== String(c.base[f]));
      if (!moved) return c;
      const n = Object.assign({}, c, { base: now, changed: true, state: 'yours', choice: 'keep' });
      if (['rfd', 'affFb', 'negFb'].includes(c.id)) n.diff = wordDiff(now[c.id], c.after[c.id]);
      return n;
    });
    return Object.assign({}, review, { cards });
  }
  // Does an insert take this card? all = "Accept all": every card that is not on "Keep mine".
  const reviewTakes = (c, all) => c.choice !== 'keep' && (all || c.choice !== 'skip');
  // The fields an insert writes.
  function reviewInsertFields(review, all) {
    return ((review && review.cards) || []).filter((c) => reviewTakes(c, all)).flatMap((c) => c.fields);
  }
  // 4.4 Insert from the review: the chosen cards' AI text goes into the ballot and becomes "yours". AI points outside
  // the range are skipped. all = "Accept all" (never flips "Keep mine"). Returns { ballot, fields, count } (count = cards).
  // "Review never overwrites Yours" is checked here too, not only by staleReviewCards: a field whose text changed
  // since the card was made, or that became "yours" after a card that was not, is skipped. Only a card that was
  // already "yours" and that the judge set to "Use AI text" may replace the judge's text.
  function applyReview(ballot, review, all) {
    let b = ballotSnapshot(ballot);
    b.pts ??= {}; b.ranks ??= {};
    const fields = [];
    let count = 0;
    for (const c of (review && review.cards) || []) {
      if (!reviewTakes(c, all)) continue;
      const bad = new Set((c.outOfRange || []).map((x) => 'pts.' + x.speaker));
      let wrote = false;
      for (const f of c.fields) {
        const v = c.after[f];
        if (bad.has(f) || isEmptyValue(v)) continue;
        if (String(fieldValue(ballot, f) ?? '') !== String((c.base || {})[f] ?? '')) continue; // changed since the card
        if (c.state !== 'yours' && fieldState(ballot, f) === 'yours') continue; // became "yours" after the card
        const [a, k] = f.split('.');
        if (k) b[a][k] = v; else b[a] = v;
        fields.push(f); wrote = true;
      }
      if (wrote) count++;
    }
    b = markFields(b, fields, 'yours');
    return { ballot: b, fields, count };
  }
  // 4.6 Auto refill: empty fields are written at once (as AI text); an AI field with a value the draft would change
  // goes to review; a "yours" field is never touched. Returns { write: [fields], review: [group ids] }.
  function autoRefillPlan(ballot, draft, range, fmt) {
    const bad = new Set(outOfRangePoints(draft, range, fmt).map((x) => 'pts.' + x.speaker));
    const write = ballotFields(fmt).filter((f) => fieldState(ballot, f) === 'empty' && !bad.has(f) && !isEmptyValue(draftValue(draft, f)));
    const review = draftGroups(fmt).filter((g) => g.fields.some((f) => fieldState(ballot, f) === 'ai' && !isEmptyValue(draftValue(draft, f)) && String(draftValue(draft, f)) !== String(fieldValue(ballot, f)))).map((g) => g.id);
    return { write, review };
  }
  // Did a speech end after this draft? (the review then offers [Redo all]).
  function speechEndedSince(review, round) {
    if (!review) return false;
    const now = speechesSoFar(round);
    return now.some((id) => !(review.through || []).includes(id));
  }

  const ranksSet = (ballot, fmt) => (fmt || F.POLICY).speakerIds.filter((s) => !isEmptyValue(((ballot || {}).ranks || {})[s])).length;

  // 4.8 Picking a rank another speaker has moves it: that speaker loses it. Returns the new ranks and the message.
  function moveRank(ranks, speaker, rank, fmt) {
    const out = Object.assign({}, ranks || {});
    const r = rank == null || rank === '' ? '' : String(rank);
    let moved = null;
    if (r) for (const s of (fmt || F.POLICY).speakerIds) if (s !== speaker && String(out[s] ?? '') === r) { out[s] = ''; moved = { rank: r, from: s, to: speaker }; }
    out[speaker] = r;
    return { ranks: out, moved, message: moved ? 'Rank ' + moved.rank + ' moved from ' + moved.from + ' to ' + moved.to + '.' : '' };
  }
  // 4.8 The − and + buttons: steps of 0.1 inside the range. An empty box starts near the top of the range.
  function stepPoints(value, dir, range) {
    const r = ptsRange(range);
    const v = num(value);
    if (Number.isNaN(v)) return Math.round(r.min + (r.max - r.min) * 0.6);
    const next = Math.round((v + (dir < 0 ? -0.1 : 0.1)) * 10) / 10;
    return Math.min(r.max, Math.max(r.min, next));
  }

  // 4.12 A saved ballot: the spreadsheet row, plus one object at the end with what the row has no column for
  // (the range, the comments and the format). Old saved ballots have no object: they show with no range check, and
  // an entry with no format is a policy ballot.
  function savedBallotEntry(round, savedAt, range) {
    const b = round.ballot || {};
    return ballotRow(round, savedAt).concat([Object.assign({ ptsRange: ptsRange(range), affFb: b.affFb || '', negFb: b.negFb || '' }, F.formatFields(F.formatOf(round)))]);
  }
  const savedBallotRow = (entry) => (entry || []).slice(0, BALLOT_HEADER.length);
  function savedBallotView(entry) {
    const e = entry || [];
    const meta = e.length > BALLOT_HEADER.length && e[BALLOT_HEADER.length] && typeof e[BALLOT_HEADER.length] === 'object' ? e[BALLOT_HEADER.length] : null;
    const col = (name) => e[BALLOT_HEADER.indexOf(name)] ?? '';
    const fields = meta && meta.format ? { format: meta.format, formatVersion: meta.formatVersion } : {};
    const fmt = F.formatOf(fields);
    // The four column groups, named as in the header ('1A' ... '2N'), in LOG_SLOTS order.
    const groups = ['1A', '2A', '1N', '2N'];
    const pts = {}, ranks = {};
    LOG_SLOTS.forEach(([side, slot], i) => {
      const sp = fmt.speakers.find((x) => x.side === side && x.slot === slot);
      if (sp) { pts[sp.id] = col(groups[i] + ' pts'); ranks[sp.id] = col(groups[i] + ' rank'); }
    });
    return {
      savedAt: col('Saved at'),
      round: Object.assign({ tournament: col('Tournament'), roundName: col('Round'), judge: col('Judge'), topic: col('Topic'),
        aff: { team: col('Aff team'), d1: col('1A'), d2: col('2A') }, neg: { team: col('Neg team'), d1: col('1N'), d2: col('2N') },
        ballot: { winner: String(col('Winner')).toLowerCase(), pts, ranks, rfd: col('RFD'), affFb: meta ? meta.affFb : '', negFb: meta ? meta.negFb : '' } }, fields),
      ptsRange: meta ? ptsRange(meta.ptsRange) : null,
    };
  }

  // The History export (Download CSV, Copy for Google Sheets) and the History table: { header, rows, formats }, one row
  // per saved ballot, in log order. The saved entries keep their old layout (above); this only shapes what a coach sees.
  // The speaker columns are named by each ballot's own format ('1A pts' in policy, 'Aff pts' in LD), and a Format
  // column names the format. A mixed history stays one flat table, because one table is what a spreadsheet can sort
  // and filter: it has the columns of every format in it, side by side under each side's team, and a row fills only its
  // own format's columns. A policy-only history gives the old columns in the old places, with Format added at the end,
  // so a coach's existing sheet still lines up.
  // The columns that are the same in every format, read straight from the saved row.
  const ROUND_COLS = ['Saved at', 'Tournament', 'Round', 'Judge', 'Topic', 'Aff team', 'Neg team', 'Winner', 'Winning team', 'RFD'];
  function historyTable(log) {
    const entries = (log || []).map((e) => e || []);
    const views = entries.map(savedBallotView);
    const fmtOf = views.map((v) => F.formatOf(v.round));
    const order = (f) => F.FORMAT_FILES.indexOf(f.id + '.v' + f.version);
    const formats = [...new Map(fmtOf.map((f) => [f.key, f])).values()].sort((a, b) => order(a) - order(b));
    // A speaker's columns: the name, the points, and the rank when the format has ranks. Same name, same column.
    const speakerCols = (f, sp) => [sp.label, sp.label + ' pts'].concat(f.ballot.speakerRanks ? [sp.label + ' rank'] : []);
    const sideCols = (side) => [...new Set(formats.flatMap((f) => F.speakersOn(f, side).flatMap((sp) => speakerCols(f, sp))))];
    const header = ['Saved at', 'Tournament', 'Round', 'Judge', 'Topic', 'Aff team', ...sideCols('aff'), 'Neg team', ...sideCols('neg'),
      'Winner', 'Winning team', 'RFD', 'Format'];
    const rows = entries.map((e, i) => {
      const v = views[i], f = fmtOf[i], b = v.round.ballot;
      const cells = {};
      for (const name of ROUND_COLS) cells[name] = e[BALLOT_HEADER.indexOf(name)];
      for (const sp of f.speakers) {
        const [n, p, r] = speakerCols(f, sp);
        cells[n] = F.speakerName(v.round, sp); cells[p] = b.pts[sp.id];
        if (r) cells[r] = b.ranks[sp.id];
      }
      cells.Format = f.name;
      return header.map((name) => cells[name] ?? '');
    });
    return { header, rows, formats };
  }
  // The History table's columns (indexes into historyTable's header): who and when, the winner, every points column,
  // and the format when the history mixes formats.
  function historyColumns(table) {
    const names = ['Saved at', 'Round', 'Aff team', 'Neg team', 'Winner', ...table.header.filter((h) => h.endsWith(' pts'))]
      .concat(table.formats.length > 1 ? ['Format'] : []);
    return names.map((n) => table.header.indexOf(n));
  }

  // 4.11 The four blocks a judge pastes into the tournament's ballot site.
  function decisionText(round) {
    const b = round.ballot || {};
    const fmt = F.formatOf(round);
    const lines = [];
    if (b.winner === 'aff' || b.winner === 'neg') {
      const team = b.winner === 'aff' ? (round.aff || {}).team : (round.neg || {}).team;
      lines.push((b.winner === 'aff' ? 'Aff' : 'Neg') + (team ? ' (' + team + ')' : '') + ' wins.');
    }
    for (const sp of fmt.speakers) {
      const s = sp.id;
      const p = (b.pts || {})[s], r = (b.ranks || {})[s];
      if (isEmptyValue(p) && isEmptyValue(r)) continue;
      const nm = F.speakerName(round, sp);
      lines.push(sp.label + (nm ? ' ' + nm : '') + ': ' + (isEmptyValue(p) ? 'no points' : p + ' points') + (isEmptyValue(r) ? '' : ', rank ' + r));
    }
    return lines.join('\n');
  }
  function tournamentBlocks(round) {
    const b = (round && round.ballot) || {};
    return [
      { id: 'decision', label: 'Decision', text: decisionText(round || {}) },
      { id: 'rfd', label: 'Reason for decision', text: String(b.rfd || '').trim() },
      { id: 'affFb', label: 'Aff comments', text: String(b.affFb || '').trim() },
      { id: 'negFb', label: 'Neg comments', text: String(b.negFb || '').trim() },
    ];
  }

  // 4.10 What the print sheet holds. Long text prints in full (the sheet is built from data, not the boxes on screen).
  // opts: { flow, transcripts, aiNotes, range (null = no range), liveEval, analysis }.
  function printModel(round, opts) {
    const o = opts || {};
    const r = round || {};
    const b = r.ballot || {};
    const fmt = F.formatOf(r);
    const range = o.range === null ? null : ptsRange(o.range);
    const title = ['Ballot', r.roundName].filter(Boolean).join(' · ');
    const sections = [];
    sections.push({ kind: 'facts', items: [['Tournament', r.tournament || ''], ['Round', r.roundName || ''], ['Judge', r.judge || ''], ['Resolution', r.topic || '']].filter(([, v]) => v) });
    const team = b.winner === 'aff' ? (r.aff || {}).team : b.winner === 'neg' ? (r.neg || {}).team : '';
    sections.push({ kind: 'winner', title: 'Decision', text: b.winner === 'aff' || b.winner === 'neg' ? (b.winner === 'aff' ? 'Aff' : 'Neg') + (team ? ' (' + team + ')' : '') + ' wins' : 'No winner picked' });
    const pointsTitle = (range ? 'Points (' + range.min + '–' + range.max + ')' : 'Points') + (fmt.ballot.speakerRanks ? ' and ranks' : '');
    sections.push({ kind: 'speakers', title: pointsTitle, ranks: fmt.ballot.speakerRanks,
      rows: fmt.speakers.map((sp) => ({ speaker: sp.label, side: sp.side, name: F.speakerName(r, sp), pts: (b.pts || {})[sp.id] ?? '', rank: (b.ranks || {})[sp.id] ?? '' })) });
    sections.push({ kind: 'text', title: 'Reason for decision', text: String(b.rfd || '') });
    sections.push({ kind: 'text', title: 'Aff comments' + ((r.aff || {}).team ? ' (' + r.aff.team + ')' : ''), side: 'aff', text: String(b.affFb || '') });
    sections.push({ kind: 'text', title: 'Neg comments' + ((r.neg || {}).team ? ' (' + r.neg.team + ')' : ''), side: 'neg', text: String(b.negFb || '') });
    if (o.flow) {
      for (const f of r.flows || []) {
        const cols = fmt.flowColumns.map((c, i) => ({ label: c.label, side: c.side, text: String((f.cells || {})[i] || '') }));
        if (cols.some((c) => c.text.trim())) sections.push({ kind: 'flow', title: 'Flow: ' + f.name, cols });
      }
    }
    if (o.transcripts) {
      for (const s of fmt.speeches) {
        const t = String((r.transcripts || {})[s.id] || '').trim();
        if (t) sections.push({ kind: 'text', title: 'Transcript: ' + s.label, side: s.side, text: t });
      }
    }
    if (o.aiNotes) {
      const ev = o.liveEval;
      if (ev && ev.summary) sections.push({ kind: 'text', title: 'AI notes: Live Eval', text: ev.summary + (ev.leaning && ev.leaning.why ? '\n\n' + ev.leaning.why : '') });
      for (const [name, text] of o.analysis || []) if (text) sections.push({ kind: 'text', title: 'AI notes: ' + name, text });
    }
    return { title, orientation: o.flow ? 'landscape' : (o.orientation === 'landscape' ? 'landscape' : 'portrait'), sections };
  }

  // 4.14 Prep used on each side, from the round's prep fields. Keyed by side ('aff', 'neg'): each format so far has
  // one prep clock per side, a team's clock (policy) or the one debater's clock (LD).
  function prepUsed(round) {
    const r = round || {};
    const total = Math.max(0, Math.round(Number(r.prepSeconds) || 0));
    const out = {};
    for (const c of F.prepClocks(F.formatOf(r))) {
      const left = Number((r.prepLeft || {})[c.id]);
      const used = Number.isFinite(left) ? Math.max(0, Math.min(total, Math.round(total - left))) : 0;
      out[c.side] = { used, total, text: c.label + ' used ' + formatClock(used) + ' of ' + formatClock(total) };
    }
    out.any = out.aff.used > 0 || out.neg.used > 0;
    return out;
  }
  // 4.14 Key moments from the Round Map: only dropped and conceded arguments, in speech order.
  function keyMoments(map, fmt) {
    const f = fmt || F.POLICY;
    const nodes = ((map && map.nodes) || []).filter((n) => n && (n.status === 'dropped' || n.status === 'conceded'));
    const at = (s) => { const i = f.flowSpeeches.indexOf(s); return i < 0 ? 99 : i; };
    return nodes.slice().sort((a, b) => at(a.speech) - at(b.speech))
      .map((n) => ({ speech: n.speech, label: n.label, status: n.status, side: speechSide(n.speech, f), text: n.speech + ': ' + n.label + ' (' + n.status + ')' }));
  }
  // 4.13 The paired summary bar under the key issues.
  function issueTally(issues) {
    const t = { aff: 0, even: 0, neg: 0 };
    for (const k of issues || []) if (k && t[k.ahead] != null) t[k.ahead]++;
    t.text = 'Aff ahead on ' + t.aff + ' · Even ' + t.even + ' · Neg ahead on ' + t.neg;
    return t;
  }
  // "1AR", "1AR and 2NR", "1AC, 1NC and 2AC".
  function andList(items) {
    const x = (items || []).filter(Boolean);
    return x.length < 2 ? (x[0] || '') : x.slice(0, -1).join(', ') + ' and ' + x[x.length - 1];
  }
  // 4.13 "Out of date: 1AR and 2NR happened since." or '' when nothing is newer.
  function outOfDateText(through, round) {
    const newer = speechesSoFar(round).filter((id) => !(through || []).includes(id));
    return newer.length ? 'Out of date: ' + andList(newer) + ' happened since.' : '';
  }
  // 4.13 / 4.14 The verb pair: Run when nothing is saved, Update when something is.
  const runVerb = (hasSaved) => (hasSaved ? 'Update' : 'Run');
  // 4.9 (Q15) Which reading level applies: this round's choice, else the device default.
  function readingFor(roundReading, deviceReading) {
    const ok = (v) => v === 'expert' || v === 'plain';
    return ok(roundReading) ? roundReading : ok(deviceReading) ? deviceReading : 'expert';
  }
  // 4.0 A saved Decide tab from before Slice 4: 'draft' opens the Ballot.
  const decideTab = (tab) => (tab === 'draft' ? 'ballot' : tab);

  const api = { PTS_FIELDS, DRAFT_GROUPS, ptsFields, draftGroups, fieldLabel, fieldValue, fieldState, markFields, ballotSnapshot,
    roundHasContent, insightsReady, draftPanelState, feedbackLines, outOfRangePoints, draftValue, wordDiff, reviewFromDraft,
    staleReviewCards, reviewInsertFields, applyReview, autoRefillPlan, speechEndedSince, ranksSet, moveRank,
    stepPoints, savedBallotEntry, savedBallotRow, savedBallotView, historyTable, historyColumns, decisionText, tournamentBlocks, printModel,
    prepUsed, keyMoments, issueTally, andList, outOfDateText, runVerb, readingFor, decideTab };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).decide = api;
})(typeof window !== 'undefined' ? window : globalThis);
