// Registers the service worker (sw.js) so the app opens with the network off after one visit.
// Browsers without service workers, and pages opened from a file, just skip it.
(function () {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
  });
})();
