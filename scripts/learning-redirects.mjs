// Exact compatibility aliases. Unknown learning URLs retain their normal 404 response.
export function learningRedirects(snapshot, mode = 'prod') {
  if (!snapshot.enabled) return '';
  if (!snapshot.releaseReady) throw new Error('Cannot redirect the working library to an unfinished release.');
  const origin = mode === 'staging' ? 'https://tabulaspeech.dev' : 'https://tabulaspeech.com';
  const rules = new Map();
  const pair = (from, to) => { rules.set(from, origin + to); rules.set(from + '/', origin + to); };
  pair('/learn', '/learn/');
  pair('/learn/tracks', '/learn/tracks/');
  for (const [slug, path] of Object.entries(snapshot.legacy)) pair(`/learn/${slug}`, path);
  for (const [id, path] of Object.entries(snapshot.oldTracks)) pair(`/learn/tracks/${id}`, path);
  return [...rules].map(([from, to]) => `${from} ${to} 301`).join('\n') + '\n';
}
