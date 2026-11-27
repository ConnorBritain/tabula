// Exercise the disposable demo through the built app and real flow controls.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from './build-app.mjs';
import { serve } from './events/tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
let server, browser;
let out;
const scratch = existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir();
before(async () => { out=mkdtempSync(join(scratch, 'debate-demo-test-')); server=await serve(build(out)); browser=await chromium.launch(); });
after(async () => { await browser?.close(); await server?.close(); rmSync(out,{recursive:true,force:true}); });
async function visit(fn, format='policy', width=1280, theme='light') {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try { await page.goto(server.url+'/?demo='+format); await page.locator('#demo-chapter').waitFor();await fn(page,context);assert.deepEqual(errors,[]); }
  finally { await context.close(); }
}
async function mapSaved(page) { if (!(await page.locator('#demo-map').isVisible())) await page.locator('#demo-more').click(); await page.locator('#demo-map').click(); }
async function chapter(page,id) { const i=await page.evaluate(id=>demoUi.steps.findIndex(s=>s.id===id),id);await page.locator('#demo-chapter').selectOption(String(i)); }
// Why: a paused or abandoned sample must not replace notes or leave late AI changes in the practice round.
test('pause, resume, replay and chapter changes preserve practice edits',()=>visit(async page=>{
  await chapter(page,'manual');
  await page.getByRole('button',{name:'Add entry in 1AC, Case',exact:true}).click();
  await page.locator('.item-editor [name=title]').fill('My independent weighing');
  await page.locator('.item-editor [name=title]').press('Tab');
  assert.equal(await page.locator('.item-editor [name=author]').evaluate(e=>e===document.activeElement),true);
  await page.locator('.item-editor [name=author]').fill('My citation');
  await page.locator('.item-editor button[type=submit]').click();
  await chapter(page,'speech-1AC');await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>R.transcripts['1AC']?.length>10);await page.locator('#demo-pause').click();
  const paused=await page.evaluate(()=>R.transcripts['1AC']);await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>R.transcripts['1AC']),paused);
  await page.locator('#demo-pause').click();await page.waitForFunction(()=>!demoUi.busy);
  await mapSaved(page);await page.waitForFunction(()=>!demoUi.busy);
  assert.equal(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).some(e=>e.title==='My independent weighing'&&e.author==='My citation')),true);
  const count=await page.evaluate(()=>R.itemFlow.items.length);assert.ok(count>1);
  const full=await page.evaluate(()=>R.transcripts['1AC']);
  await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>demoUi.busy);
  const replayText=await page.locator('#transcript-big').inputValue();
  assert.ok(replayText.length>0&&replayText.length<full.length);
  await page.waitForFunction(previous=>document.querySelector('#transcript-big').value.length>previous,replayText.length);
  assert.equal(await page.evaluate(()=>R.transcripts['1AC']),full);
  await page.waitForFunction(()=>!demoUi.busy);
  assert.equal(await page.evaluate(()=>R.itemFlow.items.length),count);
  await page.locator('#t-start').click();await page.waitForFunction(()=>Boolean(R.run));
  const beforeCancel=await page.evaluate(()=>JSON.stringify(R.itemFlow));
  await mapSaved(page);await chapter(page,'options');await page.waitForTimeout(1400);
  assert.equal(await page.evaluate(()=>JSON.stringify(R.itemFlow)),beforeCancel);
  assert.equal(await page.evaluate(()=>flowBusy||flowPending.size>0),false);
  await page.evaluate(()=>R.transcripts['1AC']='My edited transcript');await chapter(page,'speech-1AC');await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>!demoUi.busy);assert.equal(await page.evaluate(()=>R.transcripts['1AC']),'My edited transcript');
  assert.match(await page.locator('#demo-status').innerText(),/edits/);
}));
// Why: docs must enter the shared flow unconfirmed and repeat chapter visits must not duplicate them.
test('sample document import is disposable, unconfirmed and idempotent',()=>visit(async(page,context)=>{
  await chapter(page,'documents');await page.locator('#demo-document').click();await page.locator('#demo-document').click();
  assert.equal(await page.evaluate(()=>DOCS.length),1);
  const imported=await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.source==='document'));
  assert.ok(imported.length>0);assert.ok(imported.every(e=>e.status==='unconfirmed'));
  assert.match(imported.map(e=>e.title+' '+e.notes).join(' '),/Ada Kestrel/);
  await context.setOffline(true);await chapter(page,'manual');
  assert.equal(await page.evaluate(()=>window.TabulaDemo!==null),true);
  await assert.rejects(page.evaluate(()=>fetch('/provider')));
  await context.setOffline(false);await page.locator('#demo-more').click();await page.locator('#demo-again').click();await page.locator('#demo-chapter').waitFor();
  assert.equal(await page.evaluate(()=>DOCS.length),0);
}));
for(const format of ['policy','ld'])for(const width of [390,820,1280])for(const theme of ['light','dark']) {
  // Why: every supported viewport must retain usable app space below the practice controls.
  test(`${format} chapters fit ${width}px ${theme}`,()=>visit(async page=>{
    await chapter(page,'manual');
    assert.ok(await page.locator('#demo-bar').evaluate(e=>e.getBoundingClientRect().height<500));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:join(scratch, `debate-demo-${format}-${width}-${theme}.png`)});
  },format,width,theme));
}
// Why: the sample must reach a usable evaluation and editable ballot without approving a decision for the visitor.
test('reduced motion, real clocks, eval and ballot review work without microphone calls',()=>visit(async page=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await chapter(page,'speech-1AC');await page.locator('#demo-watch').click();await page.waitForFunction(()=>!demoUi.busy);
  await mapSaved(page);await page.waitForFunction(()=>!demoUi.busy);
  await chapter(page,'clocks');assert.equal(await page.locator('#rec-on').isChecked(),false);
  assert.equal(await page.locator('#rec-on').isDisabled(),true);
  await page.locator('#t-start').click();await page.waitForFunction(()=>Boolean(R.run));await page.locator('#t-start').click();
  await chapter(page,'eval');await page.locator('#eval-go').click();await page.waitForFunction(()=>Boolean(LV().liveEval)&&!evalBusy);
  await chapter(page,'draft');await page.locator('#dp-go').click();await page.waitForFunction(()=>Boolean(R.ballotReview)&&!draftUi.busy);
  await chapter(page,'decision');assert.equal(await page.evaluate(()=>Boolean(R.ballotReview)),true);
  await page.locator('#rv-accept').click();assert.equal(await page.evaluate(()=>Boolean(R.ballotReview)),false);
  await page.locator('#demo-leave').click();await page.waitForFunction(()=>!window.TabulaDemo && typeof R !== 'undefined');
  assert.equal(await page.evaluate(()=>R.id.startsWith('demo-')),false);
}));
// Why: visitors can jump to saved AI examples without speeches, an internet connection or round credits.
test('direct Live Eval and ballot chapters use the same saved replies on an untouched offline round', () => visit(async (page, context) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  const practiceInputs = () => page.evaluate(() => [R.started, R.run, R.timeLeft, R.transcripts, DOCS.length]);
  const before = await practiceInputs();
  assert.equal(Boolean(before[0]), false);
  await context.setOffline(true);
  assert.equal(await page.evaluate(() => navigator.onLine), false);
  await chapter(page, 'eval');
  await page.locator('#eval-go.demo-target').click();
  await page.waitForFunction(() => Boolean(LV().liveEval) && !evalBusy);
  assert.match(await page.locator('#eval-meta').innerText(), /Saved sample evaluation/);
  assert.ok(await page.locator('#eval-body .lean').isVisible());
  assert.equal(await page.evaluate(() => JSON.stringify(LV().liveEval.data)),
    await page.evaluate(() => JSON.stringify(L.demoReply(demoSample, 'eval'))));
  const firstEvalAt = await page.evaluate(() => LV().liveEval.at);
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await page.waitForFunction(previous => !evalBusy && LV().liveEval.at > previous, firstEvalAt);
  assert.equal(await page.evaluate(() => JSON.stringify(LV().liveEval.data)),
    await page.evaluate(() => JSON.stringify(L.demoReply(demoSample, 'eval'))));
  await page.locator('#nav [data-tab="flow"]').click();
  assert.match(await page.locator('#insights-body .ins-meta').textContent(), /Saved sample/);
  assert.equal(await page.locator('#ins-update').isEnabled(), true);

  await chapter(page, 'draft');
  assert.equal(await page.locator('#demo-title').innerText(), 'Draft a ballot');
  await page.locator('#dp-go.demo-target').click();
  await page.waitForFunction(() => Boolean(R.ballotReview) && !draftUi.busy);
  assert.equal(await page.evaluate(() => JSON.stringify(LV().ballotDraft.data)),
    await page.evaluate(() => JSON.stringify(L.demoReply(demoSample, 'ballot'))));
  assert.deepEqual(await practiceInputs(), before);
  assert.equal(await page.locator('#b-rfd').inputValue(), '');
  assert.deepEqual(requests, []);
}));

// Why: review must give visitors an actionable cue when they skip drafting, and the handoff must preserve their practice round.
test('direct review directs visitors to the saved draft before the account handoff', () => visit(async page => {
  await chapter(page, 'decision');
  await page.locator('#dp-go.demo-target').click();
  await page.locator('#rv-insert.demo-target').waitFor();
  await chapter(page, 'end');
  await page.locator('#demo-plans.demo-target').waitFor();
  assert.equal(await page.locator('#draft-panel').isVisible(), false);
  assert.equal(await page.locator('#demo-title').innerText(), 'Try your first round');
  assert.match(await page.locator('#demo-body').innerText(), /Keep practicing here.*“See plans”/);
  await page.locator('#demo-more').click();
  assert.match(await page.locator('#demo-detail').innerText(), /personal plan uses one round/);
  const account = page.getByRole('link', { name: 'Check my rounds' });
  assert.equal(await account.getAttribute('href'), 'https://tabulaspeech.com/account/');
  assert.equal(await account.getAttribute('target'), '_blank');
  assert.equal(await account.getAttribute('rel'), 'noopener');
  assert.equal(await page.locator('#b-rfd').inputValue(), '');
}, 'policy', 390, 'dark'));

// Why: saved replies must wait for explicit resume, including when practice lasts longer than the normal reply timeout.
test('saved flow and remaining speeches keep a usable pause until resumed',()=>visit(async page=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await chapter(page,'speech-1AC');
  const original=await page.evaluate(()=>JSON.stringify(R.itemFlow));
  await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>demoUi.busy && demoUi.message.startsWith('Applying'));
  await page.locator('#demo-pause').click();
  await page.waitForTimeout(16000);
  assert.equal(await page.evaluate(()=>demoUi.paused&&demoUi.busy),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(R.itemFlow)),original);
  assert.equal(await page.locator('#demo-pause').innerText(),'Resume');
  await page.locator('#demo-pause').click();await page.waitForFunction(()=>!demoUi.busy);
  assert.notEqual(await page.evaluate(()=>JSON.stringify(R.itemFlow)),original);
  await chapter(page,'rest');await page.locator('#demo-watch').click();
  await page.locator('#demo-title').click();
  // A real app control, outside the player, also pauses sample work.
  await page.locator('#tr-toggle').click();
  assert.equal(await page.evaluate(()=>demoUi.paused),true);
  assert.equal(await page.locator('#demo-pause').isVisible(),true);
  const pending=await page.evaluate(()=>JSON.stringify(R.itemFlow));await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>JSON.stringify(R.itemFlow)),pending);
  await page.locator('#demo-pause').click();await page.waitForFunction(()=>!demoUi.busy);
  assert.notEqual(await page.evaluate(()=>JSON.stringify(R.itemFlow)),pending);
  assert.equal(await page.evaluate(()=>flowPending.size===0&&!flowBusy),true);
}));
// Why: visitors must see cause and effect without finding a second hidden action after the transcript finishes.
test('Watch maps captions automatically and exposes the flow; cues follow real controls',()=>visit(async page=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await chapter(page,'manual');
  await page.waitForFunction(()=>document.querySelector('[data-item-action="new"].demo-target'));
  assert.equal(await page.locator('.demo-target').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('#demo-show').click();
  assert.equal(await page.locator('[data-item-action="new"]').first().evaluate(e=>e===document.activeElement),true);
  await page.locator('[data-item-action="new"]').first().click();
  await page.waitForFunction(()=>document.querySelector('.item-editor [name="title"].demo-target'));
  await page.locator('.item-editor [name="title"]').fill('Keep my manual note');
  await page.locator('.item-editor button[type=submit]').click();
  await chapter(page,'speech-1AC');await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>demoUi.busy && demoUi.message.startsWith('Applying'));
  await chapter(page,'options');await page.waitForTimeout(1400);
  assert.equal(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.source==='transcript').length),0);
  await chapter(page,'speech-1AC');await page.locator('#demo-watch').click();
  await page.waitForFunction(()=>!demoUi.busy);
  assert.ok(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).some(e=>e.source==='transcript')));
  assert.ok(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).some(e=>e.title==='Keep my manual note')));
  assert.equal(await page.locator('#tr-drawer').isVisible(),false);
  assert.match(await page.locator('#demo-status').innerText(),/Saved reply applied/);
  const cueId=await page.locator('.demo-target').evaluate(e=>e.closest('[data-entry]')?.dataset.entry);
  assert.equal(await page.evaluate(id=>L.atomicFlow.live(R.itemFlow).find(e=>e.id===id)?.source,cueId),'transcript');
  await chapter(page,'eval');
  await page.waitForFunction(()=>document.querySelector('#eval-go.demo-target'));
  assert.equal(await page.locator('[data-item-action="new"].demo-target').count(),0);
}));

// Why: the opening needs to teach how to reach Round, recognize the format, and confirm readiness before practice.
test('Flow leads to Round setup and lights both Policy locations before Begin',()=>visit(async page=>{
  const start = page.getByRole('button', {name:'Begin', exact:true});
  const round = page.locator('#nav [data-tab=setup].demo-target');
  await round.waitFor();
  assert.equal(await page.locator('#demo-title').innerText(), 'Select your round type');
  const homeFlow = page.locator('#nav [data-tab=flow][aria-current=page]');
  const homeColor = await homeFlow.evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(await start.isVisible(), false);
  await round.click();
  assert.equal(await page.locator('#nav [data-tab=setup]').getAttribute('aria-current'), 'page');
  assert.notEqual(await page.locator('#nav [data-tab=setup]').evaluate(el=>getComputedStyle(el).backgroundColor), homeColor);
  const policy = page.locator('#format-chip.demo-target');
  await policy.waitFor();
  assert.equal(await page.locator('#tab-setup .demo-target').count(),0);
  const card = page.locator('#format-cards .fmt-card:has(input:checked)');
  assert.match(await card.innerText(), /^Policy/);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).animationName),'demo-cue');
  assert.deepEqual(await page.locator('#format-cards .fmt-card:has(input:not(:checked))').evaluateAll(cards=>cards.map(el=>getComputedStyle(el).animationName)), ['none','none']);
  assert.equal(await page.locator('#demo-chapter').inputValue(),'');
  assert.equal(await page.locator('#demo-chapter option:checked').innerText(),'Chapters');
  assert.equal(await page.locator('#demo-show').isVisible(),false);
  const pulse = await policy.evaluate(el=>{
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = animation.effect.getTiming().duration / 2;
    return getComputedStyle(el).filter;
  });
  assert.match(pulse,/drop-shadow/);
  await policy.evaluate(el=>el.getAnimations()[0].finish());
  await page.locator('[data-bind=tournament].demo-target').waitFor();
  assert.equal(await card.evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.getByRole('button', {name:'Ready', exact:true}).click();
  await page.locator('#demo-next.demo-target').waitFor();
  assert.match(await page.locator('#demo-body').innerText(), /blue highlight/);
  await start.click();
  await page.locator('[data-item-action="new"].demo-target').waitFor();
  assert.equal(await page.locator('#demo-title').innerText(),'Add your first note');
  assert.equal(await page.locator('#demo-next.demo-target').count(),0);
}));

// Why: the sequence is only useful when every cue points to the task and the active navigation tab stays recognizable.
for (const width of [1280, 390]) test(`all thirteen Policy chapters guide the live task at ${width}px`, () => visit(async page => {
  const small = width < 820;
  const target = selector => page.locator(selector).and(page.locator('.demo-target'));
  async function expectNavigation(tab, opening) {
    const navigation = await page.locator('#nav [data-tab]').evaluateAll(buttons => {
      const context = document.createElement('canvas').getContext('2d');
      return buttons.map(button => {
        const style = getComputedStyle(button);
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = style.backgroundColor;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        return {tab:button.dataset.tab, active:button.getAttribute('aria-current') === 'page',
          yellow:red > green && green - blue >= 6, pulsing:style.animationName !== 'none'};
      });
    });
    assert.deepEqual(navigation.filter(item => item.active).map(item => item.tab), [tab]);
    assert.deepEqual(navigation.filter(item => item.yellow).map(item => item.tab), opening ? [] : [tab]);
    assert.equal(navigation.find(item => item.active).pulsing, false);
  }
  async function expectCue(selector, tab, opening = false) {
    const cue = target(selector);
    await cue.waitFor();
    assert.equal(await page.locator('.demo-target').count(), 1);
    const appearance = await cue.evaluate(el => {
      const style = getComputedStyle(el);
      const context = document.createElement('canvas').getContext('2d');
      context.fillStyle = style.getPropertyValue('--ai-blue').trim();
      const blue = context.fillStyle;
      context.fillStyle = style.outlineColor;
      return {animation:style.animationName,
        hasBlueOutline:context.fillStyle === blue && style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2};
    });
    assert.deepEqual(appearance, {animation:small ? 'none' : 'demo-cue', hasBlueOutline:true});
    await expectNavigation(tab, opening);
  }
  async function next() { await page.locator('#demo-next').click(); }
  async function watchSpeech(id) {
    await expectCue('#demo-watch', 'flow');
    if (small) await page.locator('#mobile-speech').selectOption('2AR');
    await page.locator('#demo-watch').click();
    await page.locator('#transcript-big').waitFor();
    await page.waitForFunction(() => !demoUi.busy);
    await expectCue('#flow [data-entry] .item-text', 'flow');
    const entry = await target('#flow [data-entry] .item-text').evaluate(el => {
      const item = R.itemFlow.items.find(x => x.id === el.closest('[data-entry]').dataset.entry);
      return {speech:item.speech, source:item.source};
    });
    assert.deepEqual(entry, {speech:id, source:'transcript'});
    assert.equal(await page.locator('#tr-drawer').isVisible(), false);
    if (small) assert.equal(await page.locator('#mobile-speech').inputValue(), id);
  }

  await page.emulateMedia({reducedMotion:small ? 'reduce' : 'no-preference'});
  await expectCue('#nav [data-tab=setup]', 'flow', true);
  await target('#nav [data-tab=setup]').click();
  await expectCue('#format-chip', 'setup');
  const details = page.getByRole('button', {name:'Details',exact:true});
  await details.click();
  assert.equal(await details.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#demo-details').isVisible(), true);
  await details.click();
  await target('#format-chip').click();
  await expectCue('[data-bind=tournament]', 'setup');
  await next();
  await expectCue('#demo-next', 'setup');
  await next();
  await expectCue(small ? '#mobile-analytic' : '[data-item-action="new"]', 'flow');
  if (small) {
    await page.locator('#mobile-analytic').fill('Protect my own note');
    await page.locator('#flow-mobile-compose button[type="submit"]').click();
  } else {
    await target('[data-item-action="new"]').click();
    await expectCue('.item-editor [name="title"]', 'flow');
    await target('.item-editor [name="title"]').fill('Protect my own note');
    await page.locator('.item-editor button[type="submit"]').click();
  }
  await next(); await watchSpeech('1AC');
  assert.ok(await page.evaluate(() => L.atomicFlow.live(R.itemFlow).some(e => e.title === 'Protect my own note')));
  await next();
  if (small) { await expectCue('#mobile-tools', 'flow'); await target('#mobile-tools').click(); }
  await expectCue('.flow-options > summary', 'flow'); await target('.flow-options > summary').click();
  await expectCue('#flow-note-length', 'flow');
  await next(); await expectCue('#demo-document', 'setup'); await target('#demo-document').click();
  await expectCue('#nav [data-tab="flow"]', 'setup');
  await next(); await expectCue('[data-item-action="menu"]', 'flow');
  await next(); await expectCue('#t-start', 'flow');
  await next(); await watchSpeech('1NC');
  await next(); await expectCue('#demo-watch', 'flow'); await target('#demo-watch').click();
  await expectCue('#demo-next', 'flow');
  await next(); await expectCue('#eval-go', 'decide'); await target('#eval-go').click();
  await expectCue('#demo-next', 'decide');
  await next(); await expectCue('#dp-go', 'decide'); await target('#dp-go').click();
  await expectCue('#rv-insert', 'decide');
  await next(); await expectCue('#rv-insert', 'decide'); await target('#rv-insert').click();
  await expectCue('#b-rfd', 'decide');
  await next(); await expectCue('#demo-plans', 'decide');
  assert.equal(await page.locator('#demo-count').innerText(), 'Demo · 13 / 13');
  await page.locator('#nav [data-tab=log]').click();
  await expectNavigation('log');
}, 'policy', width));

// Why: trying another format must load the matching sample while preserving details the visitor typed.
test('Round setup preserves edits when changing the sample and revisiting the checkpoint', () => visit(async page => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#nav [data-tab=setup].demo-target').click();
  const tournament = page.locator('[data-bind=tournament]');
  const round = page.locator('[data-bind=roundName]');
  const aff = page.locator('[data-bind="aff.d1"]');
  const neg = page.locator('[data-bind="neg.d1"]');
  await tournament.fill('Practice Invitational');
  await page.locator('#format-cards .fmt-card').filter({hasText:'Lincoln-Douglas'}).click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('demo') === 'ld');
  assert.equal(await tournament.inputValue(), 'Practice Invitational');
  assert.equal(await page.locator('#format-cards input:checked').inputValue(), 'ld');
  assert.equal(await page.locator('#demo-chapter option').filter({hasText:'AC · Speech to flow'}).count(), 1);
  await round.fill('Round 8');
  await aff.fill('Aff practice speaker');
  await neg.fill('Neg practice speaker');
  await page.getByRole('button', {name:'Ready', exact:true}).click();
  await page.getByRole('button', {name:'Edit setup', exact:true}).click();
  assert.equal(await round.inputValue(), 'Round 8');
  assert.equal(await aff.inputValue(), 'Aff practice speaker');
  assert.equal(await neg.inputValue(), 'Neg practice speaker');
  await page.getByRole('button', {name:'Ready', exact:true}).click();
  await page.getByRole('button', {name:'Begin', exact:true}).click();
  assert.equal(await page.locator('#nav [aria-current=page]').getAttribute('data-tab'), 'flow');
  await chapter(page,'speech-AC');
  await page.locator('#demo-watch').click();
  await page.locator('#flow .item-text.demo-target').waitFor();
  const ldSpeech = await page.evaluate(() => window.TabulaDemoRounds.find(s => s.format === 'ld').speeches[0].transcript);
  assert.deepEqual(await page.evaluate(() => ({format:R.format, transcript:R.transcripts.AC})), {format:'ld', transcript:ldSpeech});
  await chapter(page,'eval');
  await page.locator('#eval-go.demo-target').click();
  await page.locator('#demo-next.demo-target').waitFor();
  assert.equal(await page.locator('#nav [data-tab=decide]').getAttribute('aria-current'), 'page');
  await page.locator('#nav [data-tab=log]').click();
  const history = page.locator('#nav [aria-current=page]');
  assert.equal(await history.getAttribute('data-tab'), 'log');
  assert.equal(await history.evaluate(el=>getComputedStyle(el).animationName), 'none');
}));
