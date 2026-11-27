import { escapeHtml as esc } from '../../core/sheets.js';
import { sampleRoom, speech, manualNote, draft, createPlayback } from './scenario.js';
import { parseRoute, roundTarget } from '../js/routes.js';
import { stagesOf } from '../js/profile-layer.js';
import { findRoom } from '../js/room.js';
const chapters = [
  {title:'Set the room', stage:'type', text:'See the event rules below, then begin your practice round.', try:'Choose the event and rules. Enter A12 and B07 on separate lines.', detail:'This fictional Original Oratory room uses NSDA district rules and a 10-minute limit. Maya Chen speaks on a repair table. Jordan Ellis speaks on a quiet bench.'},
  {title:'Follow a speech', stage:'room', text:'Play Maya’s silent sample captions, then try the real timer.', try:'Start and stop the timer. Select another speaker to see their sheet.', detail:'Events has no live transcription screen. These captions illustrate a speech, not a recording or live transcript. The example clock shows a saved 24-second excerpt. Your practice clock runs separately.'},
  {title:'Write useful notes', stage:'room', text:'Read the sample observation below. Try writing your own feedback.', try:'Edit the comment. Try a Strength chip, then Tab to the private note.', detail:'Comments go on the ballot. Private notes and rule flags do not. The sample separates an observation from a useful next step.'},
  {title:'Review a saved AI draft', stage:'review', text:'See how a saved rewrite can clarify the judge’s own words.', try:'Open the AI edit beside the sample comment to compare both versions.', detail:'This saved synthetic draft rewrites the sample manual note. It does not assess the speech. Only whole-comment Clarify has a saved result. Other text or requests show an error without calling AI. Use this refuses to replace a comment changed after the draft opened.'},
  {title:'Make your decision', stage:'rank', text:'The sample judge puts Maya first for addressing safety.', try:'Set your ranks or ratings, then write the reason for your decision.', detail:'Jordan’s sample note leaves maintenance open. These are fictional judge decisions, not AI rankings. You can choose a different order.'},
  {title:'Copy your ballot', stage:'review', text:'Review each part of the sample ballot before copying it.', try:'Copy the ranks, each comment, and the reason to finish this local round.', detail:'Use the individual Copy controls. Copy all makes combined text but does not mark each part done. Copy puts sample text on your clipboard. Nothing is sent to a tournament.'}
];
export function mountDemo(env) {
  const box = document.createElement('section'); box.className = 'events-demo'; box.setAttribute('aria-label', 'Sample round guide');
  document.querySelector('#main').prepend(box);
  let chapter = 0, caption = 0, mode = 'watch', playing = false, expanded = false;
  let practiceId = null;
  let starting = false;
  const capturePractice = () => {
    const target = roundTarget(parseRoute(location.hash));
    if (mode === 'try' && starting && target && target.id !== 'events-watch' && findRoom(env.rooms(), target.id)) { practiceId = target.id; starting = false; }
  };
  const screen = env.el;
  let cue = null, dismissed = null, frame = 0, disposed = false, message = '';
  const used = new Set();
  // A screen may replace a control after input. Its cue remains dismissed across that redraw.
  const cueKey = el => el ? [el.id, el.dataset.demo, el.dataset.vact, el.dataset.ract, el.dataset.tact, el.dataset.id, el.dataset.what].join('|') : null;
  const visible = el => el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[inert]') && el.getClientRects().length && el.checkVisibility();
  const first = selector => [...screen.querySelectorAll(selector)].find(visible);
  function target() {
    if (screen.dataset.routing === 'true') return null;
    if (mode === 'watch') return box.querySelector(`[data-demo="${chapter === 1 ? 'play' : 'try'}"]`);
    if (chapter === 0) {
      const paste = first('#setup-paste');
      if (paste) return paste.value.trim() ? first('#setup-start') : paste;
      return box.querySelector('[data-demo="next"]');
    }
    if (chapter === 1) return first('.timer-go[data-tact="startstop"]');
    if (chapter === 2) return first('#notes');
    if (chapter === 3) {
      if (first('[data-clean-panel]')) return first(used.has('clean-original') ? '[data-vact="clean-use"], [data-vact="clean-keep"]' : '[data-vact="clean-original"], [data-vact="clean-keep"]');
      if (used.has('clean-use') || used.has('clean-keep')) return box.querySelector('[data-demo="next"]');
      return first('[data-vact="clean"]');
    }
    if (chapter === 4) return first(used.has('rank') ? '#rank-reason, [data-ract="tap"]' : '[data-ract="down"], [data-ract="tap"], [data-ract="num"], [data-ract="word"], [data-ract="pick"]');
    if (chapter === 5) return first('[data-vact="copy"].primary');
    return null;
  }
  function instruction(next) {
    if (message) return message;
    if (mode === 'watch' && playing) return `Reading silent sample caption ${caption+1} of ${speech.length}. Pause or advance at any time.`;
    if (mode === 'watch') return chapters[chapter].text;
    if (chapter === 0 && next?.id === 'setup-start') return 'Check the roster preview, then start the room.';
    if (chapter === 0 && practiceId) return 'Your room is ready. Continue to the timer.';
    if (chapter === 3 && first('[data-clean-panel] [role="status"]')) return 'Opening the saved synthetic draft…';
    if (chapter === 3 && first('[data-clean-panel]')) return first('[data-vact="clean-original"]') ? 'Compare Original and Suggested. Choose Use this or Keep mine.' : 'The sample could not make this edit. Keep your own words.';
    if (chapter === 3 && (used.has('clean-use') || used.has('clean-keep'))) return 'Your choice is on the ballot below. Continue to your decision.';
    if (chapter === 4 && next?.id === 'rank-reason') return 'The order changed below. Write why you chose it.';
    if (chapter === 5) {
      const room = findRoom(env.rooms(), practiceId);
      if (room?.state === 'done') return 'Your local practice ballot is complete. Nothing was submitted.';
      if (next) return `Next: ${next.textContent.trim().replace(/\s+/g, ' ')}. Each copied part marks your progress.`;
      return 'Complete the ranks and comments first. Use Back for your decision or Chapters for notes.';
    }
    return chapters[chapter].try;
  }
  function updateCue() {
    frame = 0;
    if (disposed) return;
    const next = target();
    if (cue !== next) { cue?.classList.remove('events-demo-target'); cue = next; }
    if (cue && cueKey(cue) !== dismissed) cue.classList.add('events-demo-target');
    const show = box.querySelector('[data-demo="show"]');
    if (show) show.hidden = !next || box.contains(next);
    const body = box.querySelector('[data-instruction]');
    const text = instruction(next);
    if (body && body.textContent !== text) body.textContent = text;
  }
  function scheduleCue() { if (!disposed && !frame) frame = requestAnimationFrame(updateCue); }
  env.onRendered = () => { screen.inert = mode === 'watch'; screen.dataset.routing = 'false'; scheduleCue(); };
  const clock = createPlayback({advance: () => { if (mode !== 'watch' || chapter !== 1) return false; if (caption >= speech.length - 1) { playing = false; paint(); return false; } caption++; paint(); return true; }});
  const pause = () => { clock.pause(); playing = false; };
  function open() {
    capturePractice(); pause();
    screen.inert = true;
    screen.dataset.routing = 'true';
    const c = chapters[chapter];
    if (mode === 'watch') env.saveRoom(sampleRoom(env.data, 'events-watch', chapter));
    else if (chapter !== 0 && !practiceId) { practiceId = 'events-practice'; env.saveRoom(sampleRoom(env.data, practiceId, 3)); }
    const id = mode === 'watch' ? 'events-watch' : practiceId;
    starting = mode === 'try' && chapter === 0 && !practiceId;
    let stage = chapter === 0 ? (mode === 'watch' ? 'type' : practiceId ? 'room' : 'setup') : c.stage;
    if (stage === 'rank' && !stagesOf(findRoom(env.rooms(), id)?.profile).includes('rank')) stage = 'review';
    const target = chapter === 0 && (mode === 'watch' || !practiceId) ? 'oo' : id;
    const previous = location.hash;
    env.go(stage, target);
    if (location.hash === previous) env.reload();
    const detail = box.querySelector('[data-guide]'); if (detail) detail.open = expanded;
    paint();
  }
  function paint(status = '') {
    message = status;
    if (box.querySelector('[data-guide]')) expanded = box.querySelector('[data-guide]').open;
    const c = chapters[chapter];
    const focus = box.contains(document.activeElement) ? document.activeElement.dataset.demo : null;
    const label = chapter === 0 ? 'Begin' : chapter === 1 ? 'Try the timer' : chapter === 2 ? 'Try notes' : chapter === 3 ? 'Try review' : chapter === 4 ? 'Try ranking' : 'Try copying';
    box.innerHTML = `<div class="demo-top"><span class="demo-count" aria-label="Sample, chapter ${chapter+1} of ${chapters.length}, ${mode === 'watch' ? 'Watch example' : 'Practice'}">Sample · ${chapter+1}/${chapters.length}</span><div class="demo-tools">
      <div class="demo-chapter-pick"><select aria-label="Demo chapters" data-chapters><option value="" selected disabled>Chapters</option>${chapters.map((v,i)=>`<option value="${i}">${i+1}. ${esc(v.title)}</option>`).join('')}</select></div>
      <button class="b quiet small" data-demo="more" aria-expanded="${expanded}" aria-controls="demo-detail">Details</button><a class="b quiet small" href="./#/new" aria-label="Leave sample · New real round">Exit</a></div></div>
      <div class="demo-task"><h2 tabindex="-1" id="demo-heading">${esc(c.title)}</h2><p data-instruction role="status">${esc(status || (mode==='watch'?c.text:c.try))}</p></div>
      <div class="demo-actions">${mode==='watch' && chapter===1?`<button class="b primary" data-demo="play">${playing?'Pause':'Play captions'}</button>`:''}
      <button class="b ${mode==='watch' && chapter!==1?'primary':'quiet'}" data-demo="try">${mode==='watch'?label:'Watch'}</button>
      <button class="b" data-demo="show" hidden>Show me</button>
      <nav class="demo-nav" aria-label="Guide steps"><button class="b quiet" data-demo="back" ${chapter===0?'disabled hidden':''}>Back</button><button class="b" data-demo="next" ${chapter===chapters.length-1?'disabled hidden':''}>Next</button></nav></div>
      ${chapter===1 && mode==='watch'?`<div class="demo-caption"><strong>Silent sample · Maya Chen · ${caption+1} of ${speech.length}</strong><p>${esc(speech[caption])}</p><div class="demo-tools"><button class="b quiet small" data-demo="line">Next caption</button><button class="b quiet small" data-demo="replay">Replay captions</button></div></div>`:''}
      <details data-guide id="demo-detail" ${expanded?'open':''}><summary class="sr-only" tabindex="-1">About this sample</summary><p>${esc(c.detail)}</p>
      ${chapter===2?`<p><strong>Sample manual note:</strong> ${esc(manualNote)}</p>`:''}
      ${chapter===3?`<p><strong>Saved synthetic draft:</strong> ${esc(draft)}</p>`:''}
      <p>Fictional sample. No mic or AI service. Reload clears practice. Watch and Restart keep your practice edits.</p><div class="demo-tools"><button class="b quiet" data-demo="skip">Skip to practice</button><button class="b quiet" data-demo="restart">Restart guide</button></div></details>`;
    if (focus) box.querySelector(`[data-demo="${focus}"]`)?.focus();
    scheduleCue();
  }
  function click(event) {
    const action = event.target.closest('button[data-demo]')?.dataset.demo;
    if (!action) return;
    if (action === 'more') { const detail = box.querySelector('[data-guide]'); detail.open = !detail.open; expanded = detail.open; event.target.setAttribute('aria-expanded', String(expanded)); return; }
    if (action === 'show') { dismissed = null; updateCue(); if (cue && !box.contains(cue)) { cue.scrollIntoView({block:'center', behavior:'instant'}); cue.focus({preventScroll:true}); } return; }
    if (action === 'play') { if (playing) pause(); else { playing = true; clock.play(); } paint(); return; }
    if (action === 'line' || action === 'replay') { pause(); caption = action === 'replay' ? 0 : Math.min(speech.length-1, caption+1); paint(); return; }
    capturePractice();
    if (mode === 'try' && starting && !practiceId && (action === 'next' || action.startsWith('chapter-'))) {
      paint('Start the room below first. Or use Skip to practice for a ready-made sample.'); return;
    }
    pause(); caption=0; used.clear(); dismissed=null;
    if (action.startsWith('chapter-')) chapter=Number(action.slice(8));
    if (action==='back') chapter=Math.max(0,chapter-1);
    if (action==='next') chapter=Math.min(chapters.length-1,chapter+1);
    if (action==='try') { mode=mode==='watch'?'try':'watch'; expanded=false; }
    if (action==='skip') {mode='try'; chapter=1; expanded=false;}
    if (action==='restart') {mode='watch';chapter=0;expanded=false;}
    open(); box.querySelector('#demo-heading').focus();
  }
  const choose = event => {
    if (!event.target.matches('[data-chapters]')) return;
    const value = event.target.value;
    event.target.value = '';
    click({target:{closest:() => ({dataset:{demo:`chapter-${value}`}})}});
  };
  const interact = event => {
    if (playing) { pause(); paint(); }
    const control = event.target.closest('[data-vact], [data-ract]');
    if (event.type === 'click' && control) { if (control.dataset.vact) used.add(control.dataset.vact);
      else if (['up','down','tap','fix'].includes(control.dataset.ract)) used.add('rank'); }
    if (cue?.contains(event.target)) { dismissed = cueKey(cue); cue.classList.remove('events-demo-target'); }
    scheduleCue();
  };
  const hide = () => { if (document.hidden) {pause(); paint();} };
  const stop = () => { capturePractice(); pause(); paint(); };
  const observer = new MutationObserver(scheduleCue);
  observer.observe(screen, {childList:true, subtree:true});
  box.addEventListener('click',click);
  box.addEventListener('change',choose);
  screen.addEventListener('click',interact);
  screen.addEventListener('input',interact);
  window.addEventListener('resize',scheduleCue);
  window.addEventListener('hashchange',stop);
  document.addEventListener('visibilitychange',hide);
  const cleanup = () => {
    if (disposed) return;
    disposed = true; pause(); observer.disconnect(); cancelAnimationFrame(frame);
    cue?.classList.remove('events-demo-target'); delete env.onRendered; screen.inert = false;
    box.removeEventListener('click', click); box.removeEventListener('change',choose);
    screen.removeEventListener('click',interact); screen.removeEventListener('input',interact);
    window.removeEventListener('resize',scheduleCue); window.removeEventListener('hashchange', stop);
    window.removeEventListener('pagehide',suspend); window.removeEventListener('pageshow',resume); document.removeEventListener('visibilitychange', hide); box.remove();
  };
  const suspend = () => { pause(); paint(); observer.disconnect(); cancelAnimationFrame(frame); frame = 0; cue?.classList.remove('events-demo-target'); };
  const resume = () => { observer.observe(screen, {childList:true, subtree:true}); scheduleCue(); };
  window.addEventListener('pagehide',suspend);
  window.addEventListener('pageshow',resume);
  open();
  return cleanup;
}
