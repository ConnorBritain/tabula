// Sets the theme before the page paints (spec V10, Q3), so a dark-mode judge never sees a white flash.
// Loaded in <head> before assets/tokens.css on every page type: the app, About and the Debate Library.
// It must be a file, not an inline script: the security rule only runs scripts from this site (script-src 'self').
// The setting is the app's own ('system' | 'light' | 'dark', saved with the other settings). System is the default.
// The same rule is L.resolveTheme in logic.js; tokens.test.js checks that the two agree.
(function (root) {
  'use strict';
  var KEY = 'policyJudge.settings.v1';
  function resolve(setting, prefersDark) {
    if (setting === 'light' || setting === 'dark') return setting;
    return prefersDark ? 'dark' : 'light';
  }
  function saved() {
    try { var s = JSON.parse(root.localStorage.getItem(KEY) || '{}'); return (s && s.theme) || 'system'; }
    catch (e) { return 'system'; }
  }
  var mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: dark)') : null;
  var setting = saved();
  var listeners = [];
  function apply() {
    var theme = resolve(setting, Boolean(mq && mq.matches));
    var el = root.document.documentElement;
    if (el.getAttribute('data-theme') !== theme) {
      el.setAttribute('data-theme', theme);
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](theme); } catch (e) {} }
    }
    return theme;
  }
  apply();
  // System follows a device change live.
  if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
  // A change in another tab (the app, About or a library page) shows here too.
  if (root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === KEY) { setting = saved(); apply(); } });
  root.TabulaTheme = {
    resolve: resolve,
    // set(setting) draws the new theme at once; the app saves the setting itself.
    set: function (s) { setting = s === 'light' || s === 'dark' ? s : 'system'; return apply(); },
    current: function () { return root.document.documentElement.getAttribute('data-theme'); },
    onChange: function (fn) { listeners.push(fn); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
