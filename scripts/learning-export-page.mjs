// Compatibility utility outside /learn/, so old-origin progress remains reachable after cutover.
export function learningExportPage(mode = 'prod') {
  const origin = mode === 'staging' ? 'https://tabulaspeech.dev' : 'https://tabulaspeech.com';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Save your old learning progress | Tabula</title>
<link rel="stylesheet" href="/assets/tokens.css"><script src="/learning-progress/export.js" defer></script></head>
<body><main><h1>Save your old learning progress</h1>
<p>Use the browser and device where you read the old Debate Library. This page reads only its learning progress. It does not read rounds, account data, or API keys.</p>
<p><button type="button" data-export-policy-progress hidden>Save old learning progress</button></p>
<p data-export-status role="status" aria-live="polite"></p>
<noscript><p>Turn on JavaScript to save your browser's old learning progress.</p></noscript>
<p><a href="${origin}/learn/progress/">Load the saved file in the new library</a></p>
<p>Only corresponding lesson completions can transfer. This does not complete a new or expanded course.</p>
</main></body></html>\n`;
}
