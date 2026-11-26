// Speech Events: the Connect AI and Forget my key dialogs (step E13, shared in step S2). The Review screen's clean-up
// invite (cleanup-view.js) and Settings (settings-screen.js) both use them, so the words and the order of the
// questions are the same in both places. They draw nothing themselves: they use the page's one dialog (core/ui.js ask)
// and the judge's own key (ai-key.js createOwnKey).

// Paste a key, then choose where it is kept (not remembered unless chosen; ARCHITECTURE.md §11). ui: the page's
// core/ui.js parts; own: createOwnKey(...). Resolves true when the key is checked and kept, else false (the reason is
// in a toast).
export async function askConnectKey(ui, own) {
  const key = await ui.ask({
    title: 'Connect your AI key',
    body: ['AI editing uses your own API key from Anthropic, OpenAI, Google, xAI or OpenRouter. You pay that company for each use, usually less than a cent.', 'The key stays in this browser. It is sent only to that company.'],
    input: { label: 'API key', placeholder: 'Paste the key', emptyError: 'Paste a key first.' },
    buttons: [{ label: 'Cancel', value: null }, { label: 'Connect', kind: 'primary' }],
  });
  if (!key) return false;
  const keep = await ui.ask({
    title: 'Keep the key after you close this tab?',
    body: 'On a shared computer, choose "Only this tab".',
    buttons: [{ label: 'Remember on this device', value: 'remember' }, { label: 'Only this tab', value: 'tab', kind: 'primary' }],
    cancelValue: 'tab',
  });
  ui.announce('Checking the key.');
  try { await own.connect(key, keep === 'remember'); }
  catch (err) { ui.toast(err.message, { kind: 'error', key: 'ai' }); return false; }
  ui.toast(own.providerName() + ' is connected.', { key: 'ai' });
  return true;
}

// Ask, then forget the key. Resolves true when it is gone. The caller says so (a toast) after its own clean-up.
export async function askForgetKey(ui, own) {
  const ok = await ui.ask({ title: 'Forget your AI key?', body: 'Tabula removes the key from this browser. You can connect it again later.', buttons: [{ label: 'Cancel', value: false }, { label: 'Forget the key', value: true, kind: 'danger' }], cancelValue: false });
  if (!ok) return false;
  own.forget();
  return true;
}
