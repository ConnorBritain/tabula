// The Tabula account in the app (roles plan step 3, per the server's accounts and roles plan): the
// "Judging for" choice at round start, and the account paradigm as the one source when the judge is signed in.
// Only the profile (name, paradigm, schools) goes to or comes from the server. Round content never does.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API; index.html loads the parts first.
(function (root) {
  'use strict';
  const part = (name) => (typeof module !== 'undefined' && module.exports ? require('./' + name + '.js') : root.PolicyLogicParts[name]);
  const F = part('format');

  const PROFILE_URL = '/api/v1/me/profile';
  // The server's limit for the paradigm.
  const MAX_PARADIGM = 5000;
  // The server's program id rule. Another id would be ignored as "Just me".
  const PROGRAM_ID = /^[A-Za-z0-9_-]{8,64}$/;

  // GET /api/v1/me/profile -> { displayName, paradigm, photo, programs: [{ id, name, role }] }. Returns a clean
  // { displayName, paradigm, programs } or null when the body is not a profile. Bad program rows are dropped.
  function parseProfile(j) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    const str = (v) => (typeof v === 'string' ? v : '');
    const programs = (Array.isArray(j.programs) ? j.programs : [])
      .filter((p) => p && typeof p.id === 'string' && PROGRAM_ID.test(p.id) && typeof p.name === 'string' && p.name.trim())
      .map((p) => ({ id: p.id, name: p.name.trim(), role: str(p.role) }));
    return { displayName: str(j.displayName), paradigm: str(j.paradigm), programs };
  }

  // What a profile answer means. 200 with a profile: signed in. 401: signed out (forget the cached profile).
  // Anything else (offline, server trouble, a page with no account server): unknown, so the app keeps its cache.
  function profileOutcome(status, body) {
    if (status === 401) return { state: 'out' };
    const profile = status === 200 ? parseProfile(body) : null;
    return profile ? { state: 'in', profile } : { state: 'unknown' };
  }

  // The fetch for the profile. The session cookie is same-site, so same-origin credentials carry it.
  function profileGet() { return { url: PROFILE_URL, init: { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } } }; }

  // The PUT that saves the profile. The server refuses a write without X-Tabula: 1 and the page's own Origin.
  // The page sends Referrer-Policy: no-referrer, which makes the browser send "Origin: null" on a same-origin PUT;
  // referrerPolicy 'strict-origin' sends the real origin (and never more than the origin as the referrer).
  function profilePut(fields) {
    return {
      url: PROFILE_URL,
      init: {
        method: 'PUT', credentials: 'same-origin', referrerPolicy: 'strict-origin', cache: 'no-store',
        headers: { 'content-type': 'application/json', 'X-Tabula': '1' },
        body: JSON.stringify(fields),
      },
    };
  }

  // The paradigm text as the server stores it. The server refuses control characters other than new lines, and a
  // paradigm pasted from Tabroom often has tabs, so tabs become spaces and other control characters go.
  function cleanParadigm(text) {
    return String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ')
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
  }
  // '' when the paradigm can be saved, else the reason in plain words.
  function paradigmError(text) {
    const n = cleanParadigm(text).length;
    return n > MAX_PARADIGM ? 'Your paradigm is ' + n.toLocaleString('en-US') + ' characters. The limit is ' + MAX_PARADIGM.toLocaleString('en-US') + '.' : '';
  }

  // The paradigm the app judges by: the account's when signed in (profile not null), else the one on this device.
  function activeParadigm(profile, localText) { return profile ? profile.paradigm : String(localText || ''); }

  // Offer once (per device) to copy the device paradigm up, only when the account has none and the device has one.
  function shouldOfferParadigmCopy(st) {
    const s = st || {};
    return Boolean(!s.offered && s.profile && !cleanParadigm(s.profile.paradigm) && cleanParadigm(s.localText));
  }

  // The "Judging for" options: one per school, then "Just me" (value ''). No schools (or signed out): no picker.
  function judgingOptions(profile) {
    const programs = profile ? profile.programs : [];
    if (!programs.length) return [];
    return [...programs.map((p) => ({ value: p.id, label: 'Judging for: ' + p.name })), { value: '', label: 'Just me' }];
  }
  // The program a round judges for: the wanted id while the judge still belongs to that school, else null ("Just me").
  function judgingFor(wanted, profile) {
    return profile && typeof wanted === 'string' && profile.programs.some((p) => p.id === wanted) ? wanted : null;
  }
  // The choice is made at round start. Once a speech clock has run, the round keeps it, so one round never mixes
  // two schools' policies and pools.
  function judgingLocked(round) { return Boolean(round && (round.run || Object.keys(round.timeLeft || {}).length)); }
  // The round's format locks at the same moment (docs/design/FORMAT-PICK.md §3): one rule, so the two locks never drift.
  const formatLocked = (round) => judgingLocked(round);

  // The body of a hosted AI call (the server API's app client contract): the call's own fields, with the round
  // id and the round's program always from the round, so no call can send a different school.
  // format and formatVersion also come from the round, never from the call: the server builds the rules text from its
  // own copy of that format version (ARCHITECTURE.md §9), so the client never sends rules text.
  function hostedAiBody(round, call) {
    return Object.assign({}, call, { roundId: round.id, programId: judgingId(round.programId) }, F.formatFields(F.formatOf(round)));
  }
  const judgingId = (id) => (typeof id === 'string' && PROGRAM_ID.test(id) ? id : null);

  const api = {
    PROFILE_URL, MAX_PARADIGM, parseProfile, profileOutcome, profileGet, profilePut, cleanParadigm, paradigmError,
    activeParadigm, shouldOfferParadigmCopy, judgingOptions, judgingFor, judgingLocked, formatLocked, hostedAiBody,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).account = api;
})(typeof window !== 'undefined' ? window : globalThis);
