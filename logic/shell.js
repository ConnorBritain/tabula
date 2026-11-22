// Shell and reach (Slice 5): the corner chip, the offline note, the narrow clock view lines and the study mode.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');
  const { formatClock } = part('round');
  const { shortSpeech } = part('rules');

  // ---------- Slice 5: shell and reach (docs/design/SPEC.md §3.5) ----------

  // The side's word on screen ('Aff', 'Pro'; 'Both' for a crossfire row). fmt: policy-hs when not given.
  const sideName = (side, fmt) => F.sideLabel(fmt || F.POLICY, side);
  // fmt below: the round's format (policy-hs when not given).
  const speechOf = (id, fmt) => F.speechOf(fmt || F.POLICY, id);

  // 5.2 The corner chip. It shows off Flow while a speech or prep clock runs (Q-1). st: { onFlow, run: { id, left }
  // or null (the running speech, also while the judge views another one), prep: { side, left } or null; side is the
  // prep clock's side }, format: the round's format.
  // Returns null when hidden (on Flow, or nothing runs), else { text, tone: '' | 'caution' | 'error', side, kind, said }.
  // said is the one message that plays when the chip appears.
  function chipText(st) {
    const s = st || {};
    if (s.onFlow) return null;
    if (s.run && speechOf(s.run.id, s.format)) {
      const name = shortSpeech(s.run.id), left = Math.ceil(Number(s.run.left));
      const side = speechOf(s.run.id, s.format).side;
      if (left <= 0) return { text: name + ' · ' + formatClock(-left) + ' over', tone: 'error', side, kind: 'speech', said: name + ' clock still running' };
      return { text: name + ' · ' + formatClock(left), tone: left <= 30 ? 'caution' : '', side, kind: 'speech', said: name + ' clock still running' };
    }
    if (s.prep && (s.prep.side === 'aff' || s.prep.side === 'neg')) {
      const left = Math.max(0, Math.ceil(Number(s.prep.left)));
      return { text: sideName(s.prep.side, s.format) + ' prep · ' + formatClock(left), tone: left <= 30 ? 'caution' : '', side: s.prep.side, kind: 'prep', said: sideName(s.prep.side, s.format) + ' prep clock still running' };
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

  // 5.6b The narrow clock view. "1NC · Neg · 1N · 8 min". With one debater per side (LD) the debater adds nothing:
  // "NC · Neg · 7 min".
  function speechLine(id, fmt) {
    const f = fmt || F.POLICY;
    const s = speechOf(id, f); if (!s) return '';
    const who = F.speakersOn(f, s.side).length > 1 ? [s.speaker] : [];
    return [shortSpeech(s.id), sideName(s.side, f), ...who, s.minutes + ' min'].join(' · ');
  }
  // The word under the big clock. Colour never carries it alone (colour rule 5).
  function clockStatus(running, left) {
    if (Math.ceil(Number(left)) <= 0) return 'Over time';
    return running ? 'Running' : 'Paused';
  }
  // The prep cards' line while a speech runs: a prep start pauses it.
  const prepPausesLine = (runId, fmt) => (runId && speechOf(runId, fmt) ? 'Pauses the ' + shortSpeech(runId) : '');
  // [Previous] and [Next speech] in the clock view say why they do nothing at the ends.
  function stepSpeechState(cur, dir, fmt) {
    const speeches = (fmt || F.POLICY).speeches;
    const i = Number(cur) + dir;
    if (i < 0) return { disabled: true, reason: 'Already at ' + speeches[0].id };
    if (i >= speeches.length) return { disabled: true, reason: 'Already at ' + speeches[speeches.length - 1].id };
    return { disabled: false, reason: '', to: i };
  }

  // 5.7 Study mode (Q16, Part 6.3). It is on only when the address has ?study=1. It never turns on by itself.
  function studyOn(search) {
    try { return new URLSearchParams(String(search || '')).get('study') === '1'; } catch { return false; }
  }
  // Two local time marks: the first view, and the first Start of the format's first speech (the 1AC in policy, the AC
  // in LD) by any method. A mark that exists is never moved. The start mark keeps which speech it was (firstSpeech).
  // ev: { type: 'view' | 'start', at (ms), speechId (for 'start') }. fmt: the round's format (policy-hs when not given).
  function studyMark(marks, ev, fmt) {
    const m = Object.assign({}, marks || {});
    if (!ev || !Number.isFinite(ev.at)) return m;
    const first = (fmt || F.POLICY).speeches[0].id;
    if (ev.type === 'view' && !m.firstView) m.firstView = ev.at;
    if (ev.type === 'start' && ev.speechId === first && m.firstView && !m.firstStart) {
      m.firstStart = Math.max(ev.at, m.firstView);
      m.firstSpeech = first;
    }
    return m;
  }
  // "Study: 0:47 to start" and the line [Copy result] copies, or null until both marks exist. A mark saved before
  // formats has no firstSpeech: study mode then counted only the 1AC.
  function studyResult(marks) {
    const m = marks || {};
    if (!Number.isFinite(m.firstView) || !Number.isFinite(m.firstStart)) return null;
    const seconds = Math.max(0, Math.round((m.firstStart - m.firstView) / 1000));
    const clock = formatClock(seconds);
    return { seconds, text: 'Study: ' + clock + ' to start', copy: 'Tabula study: ' + clock + ' (' + seconds + ' s) from first view to the first ' + (m.firstSpeech || '1AC') + ' Start.', pass: seconds <= 60 };
  }

  const api = { chipText, chipTip, CHIP_NAME_MS, chipNameDue, NET_TIP, netNote, speechLine, clockStatus, prepPausesLine,
    stepSpeechState, studyOn, studyMark, studyResult };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).shell = api;
})(typeof window !== 'undefined' ? window : globalThis);
