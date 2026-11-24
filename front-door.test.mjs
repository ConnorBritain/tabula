// The app's front door (owner decision 2026-11-23, Option A): the app opens with no sign-in wall, and a judge who is
// signed out sees a "Sign in" in the top bar and in Settings. Run with: node --test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('./logic.js');
const { fnSource } = require('./test-fn-source.js');
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const account = readFileSync(new URL('./js/account.js', import.meta.url), 'utf8');

// Why: after sign-in the judge must land back in the app they came from; a link with no return strands them on the
// account site, and a staging app that links to the live sign-in would sign a tester into production.
test('signinUrl sends an app host back to itself, on its own account site', () => {
  assert.equal(L.signinUrl('debate.tabulaspeech.com'), 'https://tabulaspeech.com/signin/?return=' + encodeURIComponent('https://debate.tabulaspeech.com/'));
  assert.equal(L.signinUrl('my.tabulaspeech.com'), 'https://tabulaspeech.com/signin/?return=' + encodeURIComponent('https://my.tabulaspeech.com/'));
  assert.equal(L.signinUrl('debate.tabulaspeech.dev'), 'https://tabulaspeech.dev/signin/?return=' + encodeURIComponent('https://debate.tabulaspeech.dev/'));
});

// Why: a return URL for a host the server does not trust would be refused anyway, and asking for it from a look-alike
// domain would make our own link carry an attacker's address; those hosts get the plain production sign-in page.
test('signinUrl gives other hosts the plain sign-in page with no return', () => {
  assert.equal(L.signinUrl('localhost:8765'), 'https://tabulaspeech.com/signin/');
  assert.equal(L.signinUrl('evil-tabulaspeech.com'), 'https://tabulaspeech.com/signin/');
  assert.equal(L.signinUrl(''), 'https://tabulaspeech.com/signin/');
  assert.equal(L.signinUrl('evil.tabulaspeech.com'), 'https://tabulaspeech.com/signin/', 'a subdomain the server does not trust');
  assert.equal(L.signinUrl('events.tabulaspeech.com'), 'https://tabulaspeech.com/signin/', 'not on the server list yet');
});

// Why: when the session ends mid-round, a paying judge must get a one-click way back in; without the link the old
// text sent them to a Settings control that did not exist, a dead end in the middle of a round.
test('a 401 from hosted AI carries a Sign in link and never points at Settings', () => {
  const page = L.signinUrl('debate.tabulaspeech.com');
  const info = L.hostedError(401, 'signed_out', L.accountUrl('debate.tabulaspeech.com'), page);
  assert.deepEqual(info.link, { label: 'Sign in', url: page });
  assert.ok(!/settings/i.test(info.text), 'the signed-out text points at Settings: ' + info.text);
  assert.equal(L.hostedError(401, 'signed_out').link.url, 'https://tabulaspeech.com/signin/', 'no page given: production');
});

// Why: the Sign in must never show before the server answers (offline at a tournament, or the local helper with no
// account server), where it would lead nowhere; so both start hidden in the page.
test('the top-bar Sign in and the Settings sign-in card start hidden', () => {
  assert.match(html, /<a class="clock-chip signin-pill" id="signin-link"[^>]*\shidden>Sign in<\/a>/);
  assert.match(html, /<div class="card" id="signin-card" hidden>/);
  assert.match(html, /<button class="b primary" id="signin-go" type="button">Sign in<\/button>/);
  assert.doesNotMatch(html, /id="signin-link"[^>]*href=/, 'a fixed href in the page would be a second source for the sign-in URL');
  const header = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));
  assert.ok(header.includes('id="signin-link"'), 'the Sign in is not in the top bar');
});

// Runs the real renderAccount() with stub elements. acctOut: the server said "signed out".
function render({ profile, acctOut }) {
  const els = {};
  const $ = (sel) => (els[sel] = els[sel] || { hidden: true, href: '', textContent: '', value: '', classList: { toggle() {} } });
  const run = new Function('acctProfile', 'acctOut', '$', 'L', 'location', 'acctDirty', 'document', 'renderAcctCount',
    fnSource(account, 'renderAccount') + '\nrenderAccount();');
  run(profile, acctOut, $, L, { host: 'debate.tabulaspeech.com' }, false, { activeElement: null, querySelector: () => null }, () => {});
  return els;
}

// Why: a signed-in judge who still sees "Sign in" thinks the app lost their account; a signed-out judge who sees no
// Sign in cannot reach the rounds they bought; and an unknown state (offline) must show nothing that could fail.
test('Sign in shows only when the server said signed out, and goes to the sign-in page', () => {
  const out = render({ profile: null, acctOut: true });
  assert.equal(out['#signin-link'].hidden, false);
  assert.equal(out['#signin-card'].hidden, false);
  assert.equal(out['#signin-link'].href, L.signinUrl('debate.tabulaspeech.com'));
  const unknown = render({ profile: null, acctOut: false });
  assert.equal(unknown['#signin-link'].hidden, true, 'shown before the server said signed out');
  assert.equal(unknown['#signin-card'].hidden, true);
  const signedIn = render({ profile: { displayName: 'Sam', paradigm: '', programs: [] }, acctOut: false });
  assert.equal(signedIn['#signin-link'].hidden, true, 'shown to a signed-in judge');
  assert.equal(signedIn['#signin-card'].hidden, true);
});

// Why: the Settings button is the judge's way in from the account card; if its click lost the sign-in page (or the
// return to this app), the card would be one more dead end. It follows the top-bar link, which renderAccount() sets.
test('the Settings Sign in button goes where the top-bar Sign in goes', () => {
  assert.match(account, /\$\('#signin-go'\)\.addEventListener\('click', \(\) => \{ location\.href = \$\('#signin-link'\)\.href; \}\);/);
});

// Why: when hosted AI finds the session ended mid-round, the judge must see the way back in at once, not only after
// the next account check a minute later; the paradigm save that finds the same must do the same.
test('acctSignedOut shows the Sign in at once', () => {
  let profile = 'x';
  const run = new Function('applyProfile', 'let acctOut = false;\n' + fnSource(account, 'acctSignedOut') + '\nacctSignedOut();\nreturn acctOut;');
  const out = run((p) => { profile = p; });
  assert.equal(out, true);
  assert.equal(profile, null);
  assert.match(account, /if \(res\.status === 401\) \{ acctSignedOut\(\); return/);
});

// Why: the paradigm save that finds the judge signed out must say where to sign in; the old line named a website
// with no link, and the app now has its own Sign in.
test('a signed-out paradigm save points at the Sign in in the app', () => {
  assert.match(account, /Not saved: you are signed out\. Use Sign in at the top to sign in again\./);
  assert.ok(!/Sign in again at tabulaspeech\.com/.test(account));
});

// Runs the real openWelcome() with stubs. signedOut: what js/account.js knows. answer: the stub ask() answer.
const help = readFileSync(new URL('./js/help.js', import.meta.url), 'utf8');
async function welcome(signedOut, answer = 'start') {
  const calls = [], S = {}, loc = { host: 'debate.tabulaspeech.com', href: '' };
  const AsyncFunction = (async () => {}).constructor;
  const run = new AsyncFunction('ask', 'showSetup', 'window', 'S', 'saveSettings', 'showTab', 'setTimeout', '$', 'offerTour', 'L', 'location', 'signedOut',
    'async ' + fnSource(help, 'openWelcome') + '\n' + fnSource(help, 'startJudging') + '\nreturn openWelcome(signedOut);');
  await run(async (o) => { calls.push(o); return answer; }, () => true, { TabulaBrand: { NAME: 'Tabula Debate' } }, S, () => {}, () => {}, () => {},
    () => ({ focus() {} }), () => {}, L, loc, signedOut);
  return { buttons: calls[0].buttons, S, loc };
}

// Why: a judge who bought rounds and opens the app signed out must see the way in on the first screen; without it
// the rounds they paid for stay out of reach. "Start judging" must stay first, so the free path is still one click.
test('signed out, the welcome adds one quiet "Bought rounds? Sign in" line under the help line', async () => {
  const { buttons } = await welcome(true);
  assert.deepEqual(buttons.map((b) => b.value), ['start', 'setup', 'signin']);
  assert.deepEqual(buttons[2], { label: 'Sign in', value: 'signin', kind: 'link', desc: 'Bought rounds?' });
  const text = buttons.flatMap((b) => [b.label, b.desc || '']).join('\n');
  for (const re of [/\bAI\b/, /\bpay\b/i, /\bkey\b/i, /subscription/i, /\$/, /free trial/i]) assert.ok(!re.test(text), 'the welcome says ' + re);
});

// Why: offline at a tournament, or on the local helper, the app does not know the judge is signed out; a Sign in
// there could lead nowhere, so the welcome must stay exactly as Revision 2.
test('not known to be signed out, the welcome has no Sign in line', async () => {
  for (const s of [undefined, false]) assert.deepEqual((await welcome(s)).buttons.map((b) => b.value), ['start', 'setup']);
});

// Why: the Sign in line must take the judge to the sign-in page that returns to this app; and a judge who leaves
// without finishing sign-in must still get the welcome next time, or they lose the setup offer for good.
test('the welcome Sign in goes to the sign-in page and keeps the welcome for next time', async () => {
  const { S, loc } = await welcome(true, 'signin');
  assert.equal(loc.href, L.signinUrl('debate.tabulaspeech.com'));
  assert.equal(S.setupDone, undefined);
  assert.match(help, /openWelcome\(acctOut\);\n/);
  assert.match(help, /\$\('#show-welcome'\)\.addEventListener\('click', \(\) => openWelcome\(acctOut\)\);/);
});

// Why: the welcome only learns the judge is signed out from welcomeWhenKnown; if that stopped passing acctOut on, the
// signed-out line would never show and a buyer would again open an app with no way in.
test('welcomeWhenKnown passes what the account check knows to the welcome', async () => {
  let got = 'not called';
  const run = new Function('L', 'S', 'capsGate', '$', 'saveSettings', 'openWelcome', 'maybeD2Note', 'acctOut',
    'return async ' + fnSource(help, 'welcomeWhenKnown') + ';');
  const welcomeWhenKnown = run(L, { setupDone: false }, { mode: 'none', features: {} }, () => ({ hidden: false }), () => {}, (s) => { got = s; }, () => {}, true);
  await welcomeWhenKnown(Promise.resolve());
  assert.equal(got, true);
});
