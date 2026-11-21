// What the AI is asked: the judge prompt, the live flow prompt, the ballot filler, reading levels, Live Eval,
// and the analysis prompts (round map, impact calculus, paradigm lens).
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');
  const { paradigmText, ballotFields, speechesSoFar, ptsRange, isDefaultRange } = part('round');
  const { speechColumn, aiFlowCell, flowCellText } = part('flow');
  const { docSpeech } = part('files');
  const { fieldLabel, markFields, feedbackLines, outOfRangePoints, draftValue, andList } = part('decide');

  // Every prompt below is keyed by format: it reads the round's format (F.formatOf(round)) or takes one, and the
  // format-only words come from the format file's "ai" block. Text sent to the hosted AI carries only the format id
  // and version (see hostedAiBody); the server builds the same text from its generated copy of the format files.
  const tags = (fmt) => fmt.speakers.map(F.speakerTag);

  function buildJudgePrompt(round, docs, opts) {
    const lines = [];
    const ai = round.ai || {};
    const fmt = F.formatOf(round);
    lines.push('ROUND INFO');
    lines.push('Tournament: ' + (round.tournament || '-') + ' | Round: ' + (round.roundName || '-'));
    lines.push('Resolution: ' + (round.topic || '-'));
    // Students are named only by position (1A, 2A, 1N, 2N in policy; "Aff debater" in LD). Names never go to an AI provider.
    lines.push(['aff', 'neg'].map((side) => {
      const on = F.speakersOn(fmt, side).map(F.speakerTag);
      return fmt.sides[side].label + ': ' + (on.length > 1 ? 'speakers ' + andList(on) : 'one debater, the ' + on[0]) + '.';
    }).join(' '));
    lines.push('');
    lines.push('JUDGE PARADIGM');
    lines.push(opts && opts.paradigm ? opts.paradigm : paradigmText(ai.paradigm, ai.customParadigm));
    if (ai.notes && ai.notes.trim()) lines.push('Extra judge notes: ' + ai.notes.trim());
    lines.push('');
    lines.push('TRANSCRIPTS (machine speech-to-text; expect errors and gaps)');
    let any = false;
    for (const sp of fmt.speeches) {
      const t = (round.transcripts || {})[sp.id];
      const head = '--- ' + sp.label + ' (' + sp.side.toUpperCase() + ', ' + F.speakerTag(F.speakerOf(fmt, sp.speaker)) + ') ---';
      if (t && t.trim()) {
        any = true;
        lines.push(head);
        lines.push(t.trim());
      } else {
        // No transcript, but a speech doc: debaters usually read their doc, so the doc is the speech.
        const mine = (docs || []).filter((d) => docSpeech(d, fmt) === sp.id).map((d) => d.name);
        if (mine.length) {
          any = true;
          lines.push(head);
          lines.push('(No transcript. Treat the speech doc as what was said: ' + mine.join(', ') + '.)');
        }
      }
    }
    if (!any) lines.push('(none recorded)');
    lines.push('');
    lines.push("JUDGE'S FLOW (the human judge's own notes; trust these over the transcript when they conflict)");
    let anyFlow = false;
    for (const f of round.flows || []) {
      const cols = fmt.flowColumns.map((c, i) => [c.label, (f.cells || {})[i]]).filter(([, v]) => v && v.trim());
      if (!cols.length) continue;
      anyFlow = true;
      lines.push('### Sheet: ' + f.name);
      for (const [label, v] of cols) lines.push('[' + label + ']\n' + v.trim());
    }
    if (!anyFlow) lines.push('(empty)');
    const aiSheets = (round.aiFlows || []).map((sh) => {
      const cols = fmt.flowColumns.map((c, i) => [c.label + (sh.edits && sh.edits[i] ? ' (edited by the judge)' : ''), flowCellText(sh, i, 'detailed', fmt)]).filter(([, v]) => v);
      return cols.length ? '### Sheet: ' + sh.name + '\n' + cols.map(([l, v]) => '[' + l + ']\n' + v).join('\n') : '';
    }).filter(Boolean);
    if (aiSheets.length) {
      lines.push('');
      lines.push('AI FLOW (machine-made from the transcript during the round; less reliable than the judge\'s flow)');
      lines.push(aiSheets.join('\n'));
    }
    if (ai.evidence && ai.evidence.trim()) {
      lines.push('');
      lines.push('EVIDENCE / SPEECH DOCS PROVIDED');
      lines.push(ai.evidence.trim());
    }
    return lines.join('\n');
  }

  // Points that cluster within a few tenths tell debaters nothing. This scale spreads them; how far apart comes from
  // the format (four debaters in policy, two in LD).
  const pointsGuide = (fmt) => 'Speaker points must mean something, so use the full range: '
    + '29.5-30.0 outstanding (a top speaker at a big tournament); 29.0-29.4 excellent; 28.5-28.9 strong; '
    + '28.0-28.4 solid, about average; 27.5-27.9 below average; 27.0-27.4 weak; 26.0-26.9 serious problems; '
    + 'below 26 only for rudeness or not giving a speech. '
    + fmt.ai.pointsSpread;
  // "a high school policy (CX) debate".
  const debateName = (fmt) => 'a ' + fmt.ai.kind + ' (' + fmt.ai.abbr + ') debate';

  const judgeSystem = (fmt) => [
    'You help a human judge decide ' + debateName(fmt) + ' round.',
    'The human makes the final call. Your job is a clear, fair draft.',
    'Judge only the arguments in the round, under the given paradigm.',
    'Track each argument from first speech to last. Note drops. ' + fmt.ai.rules,
    'Say where the transcript is unclear instead of guessing.',
    '',
    'Reply in this exact structure, in plain text with short headings:',
    'DECISION: AFF or DECISION: NEG   (first line, nothing before it)',
    'CONFIDENCE: low / medium / high',
    'RFD: 4–8 sentences a coach can read on a ballot. Name the arguments that decided it.',
    'KEY CLASH: one line per main argument: who won it and why.',
    'DROPS: arguments one side conceded.',
    'FEEDBACK: one short paragraph for each debater (' + tags(fmt).join(', ') + '): one strength, one thing to fix.',
    'SUGGESTED POINTS: ' + tags(fmt).join(', ') + ', each with a 3-6 word reason (the judge sets the final points).',
    '',
    pointsGuide(fmt),
  ].join('\n');

  // Splits the AI draft's FEEDBACK section into Aff (1A, 2A) and Neg (1N, 2N) comments,
  // to paste into the per-team boxes on Tabroom. fmt: policy-hs when not given.
  function parseFeedback(text, fmt) {
    const f = fmt || F.POLICY;
    const sideOfTag = new Map(f.speakers.map((sp) => [F.speakerTag(sp).toLowerCase(), sp.side]));
    const whoRe = new RegExp('^\\s*[-*•]?\\s*\\**\\s*(' + tags(f).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
    const m = /FEEDBACK:\s*([\s\S]*?)(?:\n\s*SUGGESTED POINTS:|$)/i.exec(text || '');
    const out = { aff: [], neg: [] };
    if (!m) return { aff: '', neg: '' };
    let cur = null;
    for (const line of m[1].split('\n')) {
      const who = whoRe.exec(line);
      if (who) cur = sideOfTag.get(who[1].toLowerCase());
      if (cur && line.trim()) out[cur].push(line.trim());
    }
    return { aff: out.aff.join('\n'), neg: out.neg.join('\n') };
  }


  const LIVE_FLOW_SCHEMA = {
    type: 'object',
    properties: {
      sheets: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            sheet: { type: 'string' },
            brief: { type: 'string' },
            standard: { type: 'string' },
            detailed: { type: 'string' },
          },
          required: ['sheet', 'brief', 'standard', 'detailed'],
          additionalProperties: false,
        },
      },
    },
    required: ['sheets'],
    additionalProperties: false,
  };

  const liveFlowSystem = (fmt) => [
    'You flow a ' + fmt.ai.kind + ' debate for a judge, live, from a speech-to-text transcript.',
    'Flow only the CURRENT speech. Earlier speeches are already flowed and given for context.',
    'For each sheet, write the same arguments at three levels of detail:',
    '- brief: the big picture only. One short line per position or main answer (e.g. "Perm do both", "No link — plan is cheap"). No authors.',
    '- standard: normal flow shorthand. One line per argument, numbered, short tag, author + year if a card is read.',
    '- detailed: one entry per argument, numbered: the tag, author + year, then the warrant (why it is true, the key evidence) in one or two lines, and which earlier argument it answers.',
    'All three levels must cover the same arguments in the same order; only the depth changes.',
    'Put each argument on the sheet it answers. Use an existing sheet name exactly when the argument answers that sheet.',
    fmt.ai.flowSheets,
    'Return every sheet this speech has touched so far, with the FULL notes for this speech on that sheet (they replace earlier notes for this speech).',
    'The transcript has errors and the speech may be unfinished. Mark unclear parts with "??".',
    'If documents are listed for the CURRENT speech and there is no transcript, treat the documents as the speech (debaters usually read their doc): flow every argument and card in them, in order, and end each line with " [doc]".',
    'If there is a transcript, use it first. Add arguments from the current speech\'s documents that the transcript does not cover, ending each with " [doc?]" (in the doc, not heard; a gap in the transcript or a skipped card).',
    'Do not invent arguments beyond the transcript and the current speech\'s documents. Never flow a document listed for another speech into this one.',
  ].join('\n');

  function buildLiveFlowPrompt(round, speechId, docs) {
    const fmt = F.formatOf(round);
    const FLOW_COLUMNS = fmt.flowColumns;
    const col = speechColumn(speechId, fmt);
    const sp = F.speechOf(fmt, speechId);
    const lines = [];
    lines.push('Resolution: ' + (round.topic || '-'));
    lines.push('');
    lines.push('FLOW SO FAR (earlier speeches):');
    let any = false;
    for (const sheet of round.aiFlows || []) {
      const cols = [];
      for (let c = 0; c < FLOW_COLUMNS.length; c++) {
        const parts = Object.assign({}, sheet.parts);
        delete parts[speechId];
        const edited = sheet.edits && sheet.edits[c] && c !== col;
        const text = edited ? sheet.edits[c].text + ' (edited by the judge; trust this)' : aiFlowCell({ parts }, c, 'standard', fmt);
        if (text) cols.push('[' + FLOW_COLUMNS[c].label + ']\n' + text);
      }
      if (!cols.length) continue;
      any = true;
      lines.push('### ' + sheet.name);
      lines.push(cols.join('\n'));
    }
    if (!any) lines.push('(nothing yet)');
    lines.push('');
    lines.push('CURRENT SPEECH: ' + speechId + ' (' + (sp ? sp.side.toUpperCase() : '?') + ') → flow column "' + (col == null ? '?' : FLOW_COLUMNS[col].label) + '"');
    const mine = (docs || []).filter((d) => docSpeech(d, fmt) === speechId).map((d) => d.name);
    lines.push('DOCUMENTS FOR THIS SPEECH: ' + (mine.length ? mine.join(', ') : '(none)'));
    lines.push('TRANSCRIPT SO FAR:');
    lines.push(((round.transcripts || {})[speechId] || '').trim() || '(empty)');
    return lines.join('\n');
  }

  // ---------- ballot filler ----------
  const PT = { type: 'number' };
  // The ballot the AI fills, for the format's debaters. Ranks only when the format has speaker ranks.
  function ballotSchema(fmt) {
    const ids = fmt.speakerIds;
    const RK = { type: 'integer', enum: ids.map((_, i) => i + 1) };
    const per = (t) => ({ type: 'object', properties: Object.fromEntries(ids.map((s) => [s, t])), required: ids.slice(), additionalProperties: false });
    const properties = {
      winner: { type: 'string', enum: ['aff', 'neg'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      points: per(PT),
      ...(fmt.ballot.speakerRanks ? { ranks: per(RK) } : {}),
      rfd: { type: 'string' },
      aff_comments: { type: 'string' },
      neg_comments: { type: 'string' },
      points_reasoning: { type: 'string' },
    };
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  }

  function ballotTask(fmt) {
    const ids = fmt.speakerIds;
    const n = ids.map((_, i) => i + 1);
    const pointsLine = fmt.ballot.speakerRanks
      ? '- points for ' + ids.join(', ') + ' (one decimal place) and ranks 1-' + n.length + ' (1 = best). Ranks must use ' + n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] + ' once each and must agree with the points (higher points, better rank).'
      : '- points for ' + ids.join(', ') + ' (one decimal place).';
    return [
      'Fill in the ballot for this round as of now.',
      '- winner and confidence.',
      pointsLine,
      '- rfd: the reason for decision for everyone in the round, 4-8 sentences, naming the arguments that decided it.',
      '- aff_comments / neg_comments: comments for each team, one short paragraph per debater with one strength and one thing to fix.',
      '- points_reasoning: one line per debater on why they got those points.',
      'If the round is unfinished, fill it as if it ended now and say so in the RFD.',
    ].join('\n');
  }

  // Slice 4 (4.3) opts: only (the fields the judge picked; the AI still fills every field), redraft
  // ({ fields, previous } for [Redo this]), range (the points range) and liveEvalFeedback (the Live Eval feedback list).
  function buildBallotPrompt(round, docs, judgeInput, opts) {
    const o = opts || {};
    const fmt = F.formatOf(round);
    const b = round.ballot || {};
    const touched = b.touched || {};
    const kept = ballotFields(fmt).filter((f) => touched[f]).map((f) => {
      const [a, k] = f.split('.');
      const v = k ? (b[a] || {})[k] : b[f];
      return f + ' = ' + (typeof v === 'string' && v.length > 300 ? v.slice(0, 300) + '…' : v);
    });
    const lines = [ballotTask(fmt), '', pointsGuide(fmt)];
    const range = ptsRange(o.range);
    if (!isDefaultRange(range)) lines.push('', 'This tournament uses ' + range.min + '–' + range.max + '. Map the scale above onto that range.');
    if (kept.length) lines.push('', 'THE JUDGE ALREADY SET THESE BY HAND. Keep them, and make the rest agree with them:', ...kept);
    if (judgeInput && judgeInput.trim()) lines.push('', "THE JUDGE'S OWN INPUT. Weigh it heavily; where it conflicts with your read, follow the judge:", judgeInput.trim());
    const label = (f) => fieldLabel(f, fmt);
    if (o.only && o.only.length) lines.push('', 'THE JUDGE WANTS NEW TEXT FOR: ' + o.only.map(label).join(', ') + '. Still fill every field.');
    if (o.redraft && o.redraft.fields && o.redraft.fields.length) {
      lines.push('', 'REDO: the judge asked for a different version of ' + o.redraft.fields.map(label).join(', ') + '.');
      for (const [f, v] of Object.entries(o.redraft.previous || {})) if (v != null && String(v).trim()) lines.push('Your last version of ' + label(f) + ': ' + String(v).slice(0, 600));
    }
    const fb = feedbackLines(o.liveEvalFeedback);
    if (fb.length) lines.push('', 'LIVE EVAL FEEDBACK. Use it for the Aff and Neg comments:', ...fb);
    lines.push('', buildJudgePrompt(round, docs));
    return lines.join('\n');
  }

  // Puts an AI ballot draft into the ballot, but never over a field the judge typed by hand.
  // With override (the judge asked for it, e.g. "Redo with my input"), it may change hand-set fields too.
  // Slice 4 (4.4, 4.6) opts.only: write exactly these fields (the judge chose them in the review, so a "yours" field
  // in the list is written). opts.range: AI points outside it are never written. opts.mark: 'yours' (an insert) or
  // 'ai' (an auto refill) for the fields written. opts.format: the round's format (policy-hs when not given).
  function applyBallotDraft(ballot, draft, opts) {
    const o = opts || {};
    let b = JSON.parse(JSON.stringify(ballot || {}));
    const touched = o.only ? {} : o.override ? {} : b.touched || {};
    b.pts ??= {}; b.ranks ??= {};
    const bad = new Set(o.range ? outOfRangePoints(draft, o.range, o.format).map((x) => 'pts.' + x.speaker) : []);
    const allow = o.only ? new Set(o.only) : null;
    const written = [];
    for (const field of ballotFields(o.format)) {
      if (allow && !allow.has(field)) continue;
      if (touched[field] || bad.has(field)) continue;
      const value = draftValue(draft, field);
      if (value === undefined || value === null || value === '') continue;
      const [a, k] = field.split('.');
      if (k) b[a][k] = value; else b[a] = value;
      written.push(field);
    }
    if (o.mark) b = markFields(b, written, o.mark);
    return b;
  }

  // ---------- reading level ----------
  // The same analysis, written for two readers. Only the wording changes, never the verdict.
  const READING_LEVELS = {
    expert: { label: 'Expert', guide: 'READING LEVEL: expert. Write for an experienced college policy judge. Precise, technical debate vocabulary and shorthand are fine.' },
    plain: { label: 'Plain', guide: 'READING LEVEL: plain (Feynman style). Write so a first-year high school debater and their parent can follow it on one read. '
      + 'Use short sentences and everyday words. When you must use a debate term, explain it in a few plain words the first time '
      + '(for example: "the link, meaning why the plan causes the problem"). Prefer one concrete example over abstract wording. '
      + 'Talk to debaters directly and kindly in feedback ("you", not "the 1A"). Keep the same substance, verdict and points; only the wording gets simpler.' },
  };
  function readingGuide(level) { return (READING_LEVELS[level] || READING_LEVELS.expert).guide; }

  // ---------- live evaluation (mid-round) ----------

  function nextSpeech(round) {
    const speeches = F.formatOf(round).speeches;
    const done = speechesSoFar(round);
    if (!done.length) return speeches[0].id;
    const last = speeches.findIndex((s) => s.id === done[done.length - 1]);
    return last + 1 < speeches.length ? speeches[last + 1].id : null;
  }

  const evalSystem = (fmt) => [
    'You help a human judge follow ' + debateName(fmt) + ' WHILE it is happening.',
    'The round may be unfinished. Judge only what has been said so far, under the given paradigm, and say what could still change.',
    fmt.ai.evalNorms,
    'Transcripts are machine speech-to-text with errors. A speech with no transcript but a speech doc: treat the doc as what was said. In the AI flow, [doc] lines come from the speech doc; [doc?] lines are in the doc but were not heard.',
    'Be concrete: name the arguments, cards and speeches. Keep each item short enough to read in a few seconds.',
  ].join('\n');

  const evalSpeaker = (fmt) => ({
    type: 'object',
    properties: {
      speaker: { type: 'string', enum: fmt.speakerIds.slice() },
      so_far: { type: 'string' },
      strength: { type: 'string' },
      fix: { type: 'string' },
      points: { type: 'string' },
    },
    required: ['speaker', 'so_far', 'strength', 'fix', 'points'],
    additionalProperties: false,
  });

  const evalSchema = (fmt) => ({
    type: 'object',
    properties: {
      leaning: {
        type: 'object',
        properties: {
          side: { type: 'string', enum: ['aff', 'neg', 'toss-up'] },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          why: { type: 'string' },
        },
        required: ['side', 'confidence', 'why'],
        additionalProperties: false,
      },
      summary: { type: 'string' },
      key_issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            issue: { type: 'string' },
            ahead: { type: 'string', enum: ['aff', 'neg', 'even', 'unclear'] },
            note: { type: 'string' },
          },
          required: ['issue', 'ahead', 'note'],
          additionalProperties: false,
        },
      },
      watch_for: { type: 'array', items: { type: 'string' } },
      aff_needs: { type: 'string' },
      neg_needs: { type: 'string' },
      feedback: { type: 'array', items: evalSpeaker(fmt) },
    },
    required: ['leaning', 'summary', 'key_issues', 'watch_for', 'aff_needs', 'neg_needs', 'feedback'],
    additionalProperties: false,
  });

  function buildEvalPrompt(round, docs) {
    const fmt = F.formatOf(round);
    const done = speechesSoFar(round);
    const next = nextSpeech(round);
    const lines = [];
    lines.push('SPEECHES SO FAR: ' + (done.length ? done.join(', ') : '(none yet)'));
    lines.push('NEXT SPEECH: ' + (next || '(round is over)'));
    lines.push('');
    lines.push('Give a mid-round evaluation as of now:');
    lines.push('- leaning: who would win if the round ended now, how sure you are, and why (2-3 sentences).');
    lines.push('- summary: the state of the round in 3-5 sentences.');
    lines.push('- key_issues: the 3-6 arguments that matter most; who is ahead on each; one line on why.');
    lines.push('- watch_for: 3-6 specific things the judge should listen for in the coming speeches (drops, new arguments, extensions, weighing).');
    lines.push('- aff_needs / neg_needs: what each side must do in its remaining speeches to win.');
    lines.push('- feedback: one entry per debater (' + fmt.speakerIds.join(', ') + ') on their speeches so far: what they did, one strength, one fix, and points so far (or "not yet" if they have not spoken).');
    lines.push(pointsGuide(fmt));
    lines.push('');
    lines.push(buildJudgePrompt(round, docs));
    return lines.join('\n');
  }

  // ---------- analysis: round map, impact calculus, paradigm lens ----------
  const analysisSystem = (fmt) => [
    'You analyse ' + debateName(fmt) + ' for a human judge, from transcripts, flows and speech docs. The round may be unfinished.',
    'Use only what is in the round. Transcripts are machine speech-to-text with errors. With no transcript, a speech doc stands in for the speech.',
    'Be concrete and short: name arguments, cards and speeches.',
  ].join('\n');
  const mapSchema = (fmt) => ({
    type: 'object',
    properties: {
      nodes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            speech: { type: 'string', enum: fmt.flowSpeeches.slice() },
            label: { type: 'string' },
            status: { type: 'string', enum: ['answered', 'extended', 'dropped', 'conceded', 'open'] },
          },
          required: ['id', 'speech', 'label', 'status'],
          additionalProperties: false,
        },
      },
      edges: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
            kind: { type: 'string', enum: ['answers', 'extends', 'turns', 'concedes'] },
          },
          required: ['from', 'to', 'kind'],
          additionalProperties: false,
        },
      },
    },
    required: ['nodes', 'edges'],
    additionalProperties: false,
  });

  const MAP_TASK = [
    'Map the argument flow of the round as a graph.',
    '- nodes: one per argument as it appears in a speech (a later speech extending or answering it gets its own node). id: short unique id like "a1". label: 2-7 words. speech: where it was made.',
    '- status: "dropped" if the other side never answered it in a later speech; "conceded" if they agreed with it; "extended" if its own side carried it into a later speech; "answered" if it was responded to; "open" if the round has not reached a response yet.',
    '- edges: from the later node to the earlier node it responds to. kind: "answers" (a response), "turns" (a turn), "extends" (same side carries it forward), "concedes".',
    'Keep it readable: at most about 40 nodes; group small cards into one node.',
  ].join('\n');

  const IMPACT_SCHEMA = {
    type: 'object',
    properties: {
      impacts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            impact: { type: 'string' },
            side: { type: 'string', enum: ['aff', 'neg'] },
            magnitude: { type: 'string' },
            probability: { type: 'string' },
            timeframe: { type: 'string' },
            reversibility: { type: 'string' },
            status: { type: 'string', enum: ['extended', 'contested', 'dropped', 'conceded', 'not yet extended'] },
            note: { type: 'string' },
          },
          required: ['impact', 'side', 'magnitude', 'probability', 'timeframe', 'reversibility', 'status', 'note'],
          additionalProperties: false,
        },
      },
      weighing_done: { type: 'string' },
      comparison: { type: 'string' },
      net: { type: 'string', enum: ['aff', 'neg', 'even'] },
    },
    required: ['impacts', 'weighing_done', 'comparison', 'net'],
    additionalProperties: false,
  };

  const IMPACT_TASK = [
    'Do impact calculus for the round so far.',
    '- impacts: every terminal impact either side has read (advantages, disads, kritik impacts, turns). For each: magnitude, probability, timeframe and reversibility in a few words each, based on the evidence and arguments in the round; its status; one line of note.',
    '- weighing_done: what weighing the debaters themselves did (or "none yet").',
    '- comparison: 3-5 sentences comparing the biggest impacts against each other, using the debaters\' weighing first.',
    '- net: whose impacts outweigh right now.',
  ].join('\n');

  const LENS_SCHEMA = {
    type: 'object',
    properties: {
      winner: { type: 'string', enum: ['aff', 'neg', 'toss-up'] },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
      rfd: { type: 'string' },
      deciding_factors: { type: 'array', items: { type: 'string' } },
      lens_effect: { type: 'string' },
    },
    required: ['winner', 'confidence', 'rfd', 'deciding_factors', 'lens_effect'],
    additionalProperties: false,
  };

  const LENS_TASK = [
    'Weigh the round strictly under the JUDGE PARADIGM below, as if you were that judge.',
    '- winner and confidence, as of now.',
    '- rfd: 4-6 sentences, in the voice of that judge.',
    '- deciding_factors: the 2-5 things that decide it under this paradigm.',
    '- lens_effect: how this paradigm changes the result or the reasoning compared with a neutral read of the flow.',
  ].join('\n');

  function buildAnalysisPrompt(round, docs, task, opts) {
    const done = speechesSoFar(round);
    return 'SPEECHES SO FAR: ' + (done.length ? done.join(', ') : '(none yet)') + '\n\n' + task + '\n\n' + buildJudgePrompt(round, docs, opts);
  }

  // Builds Mermaid code from the map ourselves, so model text can never break or inject into the diagram.
  // fmt: the round's format (policy-hs when not given).
  function buildMermaid(map, fmt) {
    const f = fmt || F.POLICY;
    const MAP_SPEECHES = f.flowSpeeches;
    const nodes = (map && map.nodes) || [];
    const edges = (map && map.edges) || [];
    const safeId = (id) => 'n_' + String(id).replace(/[^A-Za-z0-9_]/g, '_');
    const label = (t) => {
      const clean = String(t || '').replace(/[\r\n]+/g, ' ').replace(/["`]/g, "'").replace(/[<>{}\[\]|#;]/g, ' ').replace(/\s+/g, ' ').trim();
      return clean.length > 60 ? clean.slice(0, 57) + '...' : clean;
    };
    const sideOf = (sp) => (F.speechOf(f, sp) || {}).side || 'neg';
    const known = new Set();
    // Original id -> diagram id. Ids that clean up to the same text ("a-b", "a.b") get a suffix, so no node is lost.
    const idMap = new Map();
    const idFor = (orig) => {
      const key = String(orig);
      if (idMap.has(key)) return idMap.get(key);
      let id = safeId(key), n = 2;
      while ([...idMap.values()].includes(id)) id = safeId(key) + '_' + n++;
      idMap.set(key, id);
      return id;
    };
    // Arrows point from a later answer back to what it answers, so lay out right-to-left: the 1AC ends up on the left.
    const out = ['flowchart RL'];
    const groups = [];
    for (const sp of MAP_SPEECHES) {
      const inSp = nodes.filter((n) => n.speech === sp);
      if (!inSp.length) continue;
      out.push('  subgraph S_' + sp + '["' + sp + '"]');
      groups.push('S_' + sp);
      out.push('    direction TB');
      for (const n of inSp) {
        if (idMap.has(String(n.id))) continue; // same node listed twice
        const id = idFor(n.id);
        known.add(id);
        const cls = n.status === 'dropped' ? 'dropped' : n.status === 'conceded' ? 'conceded' : sideOf(sp);
        out.push('    ' + id + '["' + label(n.label) + (n.status === 'dropped' ? ' (dropped)' : '') + '"]:::' + cls);
      }
      out.push('  end');
    }
    const arrow = { answers: '-->|answers|', turns: '-.->|turns|', extends: '==>|extends|', concedes: '-->|concedes|' };
    for (const e of edges) {
      const a = idMap.get(String(e.from)), b = idMap.get(String(e.to));
      if (!a || !b || !Object.prototype.hasOwnProperty.call(arrow, e.kind)) continue;
      out.push('  ' + a + ' ' + arrow[e.kind] + ' ' + b);
    }
    for (const g of groups) out.push('  style ' + g + ' fill:transparent,stroke:#cfd4da,stroke-width:1px');
    out.push('  classDef aff fill:#ebf2fd,stroke:#1d5bc4,color:#123a7a');
    out.push('  classDef neg fill:#fdeeed,stroke:#b4231b,color:#6e140f');
    out.push('  classDef dropped fill:#fff6dc,stroke:#8a5a00,stroke-width:2px,stroke-dasharray:5 3,color:#5c3c00');
    out.push('  classDef conceded fill:#eeeeee,stroke:#777,stroke-dasharray:2 2,color:#333');
    return out.join('\n');
  }

  // Lays the map out like a flow sheet: one column per speech, one row per argument thread.
  // A thread is an argument plus everything that answers, turns or extends it, followed back to its root.
  // A dropped argument gets a "No answer" ghost in the next speech of the other side, if that speech has happened.
  function layoutMap(map, doneSpeeches, fmt) {
    const f = fmt || F.POLICY;
    const MAP_SPEECHES = f.flowSpeeches;
    const nodes = ((map && map.nodes) || []).filter((n) => n && MAP_SPEECHES.includes(n.speech));
    const edges = (map && map.edges) || [];
    const byId = new Map();
    for (const n of nodes) if (!byId.has(String(n.id))) byId.set(String(n.id), n);
    const order = (sp) => MAP_SPEECHES.indexOf(sp);
    const sideOf = (sp) => (F.speechOf(f, sp) || {}).side || 'neg';
    const KINDS = ['answers', 'turns', 'extends', 'concedes'];
    const parent = new Map(); // node id -> { to, kind }
    for (const e of edges) {
      const from = String(e.from), to = String(e.to);
      if (!byId.has(from) || !byId.has(to) || from === to || parent.has(from) || !KINDS.includes(e.kind)) continue;
      parent.set(from, { to, kind: e.kind });
    }
    // Follow answers back to the original argument. If bad data makes a loop, every node in the loop
    // shares one root: the one from the earliest speech, so the loop stays on a single row.
    const rootOf = (id) => {
      const path = [];
      let cur = id;
      while (parent.has(cur) && !path.includes(cur)) { path.push(cur); cur = parent.get(cur).to; }
      if (!path.includes(cur)) return cur;
      const loop = path.slice(path.indexOf(cur));
      return loop.sort((a, b) => order(byId.get(a).speech) - order(byId.get(b).speech) || (a < b ? -1 : 1))[0];
    };
    const rows = new Map();
    const ordered = [...byId.values()].sort((a, b) => order(a.speech) - order(b.speech));
    for (const n of ordered) {
      const id = String(n.id);
      const root = byId.get(rootOf(id)) || n;
      const rk = String(root.id);
      if (!rows.has(rk)) rows.set(rk, { root: rk, title: root.label, side: sideOf(root.speech), cells: {} });
      const row = rows.get(rk);
      (row.cells[n.speech] ??= []).push({
        id, label: n.label, status: n.status, side: sideOf(n.speech),
        kind: parent.has(id) ? parent.get(id).kind : null,
      });
    }
    const done = new Set(doneSpeeches || []);
    for (const row of rows.values()) {
      for (const sp of MAP_SPEECHES) {
        for (const c of row.cells[sp] || []) {
          if (c.status !== 'dropped' || c.ghost) continue;
          const next = MAP_SPEECHES.slice(order(sp) + 1).find((x) => sideOf(x) !== c.side && done.has(x));
          if (next && !(row.cells[next] || []).length) row.cells[next] = [{ ghost: true, label: 'No answer', side: sideOf(next) }];
        }
      }
    }
    const used = MAP_SPEECHES.filter((sp) => done.has(sp) || [...rows.values()].some((r) => (r.cells[sp] || []).length));
    return { columns: used, rows: [...rows.values()] };
  }

  // The format-keyed parts of every AI request for one format: what callAI needs besides the round. Made once per
  // format version and kept, so a schema compared by identity (the map) stays the same object.
  const PROMPTS = {};
  function promptsFor(fmt) {
    const f = fmt || F.POLICY;
    return PROMPTS[f.key] ??= Object.freeze({
      judgeSystem: judgeSystem(f), pointsGuide: pointsGuide(f), liveFlowSystem: liveFlowSystem(f), evalSystem: evalSystem(f),
      evalSchema: evalSchema(f), analysisSystem: analysisSystem(f), mapSchema: mapSchema(f), ballotSchema: ballotSchema(f),
      ballotTask: ballotTask(f),
    });
  }
  // The policy prompts under their old names (old callers and tests).
  const P = promptsFor(F.POLICY);
  const POINTS_GUIDE = P.pointsGuide, JUDGE_SYSTEM = P.judgeSystem, LIVE_FLOW_SYSTEM = P.liveFlowSystem,
    BALLOT_SCHEMA = P.ballotSchema, BALLOT_TASK = P.ballotTask, EVAL_SYSTEM = P.evalSystem, EVAL_SCHEMA = P.evalSchema,
    ANALYSIS_SYSTEM = P.analysisSystem, MAP_SCHEMA = P.mapSchema;

  const api = { buildJudgePrompt, POINTS_GUIDE, JUDGE_SYSTEM, parseFeedback, LIVE_FLOW_SCHEMA, LIVE_FLOW_SYSTEM,
    buildLiveFlowPrompt, BALLOT_SCHEMA, BALLOT_TASK, buildBallotPrompt, applyBallotDraft, READING_LEVELS,
    readingGuide, nextSpeech, EVAL_SYSTEM, EVAL_SCHEMA, buildEvalPrompt, ANALYSIS_SYSTEM, MAP_SCHEMA, MAP_TASK,
    IMPACT_SCHEMA, IMPACT_TASK, LENS_SCHEMA, LENS_TASK, buildAnalysisPrompt, buildMermaid, layoutMap, promptsFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).prompts = api;
})(typeof window !== 'undefined' ? window : globalThis);
