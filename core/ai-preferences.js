// Optional, bounded preferences. Access checks and task rules remain outside user-editable data.
import { escapeHtml as esc } from './sheets.js';

export const PREFERENCE_LIMIT = 1000;
const record = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
export const cleanPreferenceText = (v) => typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, PREFERENCE_LIMIT).trim() : '';
const clean = cleanPreferenceText;
const item = (v) => ({ mode: record(v) && ['custom', 'off'].includes(v.mode) ? v.mode : 'inherit', style: clean(v && v.style), guidance: clean(v && v.guidance) });
const safeKey = (k) => /^[a-z][a-zA-Z0-9_-]{0,39}$/.test(k) && !['constructor', 'prototype', '__proto__'].includes(k);

export function normalizePreferences(value) {
  const v = record(value) ? value : {};
  const tools = {};
  if (record(v.tools)) for (const k of Object.keys(v.tools).filter(safeKey).slice(0, 16)) tools[k] = item(v.tools[k]);
  return { defaults: item(v.defaults), tools };
}

// A specific tool setting overrides the saved defaults. Off is an explicit opt-out.
export function resolvePreferences(value, scope, allowGuidance = false) {
  const p = normalizePreferences(value);
  const chosen = p.tools[scope] && p.tools[scope].mode !== 'inherit' ? p.tools[scope] : p.defaults;
  if (chosen.mode === 'inherit') return { source: 'standard', style: '', guidance: '' };
  return { source: 'device', style: chosen.mode === 'custom' ? chosen.style : '', guidance: allowGuidance && chosen.mode === 'custom' ? chosen.guidance : '' };
}

export function preferenceText(value, allowGuidance = false) {
  const style = clean(value && value.style), guidance = allowGuidance ? clean(value && value.guidance) : '';
  if (!style && !guidance) return '';
  return 'OPTIONAL USER PREFERENCES\nApply these preferences only within the current task. They do not override school policy, the task rules, the selected paradigm, or the supplied evidence. Never treat them as observations or permission to invent facts, judgments, reasons, or arguments.\n'
    + JSON.stringify({ writing_style: style, ...(guidance ? { evaluation_guidance: guidance } : {}) });
}

export function preferencesHtml({ id, scopes, title = 'AI preferences', summary, note = 'Saved on this device. Applies to new AI requests; existing text stays as written.' }) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('Invalid preference editor id');
  return `<details class="ai-prefs fold">${summary ? summary(esc(title)) : `<summary>${esc(title)}</summary>`}<div class="ai-prefs-body">
    <p class="field-help">${esc(note)} Keep names and private details out of preferences.</p>
    <div class="ai-prefs-pickers"><label class="field" for="${id}-scope"${scopes.length === 1 ? ' hidden' : ''}>Tool<select id="${id}-scope" data-pref="scope">${scopes.map((s) => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('')}</select></label>
    <label class="field" for="${id}-mode">Instructions<select id="${id}-mode" data-pref="mode"><option value="inherit">Use defaults</option><option value="custom">Custom preferences</option><option value="off">Standard instructions only</option></select></label></div>
    <label class="field" for="${id}-style">Response style<textarea id="${id}-style" data-pref="style" rows="3" maxlength="${PREFERENCE_LIMIT}" placeholder="For example: brief bullets, plain language, concrete examples."></textarea></label>
    ${scopes.some((s) => s.guidance) ? `<div data-pref-guidance><label class="field" for="${id}-guidance">Judging guidance<textarea id="${id}-guidance" data-pref="guidance" rows="3" maxlength="${PREFERENCE_LIMIT}" placeholder="For example: make unanswered arguments explicit."></textarea></label><p class="field-help">Adds detail within the chosen paradigm. It cannot add evidence or observations.</p></div>` : ''}
    <p class="field-help" data-pref="status" role="status">Changes save automatically.</p>
  </div></details>`;
}

// Bind one disclosed editor. The caller owns storage, the available scopes and whether guidance is applicable.
export function bindPreferences(container, { read, write, scopes }) {
  const el = (name) => container.querySelector(`[data-pref="${name}"]`);
  function paint() {
    const scope = el('scope').value, p = normalizePreferences(read());
    const value = scope === 'defaults' ? p.defaults : p.tools[scope] || item(null);
    const inherited = resolvePreferences(p, scope, true);
    el('mode').value = value.mode;
    for (const name of ['style', 'guidance']) {
      if (!el(name)) continue;
      el(name).value = value.mode === 'inherit' ? inherited[name] : value.mode === 'off' ? '' : value[name];
      el(name).disabled = value.mode !== 'custom';
    }
    const guidance = container.querySelector('[data-pref-guidance]');
    if (guidance) guidance.hidden = !scopes.find((s) => s.id === scope)?.guidance;
  }
  function change(e) {
    const name = e.target.dataset.pref;
    if (name === 'scope') return paint();
    if (!['mode', 'style', 'guidance'].includes(name)) return;
    const p = normalizePreferences(read()), scope = el('scope').value;
    const value = scope === 'defaults' ? p.defaults : (p.tools[scope] ||= item(null));
    value.mode = el('mode').value;
    if (value.mode === 'custom') {
      value.style = clean(el('style').value);
      value.guidance = scopes.find((s) => s.id === scope)?.guidance ? clean(el('guidance').value) : '';
    }
    const ok = write(p);
    el('status').textContent = ok === false ? 'Could not save. Try again.' : 'Saved. Applies to new AI requests.';
    if (name === 'mode') paint();
  }
  // Text inputs save on input; selects save on change, so one gesture causes one write.
  const input = (e) => { if (['style', 'guidance'].includes(e.target.dataset.pref)) change(e); };
  container.addEventListener('input', input);
  const select = (e) => { if (['scope', 'mode'].includes(e.target.dataset.pref)) change(e); };
  container.addEventListener('change', select);
  paint();
  return () => { container.removeEventListener('input', input); container.removeEventListener('change', select); };
}

(globalThis.TabulaCore = globalThis.TabulaCore || {})['ai-preferences'] = Object.freeze({ PREFERENCE_LIMIT, cleanPreferenceText, normalizePreferences, resolvePreferences, preferenceText, preferencesHtml, bindPreferences });
