import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const logic=require('./logic.js');

// Why: reopening Settings must never hide the useful round workspace on the next app visit.
test('startup opens Flow for new and returning judges without replacing their round', () => {
  const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
  const core=readFileSync(new URL('./js/core.js',import.meta.url),'utf8');
  const navigation=core.slice(core.indexOf('const PLACES ='),core.indexOf("$('#nav').innerHTML"));
  for(const tab of [undefined,'ai','setup','ballot','flow']){
    const round={tab,flows:[{name:'Case',cells:{'1AC':'Saved argument'}}],cur:3};
    const before=structuredClone({...round,tab:undefined}),saved=[];
    const element={classList:{toggle(){}},removeAttribute(){},setAttribute(){}};
    const world={R:round,S:{},L:logic,can:()=>false,$:()=>element,document:{body:{dataset:{}},querySelectorAll:()=>[],addEventListener(){}},sdState:()=>({}),acctBoot:Promise.resolve()};
    world.save=()=>saved.push(JSON.parse(JSON.stringify(world.R)));
    for(const name of ['restoreClocksOnLoad','bindAll','renderSpeeches','renderClock','renderPrep','renderTranscript','renderRecStrip','renderRecNotice','renderSingleKeys','renderNetNote','renderConnections','checkHelper','renderReadLevel','renderRange','applyPanes','renderAudio','listMics','applyCapabilities','renderPrepPresets','showDrawer','resumeClips','renderSdList','studyBoot','welcomeWhenKnown','measureRoundBar','closeDraftPanel','renderFlow','renderInsights','renderChip'])world[name]=()=>{};
    runInNewContext(navigation+'\n'+source,world);
    assert.equal(world.document.body.dataset.place,'flow');
    assert.equal(world.R.tab,'flow');
    assert.deepEqual({...world.R,tab:undefined},before,'startup replaced saved round data');
    assert.deepEqual(saved.at(-1).flows,before.flows,'startup persisted an empty round');
  }
});
