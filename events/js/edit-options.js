// Feedback wording operations and the saved default. No access checks, DOM, or AI calls.
import { PREFERENCE_LIMIT } from '../../core/ai-preferences.js';

export const EDIT_MODES = Object.freeze([
  { id: 'full', label: 'Clarify' }, { id: 'concise', label: 'Shorten' },
  { id: 'sentences', label: 'Write full sentences' }, { id: 'spelling', label: 'Fix spelling' },
  { id: 'custom', label: 'Custom request' },
]);

// Saved primary edit action. A custom default runs its saved wording request.
export function editDefaults(value) {
  const mode = EDIT_MODES.some((m) => m.id === value?.mode) ? value.mode : 'full';
  const request = typeof value?.request === 'string' ? value.request.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, PREFERENCE_LIMIT).trim() : '';
  return { mode: mode === 'custom' && !request ? 'full' : mode, request };
}
