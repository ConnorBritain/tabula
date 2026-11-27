// Speech focus through the real built app, with local synthetic rounds and no provider calls.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { build } from './build-app.mjs';
import { serve } from './events/tools/serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
let temp, server, browser;
before(async () => { temp = mkdtempSync(join(existsSync('/Volumes/cre-scratch') ? '/Volumes/cre-scratch' : tmpdir(), 'mobile-flow-test-')); server = await serve(build(join(temp,'app'))); browser = await chromium.launch(); });
after(async () => { await browser?.close(); await server?.close(); if (temp) rmSync(temp,{recursive:true,force:true}); });
async function pageFor(fn, size = { width:390,height:844 }) {
  const context = await browser.newContext({ viewport:size, isMobile:true, hasTouch:true });
  await context.addInitScript(() => localStorage.setItem('policyJudge.settings.v1',JSON.stringify({setupDone:true,tourOffered:true,d2NoteShown:true})));
  const page = await context.newPage(), errors=[];
  page.on('pageerror',e => { errors.push(e.message); console.error(e.stack); });
  page.setDefaultTimeout(10000);
  try { await page.goto(server.url); await page.locator('#start-flow').click(); await page.evaluate(() => { document.querySelector('#rec-on').checked=false; }); await fn(page,context); assert.deepEqual(errors,[]); }
  finally { await context.close(); }
}
async function sample(page, format='policy-hs', firstSide='aff') {
  return page.evaluate(({format,firstSide}) => {
    R=freshRound(undefined,L.getFormat(format)); R.firstSide=firstSide; R.started=true;
    const A=L.atomicFlow,f=A.migrate(R),g=f.sheets[0].groups[0],speeches=FMT().flowSpeeches;
    const source=A.addItem(f,g,speeches[0],{title:'Transit access lowers household costs',author:'Rivera',date:'2025',notes:'Original evidence notes'},{source:'document'}); A.setStatus(source,'read'); source.spoken=12;
    const second=A.addItem(f,g,speeches[0],{title:'Access matters more than ridership'}); A.setStatus(second,'read'); second.spoken=25;
    const reply=A.addItem(f,g,speeches[1],{title:'The plan misses outer suburbs',notes:'A coverage response'}); A.setLinks(f,reply,[source.id,second.id],FMT());
    const imported=A.addItem(f,g,speeches[1],{title:'Weekend service reaches shift workers',author:'Chen',date:'2024'},{source:'document'});
    save();renderFlow();renderSpeeches();renderClock();renderPrep();
    return {source:source.id,second:second.id,reply:reply.id,imported:imported.id,speeches,group:g.id};
  },{format,firstSide});
}
// Why: the approved default must make rapid notes available offline and retain unfinished work across reloads.
test('phone opens Speech focus; analytics and per-speech drafts survive offline reload',()=>pageFor(async(page,context)=>{
  assert.equal(await page.locator('#flow-mobile-compose').isVisible(),true);
  const note=page.getByRole('textbox',{name:'New analytic',exact:true});
  await note.fill('No uniqueness'); await note.press('Shift+Enter'); await note.press('a'); await note.press('Enter');
  assert.equal(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.title==='No uniqueness\na').length),1);
  await note.fill('まだ'); await note.dispatchEvent('keydown',{key:'Enter',isComposing:true}); assert.equal(await note.inputValue(),'まだ');
  await page.locator('#mobile-next').click(); await page.locator('#mobile-previous').click(); assert.equal(await note.inputValue(),'まだ');
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.ready;if(r.active.state!=='activated')await new Promise(done=>r.active.addEventListener('statechange',done,{once:true}));});
  await page.goto(server.url+'/?resume=1'); await page.locator('#mobile-analytic').waitFor(); await context.setOffline(true); await page.reload(); await page.locator('#mobile-analytic').waitFor();
  assert.equal(await note.inputValue(),'まだ'); await note.press('Enter'); assert.equal(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.title==='まだ').length),1);
  assert.equal(await page.evaluate(()=>Boolean(navigator.serviceWorker.controller)&&!navigator.onLine),true);
}));
// Why: browsing an earlier argument must never select a different paused or running clock.
test('view selection is independent from paused, running and prep clocks',()=>pageFor(async page=>{
  const fixture=await sample(page); await page.getByRole('combobox',{name:'Viewed speech',exact:true}).selectOption(fixture.speeches[1]);
  assert.equal(await page.evaluate(()=>sp().id),fixture.speeches[0]);
  await page.locator('#t-start').click(); await page.waitForFunction(()=>Boolean(R.run));
  assert.equal(await page.evaluate(()=>R.run.id),fixture.speeches[0]);
  await page.locator('#t-start').click(); assert.equal(await page.locator('#mobile-speech').inputValue(),fixture.speeches[1]);
  await page.locator('#mobile-clock').click(); await page.locator('#cv-prep-aff').waitFor(); await page.locator('#clock-view [data-prep="aff"]').click();
  assert.equal(await page.evaluate(()=>Boolean(R.prepRun)&&!R.run),true);
  await page.getByRole('button',{name:'Show flow',exact:true}).click(); assert.equal(await page.locator('#mobile-speech').inputValue(),fixture.speeches[1]);
}));
// Why: opening or editing the transcript on a phone must follow the viewed speech without changing the timed speech.
test('the phone drawer reads and edits only the viewed speech transcript', () => pageFor(async page => {
  await sample(page);
  await page.evaluate(() => { R.transcripts = { '1AC': 'First speech stays intact', '1NC': 'Second speech draft' }; });
  await page.locator('#t-start').click();
  await page.locator('#mobile-speech').selectOption('1NC');
  await page.locator('#help-btn').click();
  await page.locator('#help-palette').click();
  await page.locator('#pal-input').fill('Show transcript');
  await page.getByRole('option', { name: /Show transcript/ }).click();
  const transcript = page.locator('#transcript-big');
  assert.equal(await transcript.inputValue(), 'Second speech draft');
  assert.match(await page.locator('#tr-drawer-label').innerText(), /1NC/);
  await transcript.fill('Second speech corrected');
  assert.deepEqual(await page.evaluate(() => [R.run.id, R.transcripts]), ['1AC', {
    '1AC': 'First speech stays intact', '1NC': 'Second speech corrected',
  }]);
}));
// Why: mobile edits must keep occurrence identities, source notes and linked copies intact.
test('citation edit, read-card extension, removal and Undo use the existing item model',()=>pageFor(async page=>{
  const fixture=await sample(page); await page.locator(`[data-entry="${fixture.source}"] [data-item-action="edit"]`).click();
  await page.getByRole('textbox',{name:'Author optional',exact:true}).fill('Rivera edited'); await page.locator('.item-editor button[type=submit]').click();
  assert.equal(await page.evaluate(id=>R.itemFlow.items.find(e=>e.id===id).author,fixture.source),'Rivera edited');
  await page.locator(`[data-entry="${fixture.source}"] [data-item-action="menu"]`).click(); await page.locator('[data-item-action="move"]').click();
  await page.locator('#ask').getByRole('button',{name:'Next',exact:true}).click();
  await page.locator(`#ask input[value="${fixture.speeches[1]}"]`).check(); await page.locator('#ask').getByRole('button',{name:'Go',exact:true}).click();
  if(await page.getByRole('heading',{name:'Destination row',exact:true}).isVisible())await page.locator('#ask').getByRole('button',{name:'Go',exact:true}).click();
  const extension=await page.evaluate(id=>L.atomicFlow.live(R.itemFlow).find(e=>e.from===id),fixture.source);
  assert.ok(extension); assert.equal(extension.card,fixture.source); assert.equal(extension.notes,'Original evidence notes');
  await page.locator(`[data-entry="${extension.id}"] [data-item-action="edit"]`).click(); await page.getByRole('textbox',{name:'Notes optional',exact:true}).fill('Extension-only note'); await page.locator('.item-editor button[type=submit]').click();
  assert.equal(await page.evaluate(id=>R.itemFlow.items.find(e=>e.id===id).notes,fixture.source),'Original evidence notes');
  await page.locator(`[data-entry="${extension.id}"] [data-item-action="remove"]`).click(); assert.equal(await page.evaluate(id=>L.atomicFlow.live(R.itemFlow).some(e=>e.id===id),extension.id),false);
  await page.getByRole('button',{name:'Undo: remove Transit access lowers household costs',exact:true}).click(); assert.equal(await page.evaluate(id=>L.atomicFlow.live(R.itemFlow).find(e=>e.id===id).notes,extension.id),'Extension-only note');
}));
// Why: a comparison must preserve saved alignment and every response target without changing spoken order.
test('related arguments, response creation and aligned comparison preserve many-to-many links',()=>pageFor(async page=>{
  const fixture=await sample(page); const before=await page.evaluate(()=>R.itemFlow.items.map(e=>[e.id,e.spoken]));
  await page.locator('#mobile-speech').selectOption(fixture.speeches[1]); await page.locator('#mobile-compare').click();
  const row=page.locator('.mobile-compare-row').filter({has:page.locator(`[data-entry="${fixture.reply}"]`)});
  assert.equal(await row.locator(`[data-entry="${fixture.source}"]`).count(),1);
  assert.deepEqual(await page.evaluate(id=>R.itemFlow.items.find(e=>e.id===id).links,fixture.reply),[fixture.source,fixture.second]);
  assert.deepEqual(await page.evaluate(()=>R.itemFlow.items.map(e=>[e.id,e.spoken])),before);
  await page.getByRole('button',{name:'Back to speech',exact:true}).click();
  await page.locator('#mobile-speech').selectOption(fixture.speeches[0]); await page.locator(`[data-entry="${fixture.source}"] [data-item-action="related"]`).click();
  await page.getByRole('button',{name:'Respond in a later speech',exact:true}).click(); await page.locator('#ask').getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('New reply'); await page.locator('.item-editor button[type=submit]').click();
  assert.deepEqual(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).find(e=>e.title==='New reply').links),[fixture.source]);
}));
// Why: older shared-column notes must remain accessible without guessing which speech owns them.
test('legacy shared-column entries and unsupported models retain recovery paths',()=>pageFor(async page=>{
  await page.evaluate(()=>{R=freshRound();R.flows[0].cells[3]='Unassigned block note';R.started=true;save();renderFlow();});
  await page.locator('#mobile-speech').selectOption('unspecified'); assert.equal(await page.getByRole('button',{name:'Edit Unassigned block note',exact:true}).isVisible(),true);
  assert.equal(await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).find(e=>e.title==='Unassigned block note').speech),null);
  await page.evaluate(()=>{R.itemFlow.version=999;save();renderFlow();});
  assert.equal(await page.evaluate(()=>R.itemFlow.version),999);assert.equal(await page.locator('#flow-mobile-compose').isVisible(),false);
  assert.equal(await page.getByText('Flow on a tablet or laptop. Clock and ballot work here.',{exact:true}).isVisible(),true);
}));
// Why: each supported format must label and render its own speeches without Policy-only assumptions.
test('LD and both PF speaking orders use the format registry',()=>pageFor(async page=>{
  for(const [format,side] of [['ld','aff'],['pf','aff'],['pf','neg']]){
    const fixture=await sample(page,format,side);const options=await page.locator('#mobile-speech option').evaluateAll(os=>os.map(o=>o.value));assert.deepEqual(options,fixture.speeches);
    await page.locator('#mobile-speech').selectOption(fixture.speeches[1]);assert.equal(await page.locator(`[data-entry="${fixture.reply}"]`).count(),1);
    assert.equal(await page.evaluate(()=>R.firstSide),side);
  }
}));
// Why: narrow screens, typing and rotation must keep text and actions visible in both themes.
test('phone and tablet render without page overflow and retain drafts through resize',()=>pageFor(async page=>{
  const fixture=await sample(page);await page.evaluate(()=>{const A=L.atomicFlow,g=R.itemFlow.sheets[0].groups[0];for(let i=0;i<60;i++)A.addItem(R.itemFlow,g,FMT().flowSpeeches[0],{title:'Long round '+i,notes:i===0?'citation'.repeat(80):'Sample notes'});renderFlow();});
  await page.locator('#mobile-analytic').blur();
  const capture=process.env.MOBILE_FLOW_CAPTURE_DIR;if(capture)mkdirSync(capture,{recursive:true});
  for(const theme of ['light','dark']){await page.evaluate(t=>window.TabulaTheme.set(t),theme);for(const size of [{width:360,height:800},{width:390,height:844},{width:768,height:1024},{width:820,height:1180},{width:844,height:390}]){
    await page.setViewportSize(size);await page.waitForFunction(w=>document.documentElement.clientWidth===w && document.body.classList.contains('mobile-flow-enabled')===(w<820),size.width);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),size.width);
    if(size.width<820){assert.equal(await page.locator('.item-flow-grid').count(),0);assert.equal(await page.locator('#mobile-speech').isVisible(),true);}
    else assert.equal(await page.locator('.item-flow-grid').count(),1);
    if(capture)await page.screenshot({path:join(capture,`${theme}-${size.width}.png`)});
  }}
  await page.setViewportSize({width:390,height:500});await page.getByRole('textbox',{name:'New analytic',exact:true}).fill('Keyboard draft');
  const add=await page.locator('#flow-mobile-compose button[type=submit]').boundingBox();const clock=await page.locator('#t-start').boundingBox();assert.ok(add.y+add.height<=500);assert.ok(clock.y+clock.height<=500);
  if(capture)await page.screenshot({path:join(capture,'keyboard.png')});
  await page.setViewportSize({width:1024,height:768});await page.setViewportSize({width:390,height:844});assert.equal(await page.getByRole('textbox',{name:'New analytic',exact:true}).inputValue(),'Keyboard draft');
  assert.ok(await page.evaluate(id=>L.atomicFlow.live(R.itemFlow).some(e=>e.id===id),fixture.source));
}));
// Why: importing for a viewed speech must not put its unconfirmed evidence into the clock's speech.
test('local document import uses the viewed speech and keeps the source unconfirmed',()=>pageFor(async page=>{
  const fixture=await sample(page);await page.locator('#mobile-speech').selectOption(fixture.speeches[1]);await page.locator('#mobile-tools').click();await page.getByRole('button',{name:'Documents',exact:true}).click();
  assert.equal(await page.locator('#flow-doc-speech').inputValue(),fixture.speeches[1]);
  await page.locator('#flow-doc-file').setInputFiles({name:'Local transit.txt',mimeType:'text/plain',buffer:Buffer.from('Sample transit claim\nService reaches shift workers.')});
  await page.waitForFunction(()=>DOCS.some(d=>d.name==='Local transit.txt')&&L.atomicFlow.live(R.itemFlow).some(e=>e.document));
  const imported=await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.document));assert.ok(imported.length>0);for(const e of imported){assert.equal(e.status,'unconfirmed');assert.equal(e.speech,fixture.speeches[1]);}
  assert.equal(await page.evaluate(()=>sp().id),fixture.speeches[0]);
}));
// Why: an imported card must not become a copy or a confirmed read just because it moves to a later speech.
test('unconfirmed movement asks Move or Extend and preserves identity on Move',()=>pageFor(async page=>{
  const fixture=await sample(page);await page.locator('#mobile-speech').selectOption(fixture.speeches[1]);
  await page.locator(`[data-entry="${fixture.imported}"] [data-item-action="menu"]`).click();await page.locator('[data-item-action="move"]').click();await page.locator('#ask').getByRole('button',{name:'Next',exact:true}).click();
  await page.locator(`#ask input[value="${fixture.speeches[2]}"]`).check();await page.locator('#ask').getByRole('button',{name:'Go',exact:true}).click();
  await page.locator('#ask').getByRole('button',{name:'Go',exact:true}).click();
  assert.equal(await page.locator('[data-item-action="confirm-move"]').isVisible(),true);assert.equal(await page.locator('[data-item-action="confirm-extend"]').isVisible(),true);
  await page.locator('[data-item-action="confirm-move"]').click();
  const items=await page.evaluate(()=>L.atomicFlow.live(R.itemFlow).filter(e=>e.title==='Weekend service reaches shift workers'));assert.equal(items.length,1);assert.equal(items[0].id,fixture.imported);assert.equal(items[0].speech,fixture.speeches[2]);assert.equal(items[0].status,'unconfirmed');
  assert.equal(await page.locator('#mobile-speech').inputValue(),fixture.speeches[2]);
}));
// Why: rotating a phone during a slow load must not call controls before their settings exist.
test('viewport changes during deferred startup wait for the workspace',async()=>{
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let release;const hold=new Promise(done=>{release=done;});await page.route('**/js/clock.js',async route=>{await hold;await route.continue();});
  try { const navigation=page.goto(server.url);await page.waitForFunction(()=>typeof resizeWorkspace==='function');await page.setViewportSize({width:820,height:1180});await page.setViewportSize({width:390,height:844});release();await navigation;await page.waitForFunction(()=>typeof booted!=='undefined'&&booted);assert.deepEqual(errors,[]); }
  finally {release();await context.close();}
});
// Why: interrupted replies must keep their original source, or the next card can receive the wrong argument.
test('response drafts remain separate by target through navigation and reload',()=>pageFor(async page=>{
  const fixture=await sample(page);
  const replyTo=async id=>{
    await page.locator('#mobile-speech').selectOption(fixture.speeches[0]);await page.locator(`[data-entry="${id}"] [data-item-action="related"]`).click();await page.getByRole('button',{name:'Respond in a later speech',exact:true}).click();await page.locator('#ask').getByRole('button',{name:'Continue',exact:true}).click();
  };
  await replyTo(fixture.source);await page.getByRole('textbox',{name:'Title',exact:true}).fill('Reply meant for Rivera');
  await replyTo(fixture.second);assert.equal(await page.getByRole('textbox',{name:'Title',exact:true}).inputValue(),'');assert.match(await page.locator('.item-response-target').textContent(),/Access matters more than ridership/);
  await page.getByRole('textbox',{name:'Title',exact:true}).fill('Reply meant for access');await page.locator('.item-editor button[type=submit]').click();
  await page.reload();await page.locator('#mobile-speech').waitFor();await replyTo(fixture.source);assert.equal(await page.getByRole('textbox',{name:'Title',exact:true}).inputValue(),'Reply meant for Rivera');assert.match(await page.locator('.item-response-target').textContent(),/Transit access lowers household costs/);await page.locator('.item-editor button[type=submit]').click();
  assert.deepEqual(await page.evaluate(()=>['Reply meant for Rivera','Reply meant for access'].map(title=>L.atomicFlow.live(R.itemFlow).find(e=>e.title===title).links)),[[fixture.source],[fixture.second]]);
}));
