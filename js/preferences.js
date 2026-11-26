// Saved device defaults and per-tool preferences. Preferences never start an AI request.
'use strict';
const preferenceDisposers = new WeakMap();
const AI_PREFERENCES = TabulaCore['ai-preferences'];
const preferenceScopes = () => {
  const tools = [
    { id: 'aiFlow', label: 'AI Flow', guidance: false },
    { id: 'liveEval', label: 'Live Eval', guidance: true },
    { id: 'analysis', label: 'Analysis', guidance: true },
    { id: 'ballotDraft', label: 'Ballot', guidance: true },
  ].filter((x) => can(x.id));
  return [{ id: 'defaults', label: 'All allowed tools', guidance: tools.some((x) => x.guidance) }, ...tools];
};

function renderAIPreferences() {
  const scopes = preferenceScopes();
  const mount = $('#ai-device-preferences');
  if (!mount) return;
  preferenceDisposers.get(mount)?.();
  preferenceDisposers.delete(mount);
  if (scopes.length === 1) { mount.innerHTML = ''; return; }
  mount.innerHTML = AI_PREFERENCES.preferencesHtml({ id: 'pref-device', scopes });
  preferenceDisposers.set(mount, AI_PREFERENCES.bindPreferences(mount, {
    scopes, read: () => S.aiPreferences,
    write: (value) => { S.aiPreferences = value; return saveSettings(); },
  }));
}

function requestPreferences(feature) {
  if (!['aiFlow', 'liveEval', 'analysis', 'ballotDraft'].includes(feature)) return { style: '', guidance: '' };
  return AI_PREFERENCES.resolvePreferences(S.aiPreferences, feature, feature !== 'aiFlow');
}
