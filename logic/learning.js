// Public learning links. Reading stays separate from round data and account requests.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const routes = node ? require('./learning-routes.js') : root.PolicyLogicParts.learningRoutes;
  const FORMATS = { 'policy-hs': 'policy', ld: 'lincoln-douglas', pf: 'public-forum' };
  const ORIGINS = { prod: 'https://tabulaspeech.com', staging: 'https://tabulaspeech.dev', local: 'http://localhost:8781' };

  function learningLink(formatId, page, options = {}) {
    const enabled = options.enabled ?? routes.enabled;
    // Existing installations keep their working local library until the release cutover.
    if (!enabled) return { href: page ? `learn/${page.slug}/` : 'learn/', title: page ? page.topic : 'Debate library', external: false };
    const event = FORMATS[formatId];
    const origin = ORIGINS[options.mode] || ORIGINS.prod;
    if (!event) return { href: `${origin}/learn/debate/`, title: 'Debate library', external: true };
    // A policy sheet is not evidence that its policy lesson also teaches LD or PF.
    const id = event === 'policy' && page ? `policy-${page.slug}` : null;
    const article = id && routes.articles[id];
    const path = article?.path || routes.events[event]?.path || `/learn/debate/${event}/`;
    return { href: origin + path, title: article?.title || routes.events[event]?.title || 'Debate library', external: true };
  }

  function legacyLearningPath(pathname, options = {}) {
    if (!(options.enabled ?? routes.enabled)) return null;
    const path = pathname.replace(/\/$/, '');
    if (path === '/learn') return '/learn/';
    if (path === '/learn/tracks') return '/learn/tracks/';
    const article = /^\/learn\/([a-z0-9-]+)$/.exec(path);
    if (article && Object.hasOwn(routes.legacy, article[1])) return routes.legacy[article[1]];
    const track = /^\/learn\/tracks\/([a-z0-9-]+)$/.exec(path);
    return track && Object.hasOwn(routes.oldTracks, track[1]) ? routes.oldTracks[track[1]] : null;
  }

  const api = { learningLink, legacyLearningPath, learningCutover: routes.enabled, learningSource: routes.sourceDigest };
  if (node) module.exports = api;
  else (root.PolicyLogicParts ||= {}).learning = api;
})(typeof window !== 'undefined' ? window : globalThis);
