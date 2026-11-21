// Guided tracks and checks for the Debate Library (docs/library/TRACKS.md §2.9, §3, §4).
// build-learn.mjs calls this. It reads docs/library/tracks.json and docs/library/checks/<slug>.md and returns HTML.
// The Markdown helpers come in as `md` ({ esc, inline, fenceHtml }) so this file does not import the builder back.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const STEP = /^[a-z0-9-]+$/;

// ---------- tracks.json ----------

export function loadTracks(dir) {
  if (!existsSync(join(dir, 'tracks.json'))) return [];
  const data = JSON.parse(readFileSync(join(dir, 'tracks.json'), 'utf8'));
  const seen = new Set();
  for (const t of data.tracks) {
    for (const k of ['id', 'name', 'title', 'description', 'promise', 'steps']) if (!t[k]) throw new Error(`tracks.json: track "${t.id}" needs "${k}"`);
    if (!STEP.test(t.id) || seen.has(t.id)) throw new Error(`tracks.json: bad or repeated id "${t.id}"`);
    seen.add(t.id);
    for (const s of t.steps) if (!STEP.test(s)) throw new Error(`tracks.json: track "${t.id}" has a bad step "${s}"`);
  }
  return data.tracks;
}

// A track is ready to build when every step has a page and a check. It is live when every check is also reviewed.
export function trackState(track, pages, checks) {
  const ready = track.steps.every((s) => pages.has(s) && checks.has(s));
  const live = ready && track.steps.every((s) => checks.get(s).status === 'reviewed');
  return { ready, live };
}

// ---------- checks/<slug>.md ----------

// Strict parser for one check file (format: TRACKS.md §3.2). It throws with the file and question name on any
// mistake, so a broken check stops the build instead of shipping a wrong answer key.
export function parseCheck(text, file) {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) throw new Error(`${file}: needs front matter (page, version)`);
  const meta = Object.fromEntries(fm[1].split('\n').map((l) => /^([a-z]+):\s*(.+)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
  if (!STEP.test(meta.page || '')) throw new Error(`${file}: needs "page: <slug>"`);
  const version = Number(meta.version);
  if (!Number.isInteger(version) || version < 1) throw new Error(`${file}: needs "version: <whole number>"`);
  const status = meta.status || 'draft';
  if (!['draft', 'reviewed'].includes(status)) throw new Error(`${file}: status must be draft or reviewed`);
  const chunks = text.slice(fm[0].length).split(/^## /m).slice(1);
  const questions = chunks.map((c) => parseQuestion(c, file));
  if (questions.length < 3 || questions.length > 5) throw new Error(`${file}: needs 3 to 5 questions, has ${questions.length}`);
  return { page: meta.page, version, status, questions };
}

function parseQuestion(chunk, file) {
  const lines = chunk.split('\n');
  const name = lines.shift().trim();
  const where = `${file}: "${name}"`;
  const blocks = []; // { kind: 'fence' | 'para' | 'choices' | 'items', ... }
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const code = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      if (i >= lines.length) throw new Error(`${where}: a code fence is not closed`);
      blocks.push({ kind: 'fence', code: code.join('\n') }); i++; continue;
    }
    if (/^- \[[ x]\] /.test(line)) {
      const items = [];
      for (; i < lines.length && /^- \[[ x]\] /.test(lines[i]); i++) items.push({ right: lines[i][3] === 'x', text: lines[i].slice(6).trim() });
      blocks.push({ kind: 'list', items }); continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(line) || /^#/.test(line) || line.startsWith('|') || line.startsWith('>')) throw new Error(`${where}: unsupported line: ${line.trim()}`);
    const para = [];
    for (; i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^- \[/.test(lines[i]); i++) para.push(lines[i].trim());
    blocks.push({ kind: 'para', text: para.join(' ') });
  }
  // Every flow needs an "In words:" line right under it, for screen readers.
  blocks.forEach((b, n) => { if (b.kind === 'fence' && !(blocks[n + 1] && blocks[n + 1].kind === 'para' && /^In words:/.test(blocks[n + 1].text))) throw new Error(`${where}: a flow needs an "In words:" paragraph right under it`); });
  const take = (label) => { const n = blocks.findIndex((b) => b.kind === 'para' && b.text.startsWith(label)); return n < 0 ? null : { n, text: blocks[n].text.slice(label.length).trim() }; };
  const why = take('**Why:**');
  if (!why || !why.text) throw new Error(`${where}: needs a "**Why:**" paragraph`);
  const selfAt = take('**Self-check:**');
  if (selfAt) {
    const list = blocks[selfAt.n + 1];
    const model = take('**Model answer:**');
    if (!list || list.kind !== 'list' || list.items.length < 2) throw new Error(`${where}: "**Self-check:**" needs a checklist under it`);
    if (!model || !model.text) throw new Error(`${where}: a self-check needs a "**Model answer:**" paragraph`);
    if (blocks.length !== selfAt.n + 4 || model.n !== selfAt.n + 2 || why.n !== selfAt.n + 3) throw new Error(`${where}: a self-check is: task, "**Self-check:**", checklist, "**Model answer:**", "**Why:**", in that order`);
    const before = blocks.slice(0, selfAt.n);
    const prompt = before.pop();
    if (!prompt || prompt.kind !== 'para') throw new Error(`${where}: needs a prompt paragraph before "**Self-check:**"`);
    return { name, self: true, setup: before, prompt: prompt.text, items: list.items.map((x) => x.text), model: model.text, why: why.text };
  }
  const at = blocks.findIndex((b) => b.kind === 'list');
  if (at < 0) throw new Error(`${where}: needs choices ("- [x]" and "- [ ]")`);
  if (blocks.filter((b) => b.kind === 'list').length > 1) throw new Error(`${where}: only one list of choices`);
  // After the choices, only the "**Why:**" paragraph may follow; anything else would be silently lost.
  if (blocks.length !== at + 2 || why.n !== at + 1) throw new Error(`${where}: after the choices, put only the "**Why:**" paragraph`);
  const choices = blocks[at].items;
  if (choices.length < 2 || choices.length > 5) throw new Error(`${where}: needs 2 to 5 choices`);
  const right = choices.filter((c) => c.right).length;
  if (!right) throw new Error(`${where}: needs at least one "- [x]" right choice`);
  if (choices.some((c) => /^all of the above/i.test(c.text))) throw new Error(`${where}: no "all of the above"`);
  const prompt = blocks[at - 1];
  if (!prompt || prompt.kind !== 'para' || prompt.text.startsWith('**')) throw new Error(`${where}: needs a prompt paragraph right before the choices`);
  if (right > 1 && !/pick all that apply/i.test(prompt.text)) throw new Error(`${where}: more than one right choice, so the prompt must say "Pick all that apply."`);
  if (right === 1 && /pick all that apply/i.test(prompt.text)) throw new Error(`${where}: the prompt says "Pick all that apply" but only one choice is right`);
  return { name, self: false, multi: right > 1, setup: blocks.slice(0, at - 1), prompt: prompt.text, choices, why: why.text };
}

export function loadChecks(dir, pages) {
  const checks = new Map();
  const cdir = join(dir, 'checks');
  if (!existsSync(cdir)) return checks;
  for (const name of readdirSync(cdir).sort()) {
    if (!name.endsWith('.md')) continue;
    const c = parseCheck(readFileSync(join(cdir, name), 'utf8'), `checks/${name}`);
    if (c.page + '.md' !== name) throw new Error(`checks/${name}: page "${c.page}" must match the file name`);
    if (!pages.has(c.page)) throw new Error(`checks/${name}: there is no page "${c.page}"`);
    checks.set(c.page, c);
  }
  return checks;
}

// ---------- HTML ----------

// The check at the foot of a page. Without JavaScript it is a readable quiz with the answers in "Show the answer"
// boxes. With JavaScript, check.js turns it into a real quiz. The answer key is in the page on purpose (TRACKS.md §3.4).
export function renderCheck(check, ctx, md) {
  const setup = (blocks) => blocks.map((b) => (b.kind === 'fence' ? md.fenceHtml(b.code) : `<p>${md.inline(b.text, ctx)}</p>`)).join('');
  const qs = check.questions.map((q, n) => {
    const head = `<h3>${md.inline(q.name, ctx)}</h3>${setup(q.setup)}<p class="prompt">${md.inline(q.prompt, ctx)}</p>`;
    if (q.self) {
      return `<div class="q self" data-q="${n}">${head}<details><summary>Show a model answer and checklist</summary><p><strong>Model answer:</strong> ${md.inline(q.model, ctx)}</p><p><strong>Did yours…</strong></p><ul class="checklist">${q.items.map((x) => `<li>${md.inline(x, ctx)}</li>`).join('')}</ul><p class="why"><strong>Why:</strong> ${md.inline(q.why, ctx)}</p></details></div>`;
    }
    const answer = q.choices.filter((c) => c.right).map((c) => md.inline(c.text, ctx)).join('; ');
    return `<div class="q" data-q="${n}" data-multi="${q.multi ? 1 : 0}">${head}<ul class="choices">${q.choices.map((c) => `<li data-key="${c.right ? 1 : 0}">${md.inline(c.text, ctx)}</li>`).join('')}</ul><details><summary>Show the answer</summary><p><strong>Answer:</strong> ${answer}</p><p class="why"><strong>Why:</strong> ${md.inline(q.why, ctx)}</p></details></div>`;
  }).join('\n');
  const draft = check.status === 'reviewed' ? '' : '<p class="draft-note">Draft check: it is waiting for a coach to review it.</p>';
  return `<section class="check" id="check" data-check="${check.page}" data-version="${check.version}" aria-labelledby="check-title">
<h2 id="check-title">Check your understanding</h2>
${draft}<p class="check-intro">${check.questions.length} short questions. Get them all right to finish this step. You can try again as many times as you want. No score is kept.</p>
${qs}
<div class="check-actions" hidden><button type="button" class="btn primary" data-act="grade">Check my answers</button></div>
<p class="check-status" role="status" aria-live="polite"></p>
</section>`;
}

// One line about a track, for the track list and the library home. Tracks that are not ready show as plain text.
function trackItem(t, state, href, md) {
  if (!state.ready) return `<li>${md.esc(t.name)} (coming soon): ${md.esc(t.promise)}</li>`;
  return `<li><a href="${href}">${md.esc(t.name)}</a>${state.live ? '' : ' (draft, in review)'}: ${md.esc(t.promise)} ${t.steps.length} steps.</li>`;
}

// One track page (learn/tracks/<id>/). Without JavaScript it is an ordered list of links. check.js adds ticks,
// "Resume", the progress line, the certificate and the progress buttons.
export function renderTrack(track, state, pages, href, md) {
  const steps = track.steps.map((s) => `<li data-step="${s}"><a href="${href(s)}">${md.esc(pages.get(s).h1Text)}</a> <span class="tick"></span></li>`).join('');
  const draft = state.live ? '' : '<p class="draft-note">Draft track: its checks are waiting for coach review.</p>';
  return `<h1>${md.esc(track.name)}</h1>
${draft}<blockquote class="plain"><p><strong>Promise.</strong> ${md.esc(track.promise)} About ${Number(track.minutes) || 30} minutes. Read each page, then do the short check at the foot of the page.</p></blockquote>
<section class="track" data-track="${track.id}" data-steps="${track.steps.join(' ')}" aria-labelledby="steps-title">
<h2 id="steps-title">Steps</h2>
<p class="track-progress" role="status" hidden></p>
<ol class="steps">${steps}</ol>
<p class="resume" hidden><a href="${href(track.steps[0])}">Resume</a></p>
</section>
${progressBox(certificateTools())}
${certificate(track, md)}`;
}

// "Your progress": the privacy note and the save / load / clear buttons. `inner` adds the certificate tools on track pages.
function progressBox(inner = '') {
  return `<section class="progress-tools" aria-labelledby="progress-title">
<h2 id="progress-title">Your progress</h2>
<p>Your progress is saved only in this browser. Nothing is sent to anyone. On a shared computer, the next person can see it, so clear it when you finish.</p>
<p class="nojs-note">Turn on JavaScript to save your progress and print a certificate.</p>
${inner}<div class="tools" hidden><button type="button" class="btn" data-act="export">Save progress to a file</button> <label class="btn">Load progress from a file <input type="file" accept="application/json,.json" data-act="import" hidden></label> <button type="button" class="btn" data-act="clear">Clear my progress</button></div>
<p class="tools-status" role="status" aria-live="polite"></p>
</section>`;
}

function certificateTools() {
  return `<div class="cert-tools" hidden>
<h3>Certificate of completion</h3>
<p>When you finish every step, you can print a certificate. Type the name you want on it. The name is not saved or sent.</p>
<p><label>Name on the certificate <input type="text" data-cert-name autocomplete="off" maxlength="80"></label></p>
<p><button type="button" class="btn primary" data-act="print">Print a certificate</button></p>
</div>
`;
}

// The printed certificate. check.js fills the name and date as text when the reader prints it.
function certificate(track, md) {
  return `<div class="cert" hidden aria-hidden="true">
<p class="cert-kicker">Certificate of completion</p>
<p class="cert-name" data-cert-out></p>
<p>completed the Tabula <strong>${md.esc(track.name)}</strong> track.</p>
<p class="cert-date" data-cert-date></p>
<p class="cert-fine">A free, self-paced course from the Tabula Debate Library. Not a certification or endorsement by any league or tournament. Not verified.</p>
</div>`;
}

// The list of all tracks (learn/tracks/).
export function renderTrackList(tracks, states, href, md) {
  return `<h1>Guided tracks</h1>
<blockquote class="plain"><p>A track is a short course: library pages in order, with a quick check at the foot of each page.</p><ul><li><strong>Your progress:</strong> it is saved only in your browser. There is no sign-up.</li></ul></blockquote>
<ul class="track-list">${tracks.map((t) => trackItem(t, states.get(t.id), href(t.id), md)).join('')}</ul>
${progressBox()}`;
}


// The "Guided tracks" box on the library home (TRACKS.md §3.4). `href(id)` links from the home page.
export function renderHomeTracks(tracks, states, href, md) {
  const items = tracks.filter((t) => states.get(t.id).ready).map((t) => trackItem(t, states.get(t.id), href(`tracks/${t.id}`), md)).join('');
  return `<h2 id="guided-tracks">Guided tracks</h2>\n<p>Want a short course instead? A track walks you through the pages in order, with a quick check after each one. <a href="${href('tracks')}">See all guided tracks</a>.</p>${items ? `<ul>${items}</ul>` : ''}`;
}

// The page objects for learn/tracks/ and each ready track (id -> { meta, h1Text, html, script, noindex }).
// A draft (not live) page gets noindex and stays out of the sitemap. The list page is a draft while no track is live.
export function buildTrackPages(tracks, states, pages, { relHref, latest }, md) {
  const out = new Map();
  if (!tracks.length) return out;
  const anyLive = [...states.values()].some((s) => s.live);
  out.set('tracks', { meta: { title: 'Guided Debate Tracks: Learn Policy Debate Step by Step', description: 'Free guided tracks through the Tabula Debate Library: short courses for new judges and debaters, with a quick check after each page. No sign-up.', section: 'Guided tracks', updated: latest() },
    h1Text: 'Guided tracks', html: renderTrackList(tracks, states, (id) => relHref('tracks', `tracks/${id}`), md), script: true, noindex: !anyLive });
  for (const t of tracks) {
    const st = states.get(t.id);
    if (!st.ready) continue;
    const id = `tracks/${t.id}`;
    out.set(id, { meta: { title: t.title, description: t.description, section: t.name, updated: latest(t.steps) }, h1Text: t.name,
      html: renderTrack(t, st, pages, (s) => relHref(id, s), md), script: true, noindex: !st.live });
  }
  return out;
}
