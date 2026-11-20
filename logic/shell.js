// Shell and reach (Slice 5): the corner chip, the offline note, the narrow clock view lines and the study mode.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const { SPEECHES, formatClock } = part('round');
  const { shortSpeech } = part('rules');

  // ---------- Slice 5: shell and reach (docs/design/SPEC.md §3.5) ----------

  const sideName = (side) => (side === 'aff' ? 'Aff' : 'Neg');
  const speechOf = (id) => SPEECHES.find((s) => s.id === id) || null;

  // 5.2 The corner chip. It shows off Flow while a speech or prep clock runs (Q-1). st: { onFlow, run: { id, left }
  // or null (the running speech, also while the judge views another one), prep: { side, left } or null }.
  // Returns null when hidden (on Flow, or nothing runs), else { text, tone: '' | 'caution' | 'error', side, kind, said }.
  // said is the one message that plays when the chip appears.
  function chipText(st) {
    const s = st || {};
    if (s.onFlow) return null;
    if (s.run && speechOf(s.run.id)) {
      const name = shortSpeech(s.run.id), left = Math.ceil(Number(s.run.left));
      const side = speechOf(s.run.id).side;
      if (left <= 0) return { text: name + ' · ' + formatClock(-left) + ' over', tone: 'error', side, kind: 'speech', said: name + ' clock still running' };
      return { text: name + ' · ' + formatClock(left), tone: left <= 30 ? 'caution' : '', side, kind: 'speech', said: name + ' clock still running' };
    }
    if (s.prep && (s.prep.side === 'aff' || s.prep.side === 'neg')) {
      const left = Math.max(0, Math.ceil(Number(s.prep.left)));
      return { text: sideName(s.prep.side) + ' prep · ' + formatClock(left), tone: left <= 30 ? 'caution' : '', side: s.prep.side, kind: 'prep', said: sideName(s.prep.side) + ' prep clock still running' };
    }
    return null;
  }
  // 5.2 The chip's tip: where a click goes and when the clock ends. endsAt: the local time, for example "10:42".
  const chipTip = (endsAt, over) => 'Back to Flow · ' + (over ? 'ended at ' : 'ends at ') + endsAt;
  // 5.2 The chip's accessible name updates at most every 15 s, so a screen reader is not flooded by the seconds.
  const CHIP_NAME_MS = 15000;
  function chipNameDue(lastAt, now, changedKind) { return Boolean(changedKind) || !lastAt || now - lastAt >= CHIP_NAME_MS; }

  // 5.1 The offline note in the top bar. online: navigator.onLine; was: the last state. Returns the text to show
  // ('' shows nothing): "Offline" while offline, "Back online" for a moment after the network returns.
  const NET_TIP = 'No internet. Timers, flow and ballot still work. AI waits until you are back online.';
  function netNote(online, wasOnline) {
    if (online === false) return 'Offline';
    return wasOnline === false ? 'Back online' : '';
  }

  // 5.6b The narrow clock view. "1NC · Neg · 1N · 8 min".
  function speechLine(id) {
    const s = speechOf(id); if (!s) return '';
    return shortSpeech(s.id) + ' · ' + sideName(s.side) + ' · ' + s.speaker + ' · ' + s.minutes + ' min';
  }
  // The word under the big clock. Colour never carries it alone (colour rule 5).
  function clockStatus(running, left) {
    if (Math.ceil(Number(left)) <= 0) return 'Over time';
    return running ? 'Running' : 'Paused';
  }
  // The prep cards' line while a speech runs: a prep start pauses it.
  const prepPausesLine = (runId) => (runId && speechOf(runId) ? 'Pauses the ' + shortSpeech(runId) : '');
  // [Previous] and [Next speech] in the clock view say why they do nothing at the ends.
  function stepSpeechState(cur, dir) {
    const i = Number(cur) + dir;
    if (i < 0) return { disabled: true, reason: 'Already at ' + SPEECHES[0].id };
    if (i >= SPEECHES.length) return { disabled: true, reason: 'Already at ' + SPEECHES[SPEECHES.length - 1].id };
    return { disabled: false, reason: '', to: i };
  }

  // 5.7 Study mode (Q16, Part 6.3). It is on only when the address has ?study=1. It never turns on by itself.
  function studyOn(search) {
    try { return new URLSearchParams(String(search || '')).get('study') === '1'; } catch { return false; }
  }
  // Two local time marks: the first view, and the first 1AC Start by any method. A mark that exists is never moved.
  // ev: { type: 'view' | 'start', at (ms), speechId (for 'start') }.
  function studyMark(marks, ev) {
    const m = Object.assign({}, marks || {});
    if (!ev || !Number.isFinite(ev.at)) return m;
    if (ev.type === 'view' && !m.firstView) m.firstView = ev.at;
    if (ev.type === 'start' && ev.speechId === '1AC' && m.firstView && !m.firstStart) m.firstStart = Math.max(ev.at, m.firstView);
    return m;
  }
  // "Study: 0:47 to start" and the line [Copy result] copies, or null until both marks exist.
  function studyResult(marks) {
    const m = marks || {};
    if (!Number.isFinite(m.firstView) || !Number.isFinite(m.firstStart)) return null;
    const seconds = Math.max(0, Math.round((m.firstStart - m.firstView) / 1000));
    const clock = formatClock(seconds);
    return { seconds, text: 'Study: ' + clock + ' to start', copy: 'Tabula study: ' + clock + ' (' + seconds + ' s) from first view to the first 1AC Start.', pass: seconds <= 60 };
  }

  const api = { chipText, chipTip, CHIP_NAME_MS, chipNameDue, NET_TIP, netNote, speechLine, clockStatus, prepPausesLine,
    stepSpeechState, studyOn, studyMark, studyResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).shell = api;
})(typeof window !== 'undefined' ? window : globalThis);
