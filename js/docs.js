// Round documents (kept in IndexedDB) and SpeechDrop import.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

// ---------- round documents ----------
// Docs can be large (PDFs), so they live in IndexedDB, not localStorage.
// If IndexedDB is not available, they are kept in memory for this page only.
let DOCS = [];
const docStore = {
  db: null,
  opening: null,
  async open() {
    if (this.db) return this.db;
    // One open request at a time; every caller waits for the same one.
    this.opening ??= new Promise((res, rej) => {
      const r = indexedDB.open('policyJudge', 2);
      // Version 2 adds 'clips': audio waiting to be transcribed (deleted once its text is back).
      r.onupgradeneeded = () => { const db = r.result; for (const name of ['docs', 'clips']) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' }); };
      r.onsuccess = () => {
        const db = r.result;
        // A newer Tabula in another tab needs to update the database: step aside so it is not stuck.
        db.onversionchange = () => { db.close(); if (this.db === db) this.db = null; toast('Tabula was updated in another tab. Reload this tab.'); };
        this.db = db; res(db);
      };
      r.onerror = () => rej(r.error);
      // An older Tabula tab still has the database open. Keep waiting (the update finishes when it closes);
      // each storage step (storageStep) still gives up after 3 s, so the app does not freeze meanwhile.
      r.onblocked = () => toast('Close other Tabula tabs or windows to finish an update.');
    }).finally(() => { this.opening = null; });
    return this.opening;
  },
  async tx(mode, fn) { return storageStep('docs', mode, fn); },
  async list(roundId) { return ((await this.tx('readonly', (st) => st.getAll())) || []).filter((d) => d.roundId === roundId); },
  put(doc) { if (restoring) return Promise.resolve(); return this.tx('readwrite', (st) => st.put(doc)); }, // no stray writes during a restore
  del(id) { return this.tx('readwrite', (st) => st.delete(id)); },
  async clearRound(roundId) { try { for (const d of await this.list(roundId)) await this.del(d.id); } catch {} },
};

// One storage step on a store of the app's database. Never let a stuck browser database freeze the app:
// the whole step (opening included) must finish in 3 s.
async function storageStep(name, mode, fn) {
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('storage timed out')), 3000); });
  const work = (async () => {
    const db = await docStore.open();
    return new Promise((res, rej) => {
      const t = db.transaction(name, mode); const req = fn(t.objectStore(name));
      t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('storage aborted'));
    });
  })();
  try { return await Promise.race([work, timeout]); } finally { clearTimeout(timer); }
}
// Audio clips waiting for their text. Same database as the docs, its own store, never in a backup.
const clipStore = {
  tx(mode, fn) { return storageStep('clips', mode, fn); },
  put(rec) { return this.tx('readwrite', (st) => st.put(rec)); },
  del(id) { return this.tx('readwrite', (st) => st.delete(id)); },
  all() { return this.tx('readonly', (st) => st.getAll()).then((x) => x || []); },
  clear() { return this.tx('readwrite', (st) => st.clear()); },
};
// On start: audio from other rounds is deleted; this round's waiting clips (a reload mid-speech) are sent again.
async function resumeClips() {
  try {
    const all = await clipStore.all();
    for (const c of all) if (c.roundId !== R.id) await clipStore.del(c.id);
    // Clips already applied (a reload between applying and deleting) are deleted, never applied twice.
    const applied = new Set(R.appliedClips || []);
    for (const c of all) if (c.roundId === R.id && applied.has(c.id)) await clipStore.del(c.id);
    const mine = all.filter((c) => c.roundId === R.id && !applied.has(c.id));
    if (mine.length) { CQ.resume(mine); toast(mine.length + ' audio clip' + (mine.length > 1 ? 's' : '') + ' from before the reload are being transcribed.'); }
  } catch { /* storage unavailable: nothing to resume */ }
}
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(',')[1] || '');
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(file);
  });
}
let mammothReady = null;
function loadMammoth() {
  mammothReady ??= new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = 'vendor/mammoth-1.6.0.browser.min.js';
    el.integrity = 'sha512-sG5Q7boJL+ft/weuz6Mmi9XBD+bEzE9AI2FMP4YMFxp3FpTFUQSQQm5K5cSgJCyed6bWs3W8f8h0lp36lHXhQA=='; el.crossOrigin = 'anonymous';
    el.onload = () => res(window.mammoth); el.onerror = () => { mammothReady = null; rej(new Error('could not load the Word reader (needs internet)')); };
    document.head.append(el);
  });
  return mammothReady;
}
async function readDoc(file) {
  const name = file.name;
  if (/\.pdf$/i.test(name) || file.type === 'application/pdf') return { kind: 'pdf', data: await fileToBase64(file) };
  if (/\.docx$/i.test(name)) {
    const m = await loadMammoth();
    let out;
    try { out = await m.extractRawText({ arrayBuffer: await file.arrayBuffer() }); }
    catch { throw new Error('could not read this Word file. Try saving it as PDF'); }
    return { kind: 'text', data: out.value || '' };
  }
  if (/\.doc$/i.test(name)) throw new Error('old .doc files are not supported. Save it as .docx or PDF');
  return { kind: 'text', data: await file.text() };
}
// Claude takes up to 32 MB per request, and base64 makes PDFs about 1/3 bigger.
const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 400000;
function docBytes(d) { return d.kind === 'pdf' ? Math.round(d.data.length * 0.75) : d.data.length; }
const FLOW_SPEECHES = ['1AC', '1NC', '2AC', '2NC', '1NR', '1AR', '2NR', '2AR'];
function speechPicker(d) {
  const cur = L.docSpeech(d);
  return `<select data-doc-speech="${d.id}" class="w-auto" aria-label="Speech for ${escapeHtml(d.name || 'this doc')}" data-tip="Which speech this doc belongs to. It is mapped onto that speech's flow column.">`
    + `<option value=""${cur === '' ? ' selected' : ''}>Context only</option>`
    + FLOW_SPEECHES.map((sp) => `<option${sp === cur ? ' selected' : ''}>${sp}</option>`).join('') + '</select>';
}
// Re-flow a speech after its docs change. If nothing is left to flow it from, clear its AI notes.
function reflowForDocs(speechId) {
  if (!speechId || !can('aiFlow')) return;
  const hasSource = (R.transcripts[speechId] || '').trim() || DOCS.some((d) => L.docSpeech(d) === speechId);
  if (hasSource) scheduleFlow(speechId, true);
  else { R.aiFlows = L.applyLiveFlow(R.aiFlows, speechId, { sheets: [] }); save(); if (R.tab === 'flow') renderFlow(); }
}
function renderDocs() {
  const total = DOCS.reduce((n, d) => n + docBytes(d), 0);
  document.querySelectorAll('.doc-count').forEach((el) => { el.textContent = DOCS.length ? DOCS.length + ' (' + DOCS.map((d) => L.DOC_SIDES[d.side] + ': ' + d.name).join(', ') + ')' : 'none'; });
  $('#doc-list').innerHTML = DOCS.length
    ? DOCS.map((d) => `<tr><td class="${d.side === 'aff' ? 'aff' : d.side === 'neg' ? 'neg' : ''}">${L.DOC_SIDES[d.side]}</td><td>${escapeHtml(d.name)}</td><td>${speechPicker(d)}</td><td class="muted">${d.kind === 'pdf' ? 'PDF' : 'text'} · ${Math.max(1, Math.round(docBytes(d) / 1024))} KB</td><td><button class="b" data-doc-del="${d.id}">Remove</button></td></tr>`).join('')
      + `<tr><td colspan="5" class="muted">Total ${Math.round(total / 1024)} KB${total > MAX_DOC_BYTES ? ' — too big; remove some docs' : ''}</td></tr>`
    : '<tr><td class="muted">No documents yet.</td></tr>';
}
// One upload path for every place a doc can be added (Setup, Timer, Flow, drag and drop).
// Returns the docs that were added (a file that fails is left out).
async function addDocFiles(files, side, statusEl, speech) {
  const added = [];
  for (const file of files) {
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) { statusEl.textContent = file.name + ': only PDF, .docx, .txt or .md files'; continue; }
    statusEl.textContent = 'Reading ' + file.name + '…';
    try {
      const { kind, data } = await readDoc(file);
      if (!data.trim()) throw new Error('no text found');
      const doc = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())), roundId: R.id, name: file.name, side, kind, data, addedAt: Date.now() };
      if (speech !== undefined) doc.speech = speech;
      if (DOCS.reduce((n, d) => n + docBytes(d), 0) + docBytes(doc) > MAX_DOC_BYTES) throw new Error('too big. Keep all docs under 15 MB');
      const textChars = DOCS.concat([doc]).filter((d) => d.kind !== 'pdf').reduce((n, d) => n + d.data.length, 0);
      if (textChars > MAX_TEXT_CHARS) throw new Error('too much text. Keep Word/text docs under about 400,000 characters in total');
      DOCS.push(doc); added.push(doc);
      renderDocs();
      const sp = L.docSpeech(doc);
      statusEl.textContent = 'Added ' + file.name + ' (' + L.DOC_SIDES[side] + (sp ? ', mapped to ' + sp : '') + ')';
      if (sp) {
        if (S.liveFlow && aiReady()) scheduleFlow(sp, true);
        else if (can('aiFlow')) statusEl.textContent += showSetup() ? '. Connect AI and turn on Live AI flow to map it onto the flow.' : '. Turn on Live AI flow in Settings to map it onto the flow.';
      }
      docStore.put(doc).catch(() => toast(file.name + ' is kept for this page only. It will be gone after a refresh.'));
    } catch (err) {
      statusEl.textContent = file.name + ': ' + err.message;
    }
    renderDocs();
  }
  return added;
}
// ---------- SpeechDrop import ----------
// The judge types the room code; Tabula lists the files (through the local helper), the judge ticks
// the ones to add, and each is guessed onto a speech from its name. New uploads are checked every 30 s.
// The list is drawn again only when the files change, and the judge's ticks and speech choices live in SD.picks,
// so a 30-second check never undoes what the judge picked.
const SD = { files: [], seen: new Set(), fresh: new Set(), loaded: false, timer: null, busy: false, adding: false, picks: {} };
const sdState = () => (R.speechDrop ??= { code: '', imported: {} });
// A file is known by its slot and its name together, so a reused slot never looks already added.
const sdKey = (f) => f.i + ':' + f.name;
const sdSpeeches = [['', 'Context only']].concat(L.MAP_SPEECHES.map((id) => [id, id]));
const SD_BOX = `<h3 class="sd-h">From SpeechDrop</h3>
<div class="sd-box">
  <div class="row sd-row"><input class="sd-code" placeholder="SpeechDrop code or link" aria-label="SpeechDrop room code" autocomplete="off" spellcheck="false"><button class="b sd-get">Get files</button></div>
  <p class="muted sd-status" role="status" aria-live="polite"></p>
  <div class="sd-list"></div>
</div>`;
// One box in the Round docs card and one in the Flow left pane, built from the same template.
// On the website there is no helper to ask SpeechDrop, so the boxes stay hidden there.
document.querySelectorAll('.sd-mount').forEach((m) => { m.hidden = !LOCAL_ORIGIN; if (LOCAL_ORIGIN) m.innerHTML = SD_BOX; });
function sdStatus(msg) { document.querySelectorAll('.sd-status').forEach((el) => { el.textContent = msg; }); }
function sdPick(i) { return (SD.picks[i] ??= { checked: false, speech: L.guessSpeech((SD.files.find((f) => f.i === i) || {}).name) }); }
function renderSdList() {
  const st = sdState();
  document.querySelectorAll('.sd-box').forEach((box) => {
    const inp = box.querySelector('.sd-code');
    if (document.activeElement !== inp) inp.value = st.code || '';
    box.querySelector('.sd-list').innerHTML = !SD.files.length ? '' : SD.files.map((f) => {
      const done = st.imported[sdKey(f)], p = sdPick(f.i);
      return `<label class="sd-file${done ? ' sd-done' : ''}"><input type="checkbox" data-sd-i="${f.i}"${p.checked && !done ? ' checked' : ''}${done ? ' disabled' : ''}>
        <span class="sd-name" data-tip="${escapeHtml(f.name)}">${escapeHtml(f.name)}${done ? ' · added' : SD.fresh.has(sdKey(f)) ? '<span class="sd-new">new</span>' : ''}</span>
        <select data-sd-speech="${f.i}" aria-label="Speech for ${escapeHtml(f.name)}"${done ? ' disabled' : ''}>${sdSpeeches.map(([v, t]) => `<option value="${v}"${v === p.speech ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
    }).join('') + '<div class="sd-actions"><button class="b primary sd-add">Add selected</button><span class="muted">Checks for new files every 30 s.</span></div>';
  });
}
async function sdApi(path, ms) {
  const r = await fetch('/api/speechdrop/' + path, { headers: { 'X-Tabula': '1' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'the helper said ' + r.status); }
  return r;
}
async function sdFetchList(quiet) {
  const code = sdState().code;
  if (!code || !LOCAL_ORIGIN) return;
  if (SD.busy) { SD.again = SD.again === undefined ? quiet : SD.again && quiet; return; } // runs right after the current check
  SD.busy = true;
  try {
    const j = await (await sdApi(encodeURIComponent(code), 20000)).json();
    if (sdState().code !== code) return; // the judge typed another code while this was on its way
    const fresh = SD.loaded ? j.files.filter((f) => !SD.seen.has(sdKey(f))).map(sdKey) : [];
    const changed = !SD.loaded || fresh.length || j.files.length !== SD.files.length;
    j.files.forEach((f) => SD.seen.add(sdKey(f)));
    fresh.forEach((i) => SD.fresh.add(i));
    SD.files = j.files; SD.loaded = true;
    if (changed) renderSdList();
    const n = fresh.length;
    if (n) { sdStatus(n + ' new file' + (n > 1 ? 's' : '') + ' in SpeechDrop.'); if (quiet) toast(n + ' new file' + (n > 1 ? 's' : '') + ' in SpeechDrop'); }
    else if (!quiet) sdStatus(j.files.length ? j.files.length + ' file' + (j.files.length > 1 ? 's' : '') + ' in room ' + code + '.' : 'The room is empty so far. Tabula checks again every 30 s.');
  } catch (err) {
    if (!quiet) sdStatus('Could not get the files: ' + (err.name === 'TimeoutError' ? 'the helper did not answer' : err.message) + '.');
  } finally {
    SD.busy = false;
    // A check asked for while this one ran (for example a newly typed code) runs now, loudly if either asked loudly.
    if (SD.again !== undefined) { const q = SD.again; SD.again = undefined; sdFetchList(q); }
  }
}
function sdWatch() {
  clearInterval(SD.timer);
  if (sdState().code && LOCAL_ORIGIN) SD.timer = setInterval(() => { if (!document.hidden) sdFetchList(true); }, 30000);
}
async function sdAdd() {
  if (SD.adding) return;
  const st = sdState(), code = st.code;
  const picked = SD.files.filter((f) => !st.imported[sdKey(f)] && sdPick(f.i).checked);
  if (!picked.length) return sdStatus('Tick the files you want first.');
  SD.adding = true;
  const status = { set textContent(v) { sdStatus(v); } }; // addDocFiles reports progress through this
  try {
    for (const f of picked) {
      const speech = sdPick(f.i).speech;
      sdStatus('Getting ' + f.name + '…');
      try {
        const file = new File([await (await sdApi(encodeURIComponent(code) + '/file/' + f.i, 90000)).blob()], f.name);
        const added = await addDocFiles([file], L.speechSide(speech), status, speech);
        if (added.length && sdState().code === code) { st.imported[sdKey(f)] = true; SD.fresh.delete(sdKey(f)); save(); }
      } catch (err) { sdStatus(f.name + ': ' + err.message); }
    }
  } finally { SD.adding = false; renderSdList(); }
}
document.addEventListener('change', (e) => {
  const t = e.target;
  if (!t.dataset) return;
  // Update the pick and the same control in the other box, without redrawing (so keyboard focus stays put).
  if (t.dataset.sdI != null) {
    sdPick(Number(t.dataset.sdI)).checked = t.checked;
    document.querySelectorAll(`[data-sd-i="${t.dataset.sdI}"]`).forEach((c) => { if (c !== t) c.checked = t.checked; });
  }
  if (t.dataset.sdSpeech != null) {
    sdPick(Number(t.dataset.sdSpeech)).speech = t.value;
    document.querySelectorAll(`[data-sd-speech="${t.dataset.sdSpeech}"]`).forEach((c) => { if (c !== t) c.value = t.value; });
  }
});
document.addEventListener('click', (e) => {
  const get = e.target.closest && e.target.closest('.sd-get');
  if (get) {
    const code = L.parseSpeechDropCode(get.closest('.sd-box').querySelector('.sd-code').value);
    if (!code) return sdStatus('Type the room code from SpeechDrop (letters and numbers), or paste its link.');
    const st = sdState();
    if (code !== st.code) { st.code = code; st.imported = {}; Object.assign(SD, { files: [], seen: new Set(), fresh: new Set(), loaded: false, picks: {} }); save(); renderSdList(); }
    sdStatus('Looking in room ' + code + '…'); sdFetchList(false); sdWatch();
  }
  if (e.target.closest && e.target.closest('.sd-add')) sdAdd();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sd-code')) e.target.closest('.sd-box').querySelector('.sd-get').click(); });

$('#doc-file').addEventListener('change', (e) => {
  const files = [...e.target.files]; e.target.value = '';
  addDocFiles(files, $('#doc-side').value, $('#doc-status'));
});
document.querySelectorAll('.doc-quick').forEach((inp) => inp.addEventListener('change', (e) => {
  const bar = e.target.closest('.docbar');
  const files = [...e.target.files]; e.target.value = '';
  const side = bar.querySelector('.doc-quick-side').value;
  addDocFiles(files, side, bar.querySelector('.doc-quick-status'), timerSpeechFor(bar, side));
}));
// In the Flow workspace, a doc for the side that is speaking maps to the current speech.
// The only doc bar outside Round lives in the Flow workspace's left pane (#tab-timer).
function timerSpeechFor(bar, side) {
  if (!bar.closest('#tab-timer')) return undefined;
  const cur = runSp(); // the speech the clock times, not one the judge is only looking back at
  return cur.side === side && L.speechColumn(cur.id) != null ? cur.id : undefined;
}
// Drag and drop: the side comes from the picker on the tab you are on.
document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  e.preventDefault();
  const tab = document.querySelector('section.tab.on');
  const bar = tab && tab.querySelector('.docbar');
  const side = bar ? bar.querySelector('.doc-quick-side').value : $('#doc-side').value;
  // Tabs without a doc bar show the result as a pop-up message instead.
  const status = bar ? bar.querySelector('.doc-quick-status') : { set textContent(v) { toast(v); } };
  addDocFiles([...e.dataTransfer.files], side, status, bar ? timerSpeechFor(bar, side) : undefined);
});
$('#doc-list').addEventListener('change', (e) => {
  const id = e.target.dataset.docSpeech; if (!id) return;
  const d = DOCS.find((x) => x.id === id); if (!d) return;
  const old = L.docSpeech(d);
  d.speech = e.target.value;
  docStore.put(d).catch(() => {});
  renderDocs();
  reflowForDocs(old); reflowForDocs(d.speech);
  if (d.speech && !S.liveFlow) toast('Turn on "Live AI flow" in Settings to map docs onto the flow.');
});
$('#doc-list').addEventListener('click', async (e) => {
  const id = e.target.dataset.docDel; if (!id) return;
  const gone = DOCS.find((d) => d.id === id);
  DOCS = DOCS.filter((d) => d.id !== id);
  try { await docStore.del(id); } catch {}
  renderDocs();
  if (gone) reflowForDocs(L.docSpeech(gone));
});
docStore.open().then(async () => {
  const all = (await docStore.tx('readonly', (st) => st.getAll())) || [];
  // Remove docs left over from older rounds.
  for (const d of all) if (d.roundId !== R.id) { try { await docStore.del(d.id); } catch {} }
  DOCS = all.filter((d) => d.roundId === R.id).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
  renderDocs();
}).catch(() => renderDocs());
