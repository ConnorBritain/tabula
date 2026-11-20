// The AI gate on the page (platform phase 1B; tabula-cloud docs/platform/CONTRACTS.md §5, docs/design/AI-POLICY.md §3).
// can(f) is the one check: every AI control renders, and every AI call starts, only if it is true. A removed tool is
// gone: no greyed button, no lock, no "ask your admin". The rule itself is pure (logic/caps.js); assets/caps-boot.js
// used it before the first paint. Here the page keeps the record fresh and writes <html data-ai-off> again.
// The gate changes only at a round boundary (app start, round start, the "Judging for" choice before the first
// speech), never mid-round (AI-POLICY §6a). Round content never goes to the server.
// One part of the page code (see app.js for the load order). The parts are classic scripts that share one global
// scope, so a part can use what any part declares; code that runs at load only uses parts that load before it.
'use strict';

const capsQuery = new URLSearchParams(location.search);
const capsOff = capsQuery.get('ai') === 'off'; // dev switch: the Flow-only look
const capsFixtureName = capsQuery.get('caps'); // dev switch: a fixture record from fixtures/platform-v2.json
let capsRecord = L.parseCaps(store.get(L.STORE_KEYS.caps, null));
let capsFixture = null;
// Until the page has its own answer, the gate is what the boot drew: a fixture or ?ai=off hides all AI.
let capsGate = capsGateNow();

function capsGateNow() {
  if (capsFixtureName && !capsFixture) return { mode: 'none', features: {} };
  const record = capsFixture || capsRecord;
  return L.gateFor({
    record, now: Date.now(), off: capsOff,
    profile: L.parseProfile(store.get(L.STORE_KEYS.profile, null)),
    programId: capsFixture ? capsFixture.subject.programId : R.programId, // a fixture stands for its own round
  });
}

const can = (f) => L.canUse(capsGate, f);
// payer(f): who pays for f ('program' | 'self' | null). The hosted AI caller (not built yet) needs it; brief 1B API.
const payer = (f) => L.payerOf(capsGate, f);
// The device can run AI: a key or helper is connected (aiReady), or the record says a hosted plan.
const ready = () => aiReady() || Boolean(capsGate.hosted);
// The key settings may show (own AI allowed, no hosted plan). A judge with a key still sees them, to manage it.
const canSetup = () => L.setupAllowed(capsGate);
// The "Connect AI" invites may show: own AI allowed and the device not ready yet.
const showSetup = () => L.showSetupFor(capsGate, ready());

// The gate for lists (tour steps, palette rows): a feature key, or 'any' (some AI is on), or 'setup' (key settings).
const gateHas = (f) => (f === 'any' ? L.APP_FEATURES.some(can) : f === 'setup' ? canSetup() : can(f));

// Writes <html data-ai-off>; CSS hides [data-ai] and [data-ai-setup] by it. Called by aiChanged() too, since being
// ready (a key connected or removed) changes whether the invites show.
function writeAiOff() { document.documentElement.setAttribute('data-ai-off', L.offTokens(capsGate, ready()).join(' ')); }

// At a round boundary: take the newest answer, then redraw what is built in code.
function applyCapabilities() {
  capsGate = capsGateNow();
  if (R.flowView === 'ai' && !can('aiFlow')) { R.flowView = 'mine'; save(); }
  aiChanged(); // writes data-ai-off, then the panes, Insights, Live Eval, Analysis and the draft panel
  if (R.tab === 'flow') renderFlow();
  if (R.tab === 'eval' && !can('liveEval')) showTab('ballot');
  maybeKeyNotice(capsRecord && capsRecord.subject.programId); // js/settings.js
}
// The gate may change now only before the round's first speech (the same lock as "Judging for").
function capsBoundary() { if (!L.judgingLocked(R)) applyCapabilities(); }

// Reads the record for the round's school (or own round). Called at app start and sign-in (js/account.js), and when
// "Judging for" changes before the lock (js/judging.js). New rounds reload the page, so they start here too.
async function refreshCaps(programId) {
  if (capsFixtureName) return; // a dev fixture stands in for the server
  const req = L.capsRequest(programId);
  let out;
  try {
    const res = await fetch(req.url, { ...req.init, signal: AbortSignal.timeout(8000) });
    out = L.capsOutcome(res.status, await res.json().catch(() => null));
  } catch { out = { state: 'unknown' }; } // offline: keep the cached record
  if (out.state === 'notMember') { dropJudging(); return; }
  if (out.state === 'in') { capsRecord = out.record; store.set(L.STORE_KEYS.caps, out.record); }
  if (out.state === 'out') { capsRecord = null; store.del(L.STORE_KEYS.caps); }
  capsBoundary();
}
// Sign-out: forget the record (AI-POLICY §6d). The gate changes at the next boundary.
function clearCaps() { capsRecord = null; store.del(L.STORE_KEYS.caps); capsBoundary(); }

// ?caps=<fixture>: the dev and test switch. The fixture file is only in the repo, never in the hosted build.
if (capsFixtureName) {
  fetch('fixtures/platform-v2.json').then((r) => r.json()).then((j) => {
    const rec = j && j.records ? j.records[capsFixtureName] : null;
    capsFixture = rec ? L.parseCaps(rec) : null;
    if (capsFixture) applyCapabilities();
  }).catch(() => {});
}
