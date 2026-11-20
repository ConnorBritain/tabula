// The product name and the footer year, in one place (owner, 2026-11-20).
// Tabula Speech is the parent brand; this app is the product "Tabula Debate" (docs/growth/BRAND.md).
// One place at run time: the HTML also holds the same words as a no-script fallback, so a name change edits
// PRODUCT here and the static text next to each data-brand-* attribute (brand-footer-start.test.mjs checks they agree).
// It must be a file, not an inline script: the security rule only runs scripts from this site (script-src 'self').
// What it fills:
//   [data-brand-product]       the product word ("Debate"), next to the family name in the wordmark
//   [data-brand-text="..."]    text from a template; {name} is the full product name, {parent} the parent brand
//   [data-brand-aria="..."]    aria-label from a template, with the same words
//   [data-year]                the year from this device's clock, so the copyright line turns over by itself
(function (root) {
  'use strict';
  var FAMILY = 'Tabula', PRODUCT = 'Debate', PARENT = 'Tabula Speech';
  var NAME = FAMILY + ' ' + PRODUCT;
  function fill(tpl) { return String(tpl).split('{name}').join(NAME).split('{parent}').join(PARENT); }
  function each(doc, sel, fn) { var els = doc.querySelectorAll(sel); for (var i = 0; i < els.length; i++) fn(els[i]); }
  function apply(doc, now) {
    var year = String((now || new Date()).getFullYear());
    each(doc, '[data-brand-product]', function (el) { el.textContent = PRODUCT; });
    each(doc, '[data-brand-text]', function (el) { el.textContent = fill(el.getAttribute('data-brand-text')); });
    each(doc, '[data-brand-aria]', function (el) { el.setAttribute('aria-label', fill(el.getAttribute('data-brand-aria'))); });
    each(doc, '[data-year]', function (el) { el.textContent = year; });
  }
  root.TabulaBrand = { FAMILY: FAMILY, PRODUCT: PRODUCT, PARENT: PARENT, NAME: NAME, fill: fill, apply: apply };
  if (root.document) apply(root.document);
})(typeof window !== 'undefined' ? window : globalThis);
