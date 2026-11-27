import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync, readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const artifactRoot = process.platform === 'darwin' ? '/Volumes/cre-scratch' : tmpdir();
const artifact = name => join(artifactRoot, name);
import {build, ALLOW} from '../build-events.mjs';
import {serve} from './tools/serve.mjs';
let server, browser, out;
before(async()=>{out=mkdtempSync(artifact('events-demo-'));server=await serve(build(out));browser=await chromium.launch();});
after(async()=>{await browser?.close();await server?.close();if(out)rmSync(out,{recursive:true,force:true});});
async function visit(fn,width=1280,theme='light',motion='reduce') {
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:motion});
 await context.addInitScript(() => { localStorage.setItem('real-sentinel', 'saved work'); window.persistenceRequests = 0; if (navigator.storage) navigator.storage.persist = async () => { window.persistenceRequests++; return false; }; });
 const page=await context.newPage(); page.setDefaultTimeout(30000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {await page.goto(server.url+'/?demo=events');await page.locator('#demo-heading').waitFor();await fn(page,context);assert.deepEqual(errors,[]);}catch(error){ await page.screenshot({path:artifact('events-demo-failure.png'),fullPage:true}); console.error(await page.locator('.events-demo').innerText()); throw error; }finally{await context.close();}
}
const act=async(page,name)=>{
 if (name.startsWith('chapter-')) await page.locator('[data-chapters]').selectOption(name.slice(8));
 else if (name === 'draft') await page.locator('[data-vact="clean"]').first().click();
 else {
  if (['skip','restart'].includes(name) && !(await page.locator('[data-guide]').evaluate(e=>e.open))) await page.locator('[data-demo="more"]').click();
  await page.locator(`[data-demo="${name}"]`).click();
 }
 await page.waitForFunction(()=>document.querySelector('#screen').dataset.routing === 'false');
};
// Why: setup choices and feedback must stay in the same round as the visitor moves through the guide.
test('setup handoff retains chosen room through Watch, restart and Try',()=>visit(async page=>{
 await act(page,'try'); await page.locator('#setup-paste').fill('A12 Maya Chen\nB07 Jordan Ellis');
 await page.locator('#setup-tournament').fill('My practice tournament'); await page.locator('#setup-start').click();
 await page.locator('#notes').waitFor(); const hash=await page.evaluate(()=>location.hash);
 await page.locator('#notes').fill('My own feedback'); await act(page,'next');
 assert.equal(await page.locator('#notes').inputValue(),'My own feedback');
 await act(page,'try');await act(page,'restart');await act(page,'skip');
 assert.equal(await page.locator('#notes').inputValue(),'My own feedback');
 const id=hash.split('/')[2]; assert.ok((await page.evaluate(()=>location.hash)).includes(id));
 await act(page,'chapter-2');assert.equal(await page.locator('#notes').inputValue(),'My own feedback');
}));
// Why: the actual review panel must protect changed feedback and must never call a provider for sample output.
test('saved rewrite opens the real comparison panel and preserves manual words',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-3');await page.locator('[data-vact="clean"]').first().waitFor();
 await act(page,'draft');await page.locator('[data-clean-panel]').waitFor();
 assert.match(await page.locator('[data-clean-panel]').innerText(),/Saved synthetic rewrite/);
 await page.locator('[data-vact="clean-original"]').click();
 assert.match(await page.locator('[role="tabpanel"]').innerText(),/repair-table proposal/);
 await page.locator('[data-vact="clean-keep"]').click();
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 await act(page,'chapter-2');await page.locator('#notes').fill('My independent note');
 await act(page,'chapter-3');await act(page,'draft');
 await page.getByText('No saved sample matches these words.',{exact:false}).waitFor();
 assert.ok((await page.locator('#screen').innerText()).includes('My independent note'));
}));
// Why: a saved draft that finishes after navigation must not reopen a panel in another chapter or change practice feedback.
test('chapter change cancels a pending saved draft',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-3');
 await page.locator('[data-vact="clean"]').first().waitFor();
 await page.evaluate(()=>{
  document.querySelector('[data-vact="clean"]').click();
  if (!document.querySelector('[data-clean-panel]')?.textContent.includes('Preparing an edit')) throw new Error('Expected a pending draft');
  const picker = document.querySelector('[data-chapters]'); picker.value = '2'; picker.dispatchEvent(new Event('change', {bubbles:true}));
  // Force disposal before the saved adapter's microtask resolves; normal browser navigation is covered separately.
  window.dispatchEvent(new HashChangeEvent('hashchange'));
 });
 await page.waitForFunction(()=>document.querySelector('#screen').dataset.routing === 'false');
 await page.locator('#notes').waitFor();
 assert.match(await page.locator('#notes').inputValue(),/^The repair-table proposal is clear/);
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 await act(page,'chapter-3');
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 const room=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice'));
 assert.equal(room.entries[0].comment,null);
}));
// Why: practice must reach a completed local ballot through the same rank and copy controls as a real round.
test('practice ranks and completes a local ballot',()=>visit(async(page,context)=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await act(page,'skip');await act(page,'chapter-4');
 await page.locator('[data-ract="down"][data-id="sample-1"]').click();
 await page.locator('#rank-reason').fill('Jordan first in my practice decision.');
 await act(page,'next');
 for (const what of ['ranks','sample-1','sample-2','reason']) {
  await page.locator(`[data-vact="copy"][data-what="${what}"].events-demo-target`).waitFor();
  await page.locator(`[data-vact="copy"][data-what="${what}"]`).click();
  await page.waitForFunction(what=>{const r=JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice');return what==='ranks'?r.ranksCopiedAt:what==='reason'?r.reasonCopiedAt:r.entries.find(e=>e.id===what).commentCopiedAt;},what);
 }
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice')?.state==='done');
 const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice'));
 assert.equal(String(result.entries.find(e=>e.id==='sample-2').rank),'1');
 assert.equal(result.reasonForRank,'Jordan first in my practice decision.');
 await page.getByText('Your local practice ballot is complete. Nothing was submitted.',{exact:true}).waitFor();
}));
// Why: background playback must stop on pause, chapter changes, and page exit.
test('mounted captions pause, replay, cancel and exit without touching real storage',()=>visit(async(page,context)=>{
 await page.evaluate(()=>localStorage.setItem('sample-only','yes'));
 await act(page,'chapter-1');await act(page,'play');await act(page,'play');
 const caption=await page.locator('.demo-caption').innerText();await page.waitForTimeout(4700);
 assert.equal(await page.locator('.demo-caption').innerText(),caption);
 await act(page,'line');assert.match(await page.locator('.demo-caption').innerText(),/2 of 4/);
 await act(page,'replay');assert.match(await page.locator('.demo-caption').innerText(),/1 of 4/);
 await act(page,'play');await act(page,'chapter-2');await page.waitForTimeout(4700);
 assert.equal(await page.locator('.demo-caption').count(),0);
 await context.setOffline(true);await act(page,'skip');await page.locator('#notes').fill('Offline practice');
 await act(page,'try');await act(page,'try');assert.equal(await page.locator('#notes').inputValue(),'Offline practice');
 await context.setOffline(false);
 await act(page,'try');await act(page,'chapter-1');await act(page,'play');
 assert.equal(await page.locator('[data-demo="play"]').innerText(),'Pause');
 await page.getByRole('link',{name:'Leave sample · New real round'}).click();
 await page.locator('#setup-start').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('sample-only')),null);
 assert.equal(await page.evaluate(()=>localStorage.getItem('real-sentinel')),'saved work');
 await page.waitForTimeout(4700);
 assert.equal(await page.locator('.events-demo').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('sample-only')),null);
}));
// Why: sample controls must not read real rounds, request a microphone, or reach any data service.
test('sandbox isolates real storage and blocks all data transports',()=>visit(async(page)=>{
 const result=await page.evaluate(async()=>{
  const rejected=async fn=>{try{await fn();return false;}catch{return true;}};
  return {fetch:await rejected(()=>fetch('/api/sample-probe')),xhr:await rejected(()=>new XMLHttpRequest()),socket:await rejected(()=>new WebSocket('wss://example.invalid')),mic:await rejected(()=>navigator.mediaDevices.getUserMedia({audio:true})),beacon:navigator.sendBeacon('/api/sample-probe','x'),key:localStorage.getItem('real-sentinel'),persist:window.persistenceRequests};
 });
 assert.deepEqual(result,{fetch:true,xhr:true,socket:true,mic:true,beacon:false,key:null,persist:0});
 await act(page,'skip');await page.locator('.timer-go[data-tact="startstop"]').click();
 assert.equal(await page.locator('.timer-go').innerText(),'Stop');
 await page.locator('.timer-go').click();
 await page.locator('[data-act="pick"][data-id="sample-2"]:visible').first().click();
 assert.match(await page.locator('#stage-name').innerText(),/Jordan/);
}));
// Why: demo assets must be explicit build inputs; missing isolation code must still make a build fail.
test('sandbox is shipped unchanged and remains required by the build',()=>{
 assert.equal(readFileSync(out+'/assets/demo-boot.js','utf8'),readFileSync(new URL('../assets/demo-boot.js',import.meta.url),'utf8'));
 const missing=mkdtempSync(artifact('events-missing-'));
 try {assert.throws(()=>build(missing,ALLOW.filter(x=>x!=='assets/demo-boot.js')),/not in the output.*demo-boot/);}finally{rmSync(missing,{recursive:true,force:true});}
});
for(const width of [390,820,1280]) for(const theme of ['light','dark']) {
 // Why: each viewport and theme must leave the real practice controls reachable without horizontal scrolling.
 test(`guide and practice fit ${width}px ${theme}`,()=>visit(async page=>{
  await act(page,'skip');await page.locator('#notes').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:artifact(`events-demo-${width}-${theme}.png`),fullPage:true});
  await page.locator('#notes').fill('Keyboard feedback');await page.locator('#notes').press('Tab');
  assert.equal(await page.locator('#notes').inputValue(),'Keyboard feedback');
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
  assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.chk-group'))),true);
 },width,theme));
}

// Why: a compact guide must leave the real workspace visible and point to Begin before any setup choice.
test('compact yellow intro keeps one title and cues Begin in both motion modes',async()=>{
 for (const motion of ['reduce','no-preference']) await visit(async page=>{
  const begin=page.locator('[data-demo="try"].events-demo-target'); await begin.waitFor();
  assert.equal(await begin.innerText(),'Begin');
  assert.equal(await page.locator('#demo-heading').count(),1);
  assert.equal(await page.locator('[data-chapters]').inputValue(),'');
  assert.ok((await page.locator('.events-demo').boundingBox()).height < 205);
  assert.equal(await page.locator('[data-instruction]').isVisible(),true);
  const style=await begin.evaluate(e=>({animation:getComputedStyle(e).animationName,iterations:getComputedStyle(e).animationIterationCount,outline:getComputedStyle(e).outlineColor}));
  assert.equal(style.animation,motion==='reduce'?'none':'events-demo-cue');
  if(motion!=='reduce') assert.equal(style.iterations,'3');
  assert.equal(style.outline,'rgb(0, 85, 184)');
  const tint=await page.locator('.events-demo').evaluate(e=>getComputedStyle(e).backgroundColor);
  assert.ok(tint.includes('color(srgb'),tint);
  await page.screenshot({path:artifact(`events-guide-intro-${motion}.png`),fullPage:true});
 },390,'light',motion);
});
// Why: Show me must focus the real next control without entering text, starting clocks, or changing a room.
test('cues follow setup and timer while Show me only moves focus',()=>visit(async page=>{
 await act(page,'try');await page.locator('#setup-paste.events-demo-target').waitFor();
 await act(page,'show');assert.equal(await page.evaluate(()=>document.activeElement.id),'setup-paste');
 assert.equal(await page.locator('#setup-paste').inputValue(),'');
 await page.locator('#setup-paste').fill('A12 Maya Chen\nB07 Jordan Ellis');
 await page.locator('#setup-start.events-demo-target').waitFor();
 await page.locator('#setup-start').click();await page.locator('[data-demo="next"].events-demo-target').waitFor();
 await act(page,'next');await page.locator('.timer-go.events-demo-target').waitFor();
 const roomBefore=await page.evaluate(()=>localStorage.getItem('tabulaEvents.rooms.v1'));
 await act(page,'show');assert.equal(await page.evaluate(()=>document.activeElement.matches('.timer-go')),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('tabulaEvents.rooms.v1')),roomBefore);
 await page.locator('.timer-go').click();assert.equal(await page.locator('.timer-go').innerText(),'Stop');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('.timer-go.events-demo-target').count(),0);
 await page.locator('.timer-go').click();
 await act(page,'next');await page.locator('#notes.events-demo-target').waitFor();await act(page,'show');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'notes');
 assert.equal(await page.locator('[data-instruction]').isVisible(),true);
},390));
// Why: the review cue must teach comparison and acceptance through the actual protected editor.
test('review cues follow saved draft comparison into the accepted ballot',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-3');
 await page.locator('[data-vact="clean"].events-demo-target').waitFor();
 await act(page,'show');assert.equal(await page.evaluate(()=>document.activeElement.dataset.vact),'clean');
 await act(page,'draft');await page.locator('[data-vact="clean-original"].events-demo-target').waitFor();
 await page.screenshot({path:artifact('events-guide-review-dark.png'),fullPage:true});
 await page.locator('[data-vact="clean-original"]').click();
 await page.locator('[data-vact="clean-use"].events-demo-target').waitFor();
 await page.locator('[data-vact="clean-suggested"]').click();
 await page.locator('[data-vact="clean-use"]').click();
 await page.locator('[data-demo="next"].events-demo-target').waitFor();
 assert.match(await page.locator('#screen').innerText(),/Your repair-table proposal was clear/);
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 await act(page,'next');await page.locator('[data-ract="down"].events-demo-target').waitFor();
 await page.locator('[data-ract="down"].events-demo-target').click();
 await page.locator('#rank-reason.events-demo-target').waitFor();
},820,'dark'));
// Why: changing chapters while the visitor edits must leave their own words intact and make every chapter reachable.
test('all chapters retain an instruction and a compact picker on a narrow phone',()=>visit(async page=>{
 for(let i=0;i<6;i++) {
  await act(page,`chapter-${i}`);
  assert.equal(await page.locator('[data-chapters]').inputValue(),'');
  assert.equal(await page.locator('[data-instruction]').isVisible(),true);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await act(page,'skip');await act(page,'chapter-2');await page.locator('#notes').fill('Keep my phone feedback.');
 await act(page,'try');await act(page,'restart');await act(page,'skip');
 assert.equal(await page.locator('#notes').inputValue(),'Keep my phone feedback.');
},320));

// Why: normal browser route timing must also remove a draft when a visitor leaves its chapter.
test('normal chapter navigation leaves no saved-draft panel or accepted text behind',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-3');
 await page.evaluate(()=>{
  document.querySelector('[data-vact="clean"]').click();
  const picker=document.querySelector('[data-chapters]');picker.value='2';
  picker.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#notes').waitFor();
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 assert.match(await page.locator('#notes').inputValue(),/^The repair-table proposal is clear/);
 await act(page,'chapter-3');assert.equal(await page.locator('[data-clean-panel]').count(),0);
 const room=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice'));
 assert.equal(room.entries[0].comment,null);
}));

// Why: expanded help must not insert an invisible keyboard stop between the guide and its visible actions.
test('More keeps the guide keyboard order on visible controls',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-2');await act(page,'more');
 await page.locator('[data-demo="next"]').focus();await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.demo),'skip');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.demo),'restart');
}));
// Why: the Chapters label needs room beside its chevron, and the utility row must stay usable on the smallest phone.
test('current guide uses Details and an inset chapter chevron at phone widths',async()=>{
 for(const width of [320,390]) await visit(async page=>{
  assert.equal(await page.getByRole('button',{name:'More',exact:true}).count(),0);
  const details=page.getByRole('button',{name:'Details',exact:true});await details.waitFor();
  const layout=await page.locator('.demo-top').evaluate(el=>{
   const select=el.querySelector('[data-chapters]'), pick=select.parentElement;
   return {row:el.getBoundingClientRect().height,select:select.getBoundingClientRect().height,pad:parseFloat(getComputedStyle(select).paddingRight),inset:parseFloat(getComputedStyle(pick,'::after').right),appearance:getComputedStyle(select).appearance};
  });
  assert.ok(layout.row<=layout.select+1,JSON.stringify(layout));
  assert.ok(layout.pad>=16);assert.ok(layout.inset>=8);assert.equal(layout.appearance,'none');
  await details.click();assert.equal(await details.getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:'Skip to practice',exact:true}).click();await page.locator('#notes').waitFor();
  await page.locator('[data-demo="show"]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.matches('.timer-go')),true);
  assert.equal(await page.locator('.timer-go').evaluate(e=>getComputedStyle(e).outlineColor),'rgb(0, 85, 184)');
 },width);
});
// Why: new judges need definitions and a source to check, while stage and panel choices must still save on their room.
test('compact round options explain stage and panel and save the chosen settings',async()=>{
 for(const width of [390,1280]) await visit(async page=>{
  await act(page,'try');const disclosure=page.locator('#setup-more');const summary=disclosure.locator('summary');
  assert.equal(await disclosure.evaluate(e=>e.open),false);
  const row=await summary.boundingBox(), form=await page.locator('#setup-form').boundingBox();
  if(width===1280) assert.ok(row.width<form.width/2);
  assert.ok(row.width<=form.width);
  await page.getByText('Check your ballot or room posting for the round stage and judges. Not sure? Ask tournament staff.',{exact:true}).waitFor();
  await summary.focus();await page.keyboard.press('Enter');
  await page.locator('#setup-level-help').waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Round stage',exact:true}).count(),1);
  assert.equal(await page.getByRole('combobox',{name:'Judges in the room',exact:true}).count(),1);
  assert.equal(await page.locator('#setup-panel-note').isVisible(),false);
  assert.match(await page.locator('#setup-level-help').innerText(),/semifinal or final/);
  assert.match(await page.locator('#setup-panel-help').innerText(),/Count yourself/);
  assert.equal(await page.locator('#setup-level').getAttribute('aria-describedby'),'setup-level-help');
  assert.equal(await page.locator('#setup-panel').getAttribute('aria-describedby'),'setup-panel-help');
  await page.locator('#setup-level').selectOption('elim');await page.locator('#setup-panel').selectOption('3');
  assert.equal(await page.locator('#setup-panel-note').isVisible(),true);
  await page.locator('#setup-panel-note').fill('Judge seat 2');
  await page.locator('#setup-panel').selectOption('1');assert.equal(await page.locator('#setup-panel-note').isVisible(),false);
  await page.locator('#setup-panel').selectOption('3');assert.equal(await page.locator('#setup-panel-note').inputValue(),'Judge seat 2');
  await page.screenshot({path:artifact(`events-round-options-${width}.png`),fullPage:true});
  await summary.click();assert.match(await summary.innerText(),/Elim · Panel of 3/);
  await page.locator('#setup-paste').fill('A12 Maya Chen\nB07 Jordan Ellis');await page.locator('#setup-start').click();await page.locator('#notes').waitFor();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id===location.hash.split('/')[2]));
  assert.equal(saved.level,'elim');assert.deepEqual(saved.panel,{size:3,note:'Judge seat 2'});
 },width);
});
// Why: a floating saved-edit panel must not block guide navigation on a phone or accept text when the visitor leaves.
test('phone review panel leaves Next reachable and preserves unaccepted words',()=>visit(async page=>{
 await act(page,'skip');await act(page,'chapter-3');await act(page,'draft');
 await page.locator('[data-vact="clean-use"]').waitFor();
 await page.screenshot({path:artifact('events-design-review-phone.png'),fullPage:true});
 await act(page,'next');await page.locator('#rank-reason').waitFor();
 assert.equal(await page.locator('[data-clean-panel]').count(),0);
 const room=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice'));
 assert.equal(room.entries[0].comment,null);
},390,'dark'));
// Why: a visitor who jumps straight to saved review must be able to try it without a prior chapter or a network connection.
test('fresh offline review chapter opens its saved comparison directly',()=>visit(async(page,context)=>{
 await context.setOffline(true);await act(page,'chapter-3');await act(page,'try');
 await act(page,'draft');await page.locator('[data-vact="clean-use"]').waitFor();
 assert.match(await page.locator('[data-clean-panel]').innerText(),/Saved synthetic rewrite. No AI service was called/);
 assert.match(await page.locator('[role="tabpanel"]').innerText(),/repair-table proposal/);
 await page.locator('[data-vact="clean-keep"]').click();
 const room=await page.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1')).find(r=>r.id==='events-practice'));
 assert.equal(room.entries[0].comment,null);
}));

// Why: an isolated demo must work beside a real owner without reading real data or claiming the browser's shared write lock.
test('normal owner, two demos and a waiting normal tab keep separate data and ownership',async()=>{
 const context=await browser.newContext();
 await context.addInitScript(()=>{
  window.sampleNativeLocks=0;window.sampleNativeReads=[];window.sampleNativeWrites=[];
  const request=navigator.locks.request.bind(navigator.locks);
  navigator.locks.request=(...args)=>{window.sampleNativeLocks++;return request(...args);};
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;
  Storage.prototype.getItem=function(key){window.sampleNativeReads.push(key);return get.call(this,key);};
  Storage.prototype.setItem=function(key,value){window.sampleNativeWrites.push(key);return set.call(this,key,value);};
  Storage.prototype.removeItem=function(key){window.sampleNativeWrites.push(key);return remove.call(this,key);};
 });
 try {
  const normal=await context.newPage();await normal.goto(server.url+'/#/new/oo');
  await normal.locator('#setup-paste').fill('R01 Real practice owner');await normal.locator('#setup-start').click();
  await normal.locator('#notes').fill('Keep this normal round unchanged.');
  const original=await normal.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
  const demos=[];
  for(let i=0;i<2;i++) {
   const demo=await context.newPage();demos.push(demo);await demo.goto(server.url+'/?demo=events');await demo.locator('#demo-heading').waitFor();
   await act(demo,'skip');await demo.locator('#notes').fill(`Disposable notes ${i}`);
   assert.deepEqual(await demo.evaluate(()=>({locks:sampleNativeLocks,reads:sampleNativeReads,writes:sampleNativeWrites})),{locks:0,reads:[],writes:[]});
   assert.equal(await demo.locator('html').getAttribute('data-writer'),'held');
  }
  assert.equal(await demos[0].locator('#notes').inputValue(),'Disposable notes 0');
  const waiting=await context.newPage();await waiting.goto(server.url+'/');await waiting.locator('#events-waiting').waitFor();
  assert.equal(await waiting.locator('html').getAttribute('data-writer'),'waiting');
  assert.deepEqual(await normal.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),original);
  await normal.close();await waiting.locator('#events-writer-retry').click();await waiting.locator('html[data-ready="true"]').waitFor();
  assert.equal(await waiting.locator('html').getAttribute('data-writer'),'held');
  assert.deepEqual(await waiting.evaluate(()=>JSON.parse(localStorage.getItem('tabulaEvents.rooms.v1'))),JSON.parse(original['tabulaEvents.rooms.v1']));
  await demos[0].close();await waiting.reload();await waiting.locator('html[data-ready="true"]').waitFor();
  assert.equal(await waiting.locator('html').getAttribute('data-writer'),'held');
  assert.equal(await demos[1].locator('#notes').inputValue(),'Disposable notes 1');
 } finally {await context.close();}
});
