// Feature flags: switches for parts of Tabula that are not settled yet. To turn a part off, set its value in FLAGS to
// false and publish. A flagged part of the page has data-flag="<name>" and starts hidden in index.html; js/core.js
// shows it only when its flag is on, so a part that is off never shows, even for a moment.
// tournamentSite is the main switch for every part built for text from a tournament site (docs/research/TABROOM.md,
// Option D). false turns all of them off at once. The "Copy for the tournament ballot" sheet itself is not under it:
// it came first (spec 4.11) and works for any tournament, so only its new extras (copyTips) are.
// The ?flags= dev switch can turn a part off anywhere, but can turn a part on only when Tabula runs on this computer
// (localhost), so a part the owner turned off stays off on the website.
// One part of logic.js (pure logic, no DOM). logic.js joins the parts into one API.
(function (root) {
  'use strict';

  const FLAGS = Object.freeze({
    tournamentSite: true, // the main switch for the three parts below
    pasteRound: true, // Round card: paste the round from the tournament site, and Swap Aff and Neg
    roundDetails: true, // Round card: room, start time and flight (the paste fills them too)
    copyTips: true, // Copy sheet: word counts, and the low-point-win note for the tournament ballot
  });
  // The main switch each flag is under. A flag is on only when it and its main switch are both on.
  const FLAG_GROUP = Object.freeze({ pasteRound: 'tournamentSite', roundDetails: 'tournamentSite', copyTips: 'tournamentSite' });

  // The dev switch: ?flags=pasteRound:off,copyTips:on changes flags for this page load only. Unknown names and
  // values are ignored, and so is "on" unless local is true.
  function flagOverrides(search, local) {
    const out = {};
    const raw = new URLSearchParams(String(search || '')).get('flags') || '';
    for (const pair of raw.split(',')) {
      const [name, value] = pair.split(':').map((s) => s.trim());
      if (Object.prototype.hasOwnProperty.call(FLAGS, name) && (value === 'off' || (value === 'on' && local))) out[name] = value === 'on';
    }
    return out;
  }

  // True when the part named is on. o: { search (location.search, for the dev switch), local (Tabula runs on this
  // computer), flags (the switches to read; tests pass their own, the page uses FLAGS) }. An unknown name is off.
  function flagOn(name, o) {
    const opt = o || {};
    const f = opt.flags || FLAGS;
    if (!Object.prototype.hasOwnProperty.call(f, name)) return false;
    const over = flagOverrides(opt.search, opt.local);
    const val = (n) => Boolean(Object.prototype.hasOwnProperty.call(over, n) ? over[n] : f[n]);
    return val(name) && (!FLAG_GROUP[name] || val(FLAG_GROUP[name]));
  }

  const api = { FLAGS, FLAG_GROUP, flagOn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PolicyLogicParts = root.PolicyLogicParts || {}).flags = api;
})(typeof window !== 'undefined' ? window : globalThis);
