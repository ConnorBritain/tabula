// Export only the old policy learning key, on its original domain. No account
// requests, storage writes, or access to other device data.
(() => {
  const button = document.querySelector('[data-export-policy-progress]');
  const status = document.querySelector('[data-export-status]');
  if (!button || !status) return;
  button.hidden = false;
  button.addEventListener('click', () => {
    let raw;
    try { raw = JSON.parse(localStorage.getItem('tabula.learn.v1') || '{}'); }
    catch { status.textContent = 'This browser could not read your old progress. Try the browser and device where you used the old library.'; return; }
    const output = { steps: {}, tracks: {} };
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [id, step] of Object.entries(raw.steps || {})) {
        if (/^[a-z0-9-]{1,60}$/.test(id) && step && Number.isInteger(step.v) && step.v > 0 && step.v < 1000 && /^\d{4}-\d{2}-\d{2}$/.test(step.done || '')) output.steps[id] = { v: step.v, done: step.done };
      }
      for (const [id, track] of Object.entries(raw.tracks || {})) if (/^[a-z0-9-]{1,60}$/.test(id) && track && /^\d{4}-\d{2}-\d{2}$/.test(track.done || '')) output.tracks[id] = { done: track.done };
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'tabula-policy-learning-progress.json';
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = Object.keys(output.steps).length ? 'Saved your old policy learning progress. Load this file in the new library.' : 'The saved file contains no finished steps. Use the browser and device where you studied in the old library.';
  });
})();
