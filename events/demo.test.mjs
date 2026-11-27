import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {rules} from './sample-guide/rules.js';
import {loadEventData} from './js/data.js';
import {sampleRoom, createPlayback, draft, savedDraft, createSampleWriter} from './sample-guide/scenario.js';
import {cleanupReview, acceptCleanup} from './js/cleanup.js';
import {setComment} from './js/ballot.js';
const data = await loadEventData(async path => rules[path]);
// A demo must teach the shipped rules, or a visitor will learn a different event.
test('bundled rules match every published source byte-for-value', () => {
  for (const [path,value] of Object.entries(rules)) assert.deepEqual(value,JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8')));
});
// A replay must never mutate the separate room where the visitor is working.
test('watch snapshots cannot replace practice input', () => {
  const practice = sampleRoom(data,'events-practice',3); practice.entries[0].notes='My own feedback';
  const watch = sampleRoom(data,'events-watch',4);
  watch.entries[0].notes='Replay';
  assert.equal(practice.entries[0].notes,'My own feedback'); assert.notEqual(watch.id,practice.id);
  assert.equal(practice.entries[0].rank,undefined);
});
// An old generated draft must not erase feedback the judge edits after opening it.
test('sample draft uses the real stale-comment protection', () => {
  const room=sampleRoom(data,'events-practice',3);
  const review=cleanupReview([room.entries[0]], {'sample-1':draft});
  const edited=setComment(room,'sample-1','My newer words',1);
  assert.equal(acceptCleanup(edited,review,'sample-1',2).changed,false);
  const accepted=acceptCleanup(room,review,'sample-1',2);
  assert.equal(accepted.changed,true); assert.equal(accepted.room.entries[0].comment,draft);
  assert.equal(accepted.room.entries[0].commentSource,'judgeEditedAi');
});
// Pausing or leaving a chapter must cancel even an already queued callback.
test('pause resume and restart ignore stale playback work', () => {
  let queued=[], advanced=0;
  const player=createPlayback({schedule:fn=>{queued.push(fn);return queued.length;},cancel:()=>{},advance:()=>{advanced++;return advanced<2;}});
  player.play(); const old=queued[0]; player.pause(); old(); assert.equal(advanced,0);
  player.play(); queued.at(-1)(); assert.equal(advanced,1);
  const pending=queued.at(-1); player.play(); pending(); assert.equal(advanced,1);
  queued.at(-1)(); assert.equal(advanced,2); player.pause();
});
// The first script must isolate storage before theme or app code can read real keys.
test('Events reuses the unchanged sandbox before theme boot', async () => {
  const html=readFileSync(new URL('index.html',import.meta.url),'utf8');
  assert.ok(html.includes('assets/demo-boot.js'), 'the sandbox script must exist on the page');
  assert.ok(html.indexOf('assets/demo-boot.js') < html.indexOf('assets/theme-boot.js'));
  const require=createRequire(import.meta.url); const {sandbox}=require('../assets/demo-boot.js');
  const real=new Map([['real-round','untouched']]);
  const w={localStorage:real,sessionStorage:real,navigator:{mediaDevices:{}},addEventListener(){}};
  assert.equal(sandbox(w),true); w.localStorage.setItem('sample','practice');
  assert.equal(real.get('real-round'),'untouched'); assert.equal(real.has('sample'),false);
  await assert.rejects(w.fetch('/provider')); await assert.rejects(w.navigator.mediaDevices.getUserMedia({audio:true}));
});

// A saved full-comment rewrite must never be inserted into a selected span or pretend to satisfy another edit request.
test('sample adapter refuses selections and unsupported edit modes', async()=>{
 const room=sampleRoom(data,'sample',3);
 for(const options of [{selection:{start:0,end:4}},{mode:'spelling'},{mode:'custom',request:'Add a point'}]) await assert.rejects(savedDraft([room.entries[0]],null,options),/only includes Clarify/);
 assert.equal((await savedDraft([room.entries[0]],null,{mode:'full'}))['sample-1'],draft);
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(savedDraft([room.entries[0]],aborted.signal),{name:'AbortError'});
});

// Why: demo isolation must retain the released writer's before-acquire and after-release protection even without a device lock.
test('sample writer retains ownership checks for its page-local storage lifecycle',async()=>{
 const writer=createSampleWriter();
 assert.throws(()=>writer.assertHeld(),{code:'writer_required'});
 await writer.acquire();writer.assertHeld();assert.equal(writer.state().status,'held');
 let lost=0;writer.onLost(()=>lost++);writer.release();
 assert.equal(lost,1);assert.throws(()=>writer.assertHeld(),{code:'writer_required'});
 await writer.acquire();writer.assertHeld();writer.release();
});
